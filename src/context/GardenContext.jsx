import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { subscribeToCompost, addCompostItem, deleteCompostItem, subscribeToDailyPlan, saveDailyPlan, getDailyPlan, saveCheckInForDate, getCheckInsForLastDays } from '../firebase/services';
import { recordVibe } from '../services/energyDictionaryService';
import { loginWithGoogle, logoutUser } from '../services/authService';
import { loginWithMicrosoft, logoutMicrosoft, fetchOutlookEvents, getAccessTokenSilently } from '../services/microsoftCalendarService';
import { localISODate, getThisWeekSundayLocal, getLogicalToday, getDayStartsAtHour } from '../services/dateUtils';
import { normalizePlanKeys, toCanonicalSlotKey } from '../services/schedulingConflictService';

const STORAGE_KEY = 'gardenData';
const LAST_OPEN_DATE_KEY = 'gardenLastOpenDate';
const CLOUD_DEBOUNCE_MS = 2000;

function yesterdayString() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return localISODate(d);
}

/** Calendar today (midnight-based). For logical "today" with custom day start, use useGarden().today. */
export function todayString() {
  return localISODate();
}

const defaultData = {
  goals: [],
  weeklyEvents: [],
  userSettings: {
    dayStart: '08:00',
    dayEnd: '22:00',
    dayStartsAt: '00:00', // midnight reset: '00:00' | '01:00' ... '05:00' — when the "day" flips (e.g. 3 AM = 1:30 AM Tue is still "Monday")
    isWorkScheduler: true,
    workHours: { start: '09:00', end: '17:00' },
    appGuideStep: 0, // Day 1 Guide: 0–3 = current step, -1 = dismissed
  }, // scheduling: used by TimeSlicer + schedulerService (startHour/endHour)
  dailyEnergyModifier: 0,
  dailySpoonCount: null, // 0–12 from check-in; 0 = compost-only day, used as maxSlots when set
  lastCheckInDate: null,
  lastSundayRitualDate: null,
  weeklyNorthStarId: null, // id of the one goal/project chosen as focus for the week (Sunday Ritual)
  logs: [],
  spiritConfig: null, // { name, type: 'mochi'|'ember'|'nimbus' } from Spirit Builder (or legacy { head, body, color, name })
  compost: [], // Inbox: { id, text, createdAt }
  soilNutrients: 0, // 0–20; +1 per compost item added; consumed on focus complete for bonus
  spiritPoints: 0, // 1 per minute of focus
  embers: 100, // currency for decorations; new users start with 100 (enough for a bench)
  decorations: [{ id: 'dec-default-campfire', name: 'Log Campfire', type: 'decoration', model: 'campfire_logs.glb', position3D: [-2, 0, -2] }],
  ownedSeeds: [], // seed ids from shop (e.g. 'seed_oak', 'seed_pine')
  terrainMap: {}, // grid coords as keys, e.g. { "2,-3": "water" }
  unlockedAnimals: [], // e.g. ['rabbit', 'fish'] — animals bought from shop
  metrics: [], // { id, name } — available metrics for vitality tracking
  fertilizerCount: 0, // +1 when adding to compost or deleting from compost (visual recycling)
  waterDrops: 5, // earned by completing tasks; spent to water goals
  monthlyQuotas: [], // { id, name, targetHours, loggedHours, blocks?: [] } for freelancer quota tracking
  pausedDays: {}, // { [dateStr]: true } — days user marked as Pause/Sick
  needsRescheduling: [], // { id, sourceDate, hour, assignment, title }[] — fixed tasks pulled from a paused day
  routines: [
    // 🧼 Care & Hygiene
    { id: 'r_teeth', title: 'Brush Teeth', category: '🧼 Care & Hygiene', duration: 5 },
    { id: 'r_shower', title: 'Take a Shower', category: '🧼 Care & Hygiene', duration: 15 },
    { id: 'r_meds', title: 'Take Medication', category: '🧼 Care & Hygiene', duration: 5 },
    // 🧹 Household
    { id: 'r_dishes', title: 'Do the Dishes', category: '🧹 Household', duration: 15 },
    { id: 'r_trash', title: 'Take out Trash', category: '🧹 Household', duration: 5 },
    { id: 'r_laundry', title: 'Do Laundry', category: '🧹 Household', duration: 30 },
    { id: 'r_plants', title: 'Water Plants', category: '🧹 Household', duration: 10 },
    // 📁 Life Admin
    { id: 'r_desk', title: 'Clean Desk', category: '📁 Life Admin', duration: 15 },
    { id: 'r_mail', title: 'Check Mail/Email', category: '📁 Life Admin', duration: 10 },
    { id: 'r_groceries', title: 'Grocery Shopping', category: '📁 Life Admin', duration: 60 },
    { id: 'r_plan', title: 'Review Daily Plan', category: '📁 Life Admin', duration: 10 },
    // 💪 Wellness & Rest
    { id: 'r_exercise', title: 'Quick Workout / Stretch', category: '💪 Wellness', duration: 20 },
    { id: 'r_walk', title: 'Go for a Walk', category: '💪 Wellness', duration: 30 },
    { id: 'r_meditate', title: 'Meditate', category: '💪 Wellness', duration: 10 },
  ], // micro-habit templates: { id, title, category, duration (minutes) }
};

const GardenContext = createContext(null);

/** Ensure routine templates are represented as routine-type goals.
 * For now we keep one goal per template (each appears as its own seed),
 * but this is the central place to later collapse templates into grouped
 * routine seeds (e.g. one Life Admin seed with multiple subtasks).
 */
function ensureRoutineGoalsFromTemplates(routines, goals) {
  if (!Array.isArray(routines) || routines.length === 0) return goals;
  const nextGoals = Array.isArray(goals) ? [...goals] : [];
  let changed = false;
  const existingByTemplateId = new Set(
    nextGoals
      .filter((g) => g && g.type === 'routine' && g._routineTemplateId)
      .map((g) => g._routineTemplateId)
  );
  const existingById = new Set(nextGoals.map((g) => g.id));

  routines.forEach((r) => {
    if (!r || !r.id) return;
    if (existingByTemplateId.has(r.id)) return;
    const goalId = `routine-${r.id}`;
    if (existingById.has(goalId)) return;
    const estimatedHours = typeof r.duration === 'number' && r.duration > 0 ? r.duration / 60 : 0.25;
    const subtaskId = `st-${r.id}`;
    nextGoals.push({
      id: goalId,
      title: r.title || 'Routine',
      type: 'routine',
      category: r.category || '📋 Other',
      estimatedMinutes: r.duration ?? undefined,
      _routineTemplateId: r.id,
      subtasks: [
        {
          id: subtaskId,
          title: r.title || 'Routine',
          estimatedHours,
          completedHours: 0,
          deadline: null,
          color: null,
          phaseId: null,
          weekRange: null,
          // Per-task recurrence days can be set later via TaskDetailModal
        },
      ],
    });
    changed = true;
  });

  return changed ? nextGoals : goals;
}

export function GardenProvider({ children }) {
  const [goals, setGoals] = useState(defaultData.goals);
  const [weeklyEvents, setWeeklyEvents] = useState(defaultData.weeklyEvents);
  const [userSettings, setUserSettings] = useState(defaultData.userSettings);
  const [dailyEnergyModifier, setDailyEnergyModifier] = useState(defaultData.dailyEnergyModifier);
  const [dailySpoonCount, setDailySpoonCount] = useState(defaultData.dailySpoonCount);
  const [lastCheckInDate, setLastCheckInDate] = useState(defaultData.lastCheckInDate);
  const [lastSundayRitualDate, setLastSundayRitualDate] = useState(defaultData.lastSundayRitualDate);
  const [weeklyNorthStarId, setWeeklyNorthStarId] = useState(defaultData.weeklyNorthStarId);
  const [logs, setLogs] = useState(defaultData.logs);
  const [spiritConfig, setSpiritConfigState] = useState(defaultData.spiritConfig);
  const [compost, setCompost] = useState(defaultData.compost);
  const [soilNutrients, setSoilNutrients] = useState(defaultData.soilNutrients ?? 0);
  const [assignments, setAssignments] = useState({}); // daily schedule { [hour]: assignment | assignment[], anytime?: assignment[] }
  const [planDate, setPlanDate] = useState(() => getLogicalToday(new Date(), 0)); // logical "today" for plan subscription (respects userSettings.dayStartsAt)
  const [weekAssignments, setWeekAssignments] = useState({}); // cache: { [dateStr]: { [hour]: assignment } }
  const weekAssignmentsRef = useRef({});
  const [eveningMode, setEveningMode] = useState('none'); // 'none' | 'sleep' | 'night-owl'
  const [spiritPoints, setSpiritPoints] = useState(defaultData.spiritPoints);
  const [embers, setEmbers] = useState(defaultData.embers ?? 100);
  const [decorations, setDecorations] = useState(defaultData.decorations);
  const [ownedSeeds, setOwnedSeeds] = useState(defaultData.ownedSeeds ?? []);
  const [terrainMap, setTerrainMap] = useState(defaultData.terrainMap);
  const [unlockedAnimals, setUnlockedAnimals] = useState(defaultData.unlockedAnimals ?? []);
  const [activeTool, setActiveTool] = useState(null); // UI only: { type: 'paint', material } | { type: 'plant', goalId } | { type: 'place', decorationId } | null
  const [tourStep, setTourStep] = useState(0); // Interactive onboarding: 0 = off, 1 = Morning Check-in, 2 = OmniAdd, 3 = Task checkbox, 4 = Garden Spirit
  // Architect Mode: tap-to-select, tap-to-move layout editing (mobile-friendly).
  const [isArchitectMode, setIsArchitectMode] = useState(false);
  const [selectedObjectId, setSelectedObjectId] = useState(null); // "goal:<id>" | "decoration:<id>" | "shop-stand" | null
  const [metrics, setMetrics] = useState(defaultData.metrics);
  const [fertilizerCount, setFertilizerCount] = useState(defaultData.fertilizerCount ?? 0);
  const [waterDrops, setWaterDrops] = useState(defaultData.waterDrops ?? 5);
  const [monthlyQuotas, setMonthlyQuotas] = useState(defaultData.monthlyQuotas ?? []);
  const [routines, setRoutines] = useState(defaultData.routines ?? []);
  const [pausedDays, setPausedDays] = useState(defaultData.pausedDays ?? {});
  const [needsRescheduling, setNeedsRescheduling] = useState(defaultData.needsRescheduling ?? []);
  const [spawnedVolumeBlocks, setSpawnedVolumeBlocks] = useState([]); // { id, goalId, goalTitle, blockValue, targetMetric }[] — from Sunday Ritual Pacer
  const [stagingTaskStatus, setStagingTaskStatus] = useState(() => ({})); // { [taskId]: 'active' | 'someday' } — override for backlog tab; e.g. from Next Step prompter
  const [smallJoys, setSmallJoys] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('smallJoys') || '[]');
    } catch {
      return [];
    }
  });
  const [hydrated, setHydrated] = useState(false);
  const [cloudSaveStatus, setCloudSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved'
  const saveTimeoutRef = useRef(null);
  const savedIdleTimeoutRef = useRef(null);
  const skipCloudSaveUntilRef = useRef(0);

  const [googleUser, setGoogleUser] = useState(null);
  const [googleToken, setGoogleToken] = useState(null);
  const [msUser, setMsUser] = useState(null);
  const [msToken, setMsToken] = useState(null);

  const connectCalendar = useCallback(async () => {
    try {
      const { user, token } = await loginWithGoogle();
      setGoogleUser(user);
      setGoogleToken(token);
      return true;
    } catch (e) {
      console.error("Connection failed", e);
      return false;
    }
  }, []);

  const disconnectCalendar = useCallback(async () => {
    await logoutUser();
    setGoogleUser(null);
    setGoogleToken(null);
  }, []);

  const connectOutlook = useCallback(async () => {
    try {
      const { accessToken, account } = await loginWithMicrosoft();
      setMsUser(account);
      setMsToken(accessToken);
      return { ok: true };
    } catch (e) {
      console.error("Outlook connection failed", e);
      const message = e?.message || String(e);
      return { ok: false, error: message };
    }
  }, []);

  const disconnectOutlook = useCallback(async () => {
    try { await logoutMicrosoft(); } catch (_) {}
    setMsUser(null);
    setMsToken(null);
  }, []);

  const refreshOutlookToken = useCallback(async () => {
    const token = await getAccessTokenSilently();
    if (token) setMsToken(token);
    return token;
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (Array.isArray(data.goals)) setGoals(data.goals);
        if (Array.isArray(data.weeklyEvents)) setWeeklyEvents(data.weeklyEvents);
        if (data.userSettings && typeof data.userSettings === 'object') setUserSettings(data.userSettings);
        if (typeof data.dailyEnergyModifier === 'number') setDailyEnergyModifier(data.dailyEnergyModifier);
        if (typeof data.dailySpoonCount === 'number' && data.dailySpoonCount >= 0 && data.dailySpoonCount <= 12) setDailySpoonCount(data.dailySpoonCount);
        if (data.lastCheckInDate != null) setLastCheckInDate(data.lastCheckInDate);
        if (data.lastSundayRitualDate != null) setLastSundayRitualDate(data.lastSundayRitualDate);
        if (data.weeklyNorthStarId != null) setWeeklyNorthStarId(data.weeklyNorthStarId);
        if (Array.isArray(data.logs)) setLogs(data.logs);
        if (data.spiritConfig && typeof data.spiritConfig === 'object') setSpiritConfigState(data.spiritConfig);
        if (Array.isArray(data.compost)) setCompost(data.compost);
        if (typeof data.spiritPoints === 'number') setSpiritPoints(data.spiritPoints);
        if (typeof data.embers === 'number') setEmbers(data.embers);
        if (Array.isArray(data.decorations)) setDecorations(data.decorations);
        if (Array.isArray(data.ownedSeeds)) setOwnedSeeds(data.ownedSeeds);
        if (data.terrainMap && typeof data.terrainMap === 'object') setTerrainMap(data.terrainMap);
        if (Array.isArray(data.unlockedAnimals)) setUnlockedAnimals(data.unlockedAnimals);
        if (Array.isArray(data.metrics)) setMetrics(data.metrics);
        if (typeof data.fertilizerCount === 'number' && data.fertilizerCount >= 0) setFertilizerCount(data.fertilizerCount);
        if (typeof data.waterDrops === 'number' && data.waterDrops >= 0) setWaterDrops(data.waterDrops);
        if (Array.isArray(data.monthlyQuotas)) setMonthlyQuotas(data.monthlyQuotas);
        if (Array.isArray(data.routines)) setRoutines(data.routines);
      }
    } catch (e) {
      console.warn('GardenContext: failed to load gardenData', e);
    }
    setHydrated(true);
  }, []);

  // Load from Firestore when googleUser (login) changes
  useEffect(() => {
    const uid = googleUser?.uid;
    if (!uid) return;
    let cancelled = false;
    (async () => {
      try {
        const ref = doc(db, 'users', uid, 'garden', 'data');
        const snap = await getDoc(ref);
        if (cancelled) return;
        if (snap.exists() && snap.data()) {
          const data = snap.data();
          if (Array.isArray(data.goals)) setGoals(data.goals);
          if (Array.isArray(data.weeklyEvents)) setWeeklyEvents(data.weeklyEvents ?? []);
          if (data.userSettings && typeof data.userSettings === 'object') setUserSettings(data.userSettings);
          if (typeof data.dailyEnergyModifier === 'number') setDailyEnergyModifier(data.dailyEnergyModifier);
          if (data.lastCheckInDate != null) setLastCheckInDate(data.lastCheckInDate);
          if (data.lastSundayRitualDate != null) setLastSundayRitualDate(data.lastSundayRitualDate);
          if (data.weeklyNorthStarId != null) setWeeklyNorthStarId(data.weeklyNorthStarId);
          if (Array.isArray(data.logs)) setLogs(data.logs);
          if (data.spiritConfig && typeof data.spiritConfig === 'object') setSpiritConfigState(data.spiritConfig);
          // Compost is sourced from subscribeToCompost when uid exists; do not overwrite from garden/data
          if (typeof data.soilNutrients === 'number') setSoilNutrients(Math.min(20, Math.max(0, data.soilNutrients)));
          if (typeof data.spiritPoints === 'number') setSpiritPoints(data.spiritPoints);
          if (typeof data.embers === 'number') setEmbers(data.embers);
          if (Array.isArray(data.decorations)) setDecorations(data.decorations);
          if (Array.isArray(data.ownedSeeds)) setOwnedSeeds(data.ownedSeeds);
          if (data.terrainMap && typeof data.terrainMap === 'object') setTerrainMap(data.terrainMap);
          if (Array.isArray(data.unlockedAnimals)) setUnlockedAnimals(data.unlockedAnimals);
          if (Array.isArray(data.metrics)) setMetrics(data.metrics);
          if (typeof data.fertilizerCount === 'number' && data.fertilizerCount >= 0) setFertilizerCount(data.fertilizerCount);
          if (typeof data.waterDrops === 'number' && data.waterDrops >= 0) setWaterDrops(data.waterDrops);
          if (Array.isArray(data.monthlyQuotas)) setMonthlyQuotas(data.monthlyQuotas);
          if (Array.isArray(data.routines)) setRoutines(data.routines);
          if (data.pausedDays && typeof data.pausedDays === 'object') setPausedDays(data.pausedDays);
          if (Array.isArray(data.needsRescheduling)) setNeedsRescheduling(data.needsRescheduling);
          skipCloudSaveUntilRef.current = Date.now() + 3000;
        }
      } catch (e) {
        if (!cancelled) console.warn('GardenContext: failed to load from cloud', e);
      }
    })();
    return () => { cancelled = true; };
  }, [googleUser?.uid]);

  // Mirror micro-habit routines into routine-type goals so they appear in Seedbag Routines.
  useEffect(() => {
    if (!hydrated) return;
    setGoals((prev) => ensureRoutineGoalsFromTemplates(routines, prev));
  }, [hydrated, routines]);

  // Persist compost to Firebase: subscribe when logged in
  useEffect(() => {
    const uid = googleUser?.uid;
    if (!uid) return;
    const unsubscribe = subscribeToCompost(uid, setCompost);
    return () => unsubscribe();
  }, [googleUser?.uid]);

  // Keep logical "today" in sync (respects "My Day Starts At" — e.g. 3 AM means 1:30 AM Tue is still Monday)
  useEffect(() => {
    const hour = getDayStartsAtHour(userSettings?.dayStartsAt);
    const tick = () => setPlanDate(getLogicalToday(new Date(), hour));
    tick();
    const interval = setInterval(tick, 60 * 1000);
    return () => clearInterval(interval);
  }, [userSettings?.dayStartsAt]);

  // Subscribe to today's daily plan when logged in
  useEffect(() => {
    const uid = googleUser?.uid;
    if (!uid) return;
    const unsubscribe = subscribeToDailyPlan(uid, planDate, ({ assignments: next }) => {
      setAssignments(normalizePlanKeys(next && typeof next === 'object' ? next : {}));
    });
    return () => unsubscribe();
  }, [googleUser?.uid, planDate]);

  // Debounced save of daily plan to Firebase when assignments change (logged in)
  const dailyPlanSaveTimeoutRef = useRef(null);
  useEffect(() => {
    const uid = googleUser?.uid;
    if (!uid || !hydrated) return;
    if (dailyPlanSaveTimeoutRef.current) clearTimeout(dailyPlanSaveTimeoutRef.current);
    dailyPlanSaveTimeoutRef.current = setTimeout(() => {
      dailyPlanSaveTimeoutRef.current = null;
      saveDailyPlan(uid, planDate, assignments).catch((e) => console.warn('saveDailyPlan failed', e));
    }, CLOUD_DEBOUNCE_MS);
    return () => {
      if (dailyPlanSaveTimeoutRef.current) {
        clearTimeout(dailyPlanSaveTimeoutRef.current);
        dailyPlanSaveTimeoutRef.current = null;
      }
    };
  }, [googleUser?.uid, hydrated, planDate, assignments]);

  // Keep weekAssignments cache in sync with today's assignments
  useEffect(() => {
    weekAssignmentsRef.current = { ...weekAssignmentsRef.current, [planDate]: assignments };
    setWeekAssignments((prev) => ({ ...prev, [planDate]: assignments }));
  }, [planDate, assignments]);

  /** Daily plan is the single source of truth for scheduled assignments; slot keys are normalized to "HH:00". */
  const loadDayPlan = useCallback(async (dateStr) => {
    if (weekAssignmentsRef.current[dateStr]) return weekAssignmentsRef.current[dateStr];
    const uid = googleUser?.uid;
    if (!uid) return {};
    try {
      const { assignments: a } = await getDailyPlan(uid, dateStr);
      const normalized = normalizePlanKeys(a ?? {});
      weekAssignmentsRef.current = { ...weekAssignmentsRef.current, [dateStr]: normalized };
      setWeekAssignments((prev) => ({ ...prev, [dateStr]: normalized }));
      return normalized;
    } catch (e) {
      console.warn('loadDayPlan failed', e);
      return {};
    }
  }, [googleUser?.uid]);

  const saveDayPlanForDate = useCallback(async (dateStr, dayAssignments) => {
    const normalized = normalizePlanKeys(dayAssignments ?? {});
    weekAssignmentsRef.current = { ...weekAssignmentsRef.current, [dateStr]: normalized };
    setWeekAssignments((prev) => ({ ...prev, [dateStr]: normalized }));
    if (dateStr === planDate) {
      setAssignments(normalized);
      return;
    }
    const uid = googleUser?.uid;
    if (!uid) return;
    try {
      await saveDailyPlan(uid, dateStr, normalized);
    } catch (e) {
      console.warn('saveDayPlanForDate failed', e);
    }
  }, [googleUser?.uid, planDate]);

  const loadWeekPlans = useCallback(async () => {
    const uid = googleUser?.uid;
    if (!uid) return {};
    const today = new Date();
    const day = today.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    const results = {};
    const promises = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const ds = localISODate(d);
      if (weekAssignmentsRef.current[ds]) {
        results[ds] = weekAssignmentsRef.current[ds];
      } else {
        promises.push(getDailyPlan(uid, ds).then(({ assignments: a }) => { results[ds] = normalizePlanKeys(a ?? {}); }));
      }
    }
    if (promises.length > 0) await Promise.all(promises);
    weekAssignmentsRef.current = { ...weekAssignmentsRef.current, ...results };
    setWeekAssignments((prev) => ({ ...prev, ...results }));
    return results;
  }, [googleUser?.uid]);

  /** Whether an assignment is fixed (must be rescheduled if day is cleared). Events are never fixed. */
  const isAssignmentFixed = useCallback((a) => {
    if (!a || typeof a !== 'object') return false;
    if (a.type === 'event') return false;
    return a.isFixed === true || a.type === 'fixed' || a.fixed === true;
  }, []);

  /**
   * Pause Day / Sick Day: clear the day's schedule. Flexible tasks are dropped; fixed tasks go to needsRescheduling.
   * @param {string} targetDate - YYYY-MM-DD
   */
  const clearDaySchedule = useCallback(async (targetDate) => {
    if (!targetDate || !loadDayPlan || !saveDayPlanForDate) return;
    const dayPlan = await loadDayPlan(targetDate);
    if (!dayPlan || typeof dayPlan !== 'object') return;
    const goalMap = new Map((goals ?? []).map((g) => [g.id, g]));
    const toReschedule = [];
    Object.entries(dayPlan).forEach(([hour, val]) => {
      if (hour === 'anytime') return;
      const list = Array.isArray(val) ? val : val != null ? [val] : [];
      list.forEach((a) => {
        if (a == null) return;
        if (!isAssignmentFixed(a)) return; // flexible: just clear (don't add to list)
        const goalId = typeof a === 'string' ? a : a.goalId;
        const goal = goalMap.get(goalId);
        const title = goal?.title ?? a.title ?? a.ritualTitle ?? 'Task';
        toReschedule.push({
          id: `pause-${targetDate}-${hour}-${Date.now()}`,
          sourceDate: targetDate,
          hour,
          assignment: typeof a === 'object' ? { ...a } : { goalId: a },
          title,
        });
      });
    });
    await saveDayPlanForDate(targetDate, {});
    setPausedDays((prev) => ({ ...prev, [targetDate]: true }));
    if (toReschedule.length > 0) {
      setNeedsRescheduling((prev) => [...prev, ...toReschedule]);
    }
  }, [loadDayPlan, saveDayPlanForDate, goals, isAssignmentFixed]);

  /** Move a needs-rescheduling item onto a new day (same hour) and remove from list. */
  const rescheduleNeedsReschedulingItem = useCallback(async (item, targetDateStr) => {
    if (!item?.id || !saveDayPlanForDate || !loadDayPlan) return;
    const existing = await loadDayPlan(targetDateStr);
    const next = { ...(existing && typeof existing === 'object' ? existing : {}) };
    const hourKey = toCanonicalSlotKey(item.hour) ?? String(item.hour);
    const existingList = Array.isArray(next[hourKey]) ? next[hourKey] : next[hourKey] != null ? [next[hourKey]] : [];
    next[hourKey] = [...existingList, item.assignment];
    await saveDayPlanForDate(targetDateStr, next);
    setNeedsRescheduling((prev) => prev.filter((r) => r.id !== item.id));
  }, [saveDayPlanForDate, loadDayPlan]);

  /** Remove a single item from needsRescheduling (e.g. user cancelled or moved to backlog). */
  const removeFromNeedsRescheduling = useCallback((itemId) => {
    setNeedsRescheduling((prev) => prev.filter((r) => r.id !== itemId));
  }, []);

  /** Add volume blocks spawned by Sunday Ritual Pacer (shown in Staging Area until placed or dismissed). */
  const addSpawnedVolumeBlocks = useCallback((blocks) => {
    if (!Array.isArray(blocks) || blocks.length === 0) return;
    setSpawnedVolumeBlocks((prev) => [...prev, ...blocks]);
  }, []);

  /** Remove a spawned volume block (e.g. dropped onto a day or dismissed). */
  const removeSpawnedVolumeBlock = useCallback((blockId) => {
    setSpawnedVolumeBlocks((prev) => prev.filter((b) => b.id !== blockId));
  }, []);

  /** Promote a backlog task to "This Week" (active) so it appears in the Staging Area's This Week tab. taskId = e.g. subtask-{goalId}-{subtaskId}. */
  const promoteTaskToThisWeek = useCallback((taskId) => {
    if (!taskId) return;
    setStagingTaskStatus((prev) => ({ ...prev, [taskId]: 'active' }));
  }, []);

  /** Update a goal by id. Safe merge: existing goal is spread first, then updates. Never overwrites position3D or seedModel with undefined. */
  const editGoal = useCallback((goalId, updates) => {
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== goalId) return g;
        const merged = { ...g, ...updates };
        if (merged.position3D === undefined && g.position3D != null) merged.position3D = g.position3D;
        if (merged.seedModel === undefined && g.seedModel != null) merged.seedModel = g.seedModel;
        return merged;
      })
    );
  }, []);

  const deleteGoal = useCallback((goalId) => {
    setGoals((prev) => prev.filter((g) => g.id !== goalId));
  }, []);

  const addToCompost = useCallback(
    async (text) => {
      const trimmed = (text || '').trim();
      if (!trimmed) return;
      const uid = googleUser?.uid;
      const incrementNutrients = () => setSoilNutrients((prev) => Math.min(20, prev + 1));
      const addFertilizerBag = () => {
        setFertilizerCount((prev) => prev + 1);
        window.dispatchEvent(new CustomEvent('kaizen:toast', { detail: { message: 'Turned into 1 bag of fertilizer! 🍂' } }));
      };
      if (uid) {
        try {
          await addCompostItem(uid, trimmed);
          incrementNutrients();
          addFertilizerBag();
        } catch (e) {
          console.warn('addCompostItem failed, using local state', e);
          const item = {
            id: crypto.randomUUID?.() ?? `compost-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            text: trimmed,
            createdAt: new Date().toISOString(),
          };
          setCompost((prev) => [item, ...prev]);
          incrementNutrients();
          addFertilizerBag();
        }
      } else {
        const item = {
          id: crypto.randomUUID?.() ?? `compost-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          text: trimmed,
          createdAt: new Date().toISOString(),
        };
        setCompost((prev) => [item, ...prev]);
        incrementNutrients();
        addFertilizerBag();
      }
    },
    [googleUser?.uid]
  );

  const removeFromCompost = useCallback(
    (id) => {
      setFertilizerCount((prev) => prev + 1);
      window.dispatchEvent(new CustomEvent('kaizen:toast', { detail: { message: 'Turned into 1 bag of fertilizer! 🍂' } }));
      const uid = googleUser?.uid;
      if (uid) {
        deleteCompostItem(uid, id).catch((e) => {
          console.warn('deleteCompostItem failed', e);
          setCompost((prev) => prev.filter((item) => item.id !== id));
        });
      } else {
        setCompost((prev) => prev.filter((item) => item.id !== id));
      }
    },
    [googleUser?.uid]
  );

  const addSmallJoy = useCallback((joy) => {
    const trimmed = typeof joy === 'string' ? joy.trim() : '';
    if (!trimmed) return;
    setSmallJoys((prev) => {
      const next = [...prev, trimmed].slice(-50);
      try {
        localStorage.setItem('smallJoys', JSON.stringify(next));
      } catch (e) {
        console.warn('GardenContext: failed to save smallJoys to localStorage', e);
      }
      return next;
    });
  }, []);

  // Save to localStorage when state changes
  useEffect(() => {
    if (!hydrated) return;
    try {
      const data = { goals, weeklyEvents, userSettings, dailyEnergyModifier, dailySpoonCount, lastCheckInDate, lastSundayRitualDate, weeklyNorthStarId, logs, spiritConfig, compost, soilNutrients, spiritPoints, embers, decorations, ownedSeeds, terrainMap, unlockedAnimals, metrics, fertilizerCount, waterDrops, monthlyQuotas, pausedDays, needsRescheduling, routines };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('GardenContext: failed to save gardenData', e);
    }
  }, [hydrated, goals, weeklyEvents, userSettings, dailyEnergyModifier, dailySpoonCount, lastCheckInDate, lastSundayRitualDate, weeklyNorthStarId, logs, spiritConfig, compost, soilNutrients, spiritPoints, embers, decorations, ownedSeeds, terrainMap, unlockedAnimals, metrics, fertilizerCount, waterDrops, monthlyQuotas, pausedDays, needsRescheduling, routines]);

  // Debounced save to Firestore when goals, logs, weeklyEvents change (and user is logged in)
  useEffect(() => {
    const uid = googleUser?.uid;
    if (!uid || !hydrated) return;
    if (Date.now() < skipCloudSaveUntilRef.current) return;

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setCloudSaveStatus('saving');

    saveTimeoutRef.current = setTimeout(async () => {
      saveTimeoutRef.current = null;
      try {
        const ref = doc(db, 'users', uid, 'garden', 'data');
        await setDoc(ref, {
          goals,
          weeklyEvents,
          userSettings,
          dailyEnergyModifier,
          dailySpoonCount: dailySpoonCount ?? null,
          lastCheckInDate,
          lastSundayRitualDate,
          weeklyNorthStarId: weeklyNorthStarId ?? null,
          logs,
          spiritConfig: spiritConfig ?? null,
          compost: compost ?? [],
          soilNutrients: soilNutrients ?? 0,
          spiritPoints: spiritPoints ?? 0,
          embers: embers ?? 100,
          decorations: decorations ?? [],
          ownedSeeds: Array.isArray(ownedSeeds) ? ownedSeeds : [],
          terrainMap: terrainMap && typeof terrainMap === 'object' ? terrainMap : {},
          unlockedAnimals: Array.isArray(unlockedAnimals) ? unlockedAnimals : [],
          metrics: metrics ?? [],
          fertilizerCount: fertilizerCount ?? 0,
          waterDrops: waterDrops ?? 5,
          monthlyQuotas: Array.isArray(monthlyQuotas) ? monthlyQuotas : [],
          pausedDays: pausedDays && typeof pausedDays === 'object' ? pausedDays : {},
          needsRescheduling: Array.isArray(needsRescheduling) ? needsRescheduling : [],
          routines: Array.isArray(routines) ? routines : [],
          updatedAt: new Date().toISOString(),
        }, { merge: true });
        setCloudSaveStatus('saved');
        if (savedIdleTimeoutRef.current) clearTimeout(savedIdleTimeoutRef.current);
        savedIdleTimeoutRef.current = setTimeout(() => setCloudSaveStatus('idle'), 2500);
      } catch (e) {
        console.warn('GardenContext: failed to save to cloud', e);
        setCloudSaveStatus('idle');
      }
    }, CLOUD_DEBOUNCE_MS);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      if (savedIdleTimeoutRef.current) {
        clearTimeout(savedIdleTimeoutRef.current);
        savedIdleTimeoutRef.current = null;
      }
    };
  }, [hydrated, googleUser?.uid, goals, weeklyEvents, userSettings, dailyEnergyModifier, dailySpoonCount, lastCheckInDate, lastSundayRitualDate, weeklyNorthStarId, logs, spiritConfig, compost, soilNutrients, spiritPoints, embers, decorations, ownedSeeds, terrainMap, unlockedAnimals, metrics, fertilizerCount, waterDrops, monthlyQuotas, pausedDays, needsRescheduling, routines]);

  const addLog = useCallback((log) => {
    const mins = Number(log?.minutes) || 0;
    if (mins > 0) setSpiritPoints((p) => p + mins);
    setLogs((prev) => [...prev, { ...log, date: log.date instanceof Date ? log.date.toISOString() : log.date }]);
    if (log?.vibe && (log.vibe === 'energizer' || log.vibe === 'drainer') && googleUser?.uid && log?.taskTitle) {
      recordVibe(googleUser.uid, log.taskTitle, log.vibe, log.energyCost).catch(() => {});
    }
  }, [googleUser?.uid]);

  const DECORATION_COSTS = { lantern: 15, bench: 25, pond: 40, path: 10, bush: 20 };

  /** Add a decoration without spending. Use with spendEmbers(cost) for purchasing. */
  const placeDecoration = useCallback((type, x, y, variant) => {
    const id = crypto.randomUUID?.() ?? `dec-${Date.now()}`;
    setDecorations((prev) => [
      ...prev,
      { id, type, x: x ?? '50%', y: y ?? '50%', ...(variant != null ? { variant } : {}) },
    ]);
  }, []);

  /** Buy an item from the shop: deduct price; if type === 'seed' add to ownedSeeds, else add decoration. Returns true if purchased. */
  const buyItem = useCallback((item) => {
    const price = Number(item?.price ?? item?.cost ?? 0);
    if (price <= 0 || embers < price) return false;
    setEmbers((p) => p - price);
    if (item?.type === 'seed' && item?.id) {
      setOwnedSeeds((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]));
      return true;
    }
    const id = crypto.randomUUID?.() ?? `dec-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const type = item?.type ?? 'path';
    setDecorations((prev) => [...prev, { id, type, x: '50%', y: '50%' }]);
    return true;
  }, [embers]);

  /** Paint a 1x1 tile at grid (x, z). If material is 'grass' (default), remove the key to save space; else set terrainMap[key] = material. */
  const paintTerrain = useCallback((x, z, material = 'grass') => {
    const key = `${x},${z}`;
    if (material === 'grass') {
      setTerrainMap((prev) => {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } else {
      setTerrainMap((prev) => ({ ...prev, [key]: material }));
    }
  }, []);

  /** Deduct embers only if balance is sufficient. Returns true if deduction was made, false otherwise. */
  const spendEmbers = useCallback((amount) => {
    const n = Number(amount) || 0;
    if (n <= 0) return true;
    if (embers < n) return false;
    setEmbers((p) => p - n);
    return true;
  }, [embers]);

  /** Add embers (e.g. reward from Tea Ceremony session). */
  const earnEmbers = useCallback((amount) => {
    const n = Number(amount) || 0;
    if (n > 0) setEmbers((p) => p + n);
  }, []);

  /** Unlock an animal (e.g. after buying from shop). */
  const addUnlockedAnimal = useCallback((animal) => {
    if (!animal || typeof animal !== 'string') return;
    setUnlockedAnimals((prev) => (prev.includes(animal) ? prev : [...prev, animal]));
  }, []);

  const buyDecoration = useCallback((type) => {
    const cost = DECORATION_COSTS[type] ?? 0;
    if (embers < cost) return;
    setEmbers((p) => p - cost);
    placeDecoration(type, '50%', '50%');
  }, [embers, placeDecoration]);

  const addDecoration = useCallback((typeOrPayload, x, y) => {
    // New 3D decorations from shop: addDecoration({ name, model }) — no position yet (inventory). Shop calls spendEmbers separately.
    if (typeOrPayload && typeof typeOrPayload === 'object' && typeOrPayload.name != null && typeOrPayload.model != null) {
      const { name, model, id: payloadId } = typeOrPayload;
      const id = payloadId ?? crypto.randomUUID?.() ?? `dec-${Date.now()}`;
      setDecorations((prev) => [...prev, { id, name, model, type: 'decoration' }]);
      return;
    }
    const type = typeOrPayload;
    const cost = DECORATION_COSTS[type] ?? 0;
    if (embers < cost) return;
    setEmbers((p) => p - cost);
    placeDecoration(type, x, y);
  }, [embers, placeDecoration]);

  const updateDecoration = useCallback((id, updates) => {
    setDecorations((prev) => prev.map((d) => (d.id === id ? { ...d, ...updates } : d)));
  }, []);

  const updateDecorationPosition = useCallback((id, x, y) => {
    setDecorations((prev) => prev.map((d) => (d.id === id ? { ...d, x, y } : d)));
  }, []);

  const removeDecoration = useCallback((id) => {
    setDecorations((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const spendSpiritPoints = useCallback((amount) => {
    const n = Number(amount) || 0;
    setSpiritPoints((p) => (p >= n ? p - n : p));
  }, []);

  const consumeSoilNutrients = useCallback((amount = 1) => {
    const n = Math.max(0, Math.floor(Number(amount) || 0));
    if (n <= 0) return true;
    let didConsume = false;
    setSoilNutrients((prev) => {
      if (prev >= n) {
        didConsume = true;
        return prev - n;
      }
      return prev;
    });
    return didConsume;
  }, []);

  // Gardener: on app open, if it's a new day → archive yesterday's tasks to Goal Bank (compost), clear today's assignments, reset evening mode. Morning check-in shows automatically (lastCheckInDate !== today).
  const gardenerHasRunRef = useRef(false);
  const gardenerArchivedRef = useRef(false);
  useEffect(() => {
    if (!hydrated) return;
    const today = planDate;
    const lastOpen = typeof localStorage !== 'undefined' ? localStorage.getItem(LAST_OPEN_DATE_KEY) : null;
    const isNewDay = !lastOpen || lastOpen < today;

    if (!isNewDay) {
      try {
        localStorage.setItem(LAST_OPEN_DATE_KEY, today);
      } catch (_) {}
      return;
    }

    const uid = googleUser?.uid;

    if (!gardenerHasRunRef.current) {
      gardenerHasRunRef.current = true;
      setAssignments({});
      setEveningMode('none');
      try {
        localStorage.setItem(LAST_OPEN_DATE_KEY, today);
      } catch (_) {}
    }

    const archiveYesterday = async () => {
      if (!uid || gardenerArchivedRef.current) return;
      gardenerArchivedRef.current = true;
      const yesterdayD = new Date(today + 'T12:00:00');
      yesterdayD.setDate(yesterdayD.getDate() - 1);
      const yesterday = localISODate(yesterdayD);
      try {
        const { assignments: yesterdayAssignments } = await getDailyPlan(uid, yesterday);
        if (yesterdayAssignments && typeof yesterdayAssignments === 'object' && Object.keys(yesterdayAssignments).length > 0) {
          const getGoalId = (a) => {
            if (a == null) return null;
            if (typeof a === 'string') return a;
            return a.goalId ?? a.parentGoalId ?? null;
          };
          const getTitle = (a, goalId) => {
            if (a && typeof a === 'object' && a.title) return a.title;
            const g = (goals ?? []).find((goal) => goal.id === goalId);
            return g?.title ?? goalId ?? 'Task';
          };
          const titles = new Set();
          const allYesterday = Object.values(yesterdayAssignments).flatMap((val) =>
            Array.isArray(val) ? val : val != null ? [val] : []
          );
          allYesterday.forEach((val) => {
            const goalId = getGoalId(val);
            const title = getTitle(val, goalId);
            if (title && !titles.has(title)) {
              titles.add(title);
              addToCompost(title);
            }
          });
        }
      } catch (e) {
        console.warn('Gardener: failed to archive yesterday plan', e);
      }
    };

    archiveYesterday();
  }, [hydrated, googleUser?.uid, goals, addToCompost, planDate]);

  /** Archive current plan into compost and clear assignments (no lastCheckInDate change). Used for missed-day flow before choosing 1/3/0 spoons. */
  const archivePlanToCompost = useCallback(() => {
    const getGoalId = (a) => {
      if (a == null) return null;
      if (typeof a === 'string') return a;
      return a?.goalId ?? a?.parentGoalId ?? null;
    };
    const getTitle = (a, goalId) => {
      if (a && typeof a === 'object' && a.title) return a.title;
      const g = (goals ?? []).find((goal) => goal.id === goalId);
      return g?.title ?? goalId ?? 'Task';
    };
    const titles = new Set();
    const allAssignments = Object.values(assignments || {}).flatMap((val) =>
      Array.isArray(val) ? val : val != null ? [val] : []
    );
    allAssignments.forEach((val) => {
      const goalId = getGoalId(val);
      const title = getTitle(val, goalId);
      if (title && !titles.has(title)) {
        titles.add(title);
        addToCompost(title);
      }
    });
    setAssignments({});
  }, [assignments, goals, addToCompost, setAssignments]);

  /** Shame-free reset: archive current plan into compost, clear today's plan, show morning check-in again. */
  const gentleResetToToday = useCallback(({ gapDays } = {}) => {
    const getGoalId = (a) => {
      if (a == null) return null;
      if (typeof a === 'string') return a;
      return a?.goalId ?? a?.parentGoalId ?? null;
    };
    const getTitle = (a, goalId) => {
      if (a && typeof a === 'object' && a.title) return a.title;
      const g = (goals ?? []).find((goal) => goal.id === goalId);
      return g?.title ?? goalId ?? 'Task';
    };
    const titles = new Set();
    const allAssignments = Object.values(assignments || {}).flatMap((val) =>
      Array.isArray(val) ? val : val != null ? [val] : []
    );
    allAssignments.forEach((val) => {
      const goalId = getGoalId(val);
      const title = getTitle(val, goalId);
      if (title && !titles.has(title)) {
        titles.add(title);
        addToCompost(title);
      }
    });
    if (titles.size === 0) {
      addToCompost('Gentle restart: archived unfinished items from the last session.');
    }
    setAssignments({});
    setLastCheckInDate(yesterdayString());
    const today = planDate;
    const uid = googleUser?.uid;
    if (uid) {
      saveDailyPlan(uid, today, {}).catch((e) => console.warn('gentleResetToToday: saveDailyPlan failed', e));
    }
  }, [assignments, goals, addToCompost, setAssignments, googleUser?.uid]);

  /** Archive plan items from past dates into compost so today stays light. Returns count archived. */
  const archiveStalePlanItems = useCallback(async ({ olderThanDays = 1 } = {}) => {
    const uid = googleUser?.uid;
    if (!uid || olderThanDays < 1) return 0;
    const today = planDate;
    const getGoalId = (a) => {
      if (a == null) return null;
      if (typeof a === 'string') return a;
      return a?.goalId ?? a?.parentGoalId ?? null;
    };
    const getTitle = (a, goalId) => {
      if (a && typeof a === 'object' && a.title) return a.title;
      const g = (goals ?? []).find((goal) => goal.id === goalId);
      return g?.title ?? goalId ?? 'Task';
    };
    let totalArchived = 0;
    for (let d = 1; d <= olderThanDays; d++) {
      const past = new Date(today + 'T12:00:00');
      past.setDate(past.getDate() - d);
      const dateStr = localISODate(past);
      try {
        const { assignments: dayAssignments } = await getDailyPlan(uid, dateStr);
        if (!dayAssignments || typeof dayAssignments !== 'object') continue;
        const titles = new Set();
        const allDay = Object.values(dayAssignments).flatMap((val) =>
          Array.isArray(val) ? val : val != null ? [val] : []
        );
        allDay.forEach((val) => {
          const goalId = getGoalId(val);
          const title = getTitle(val, goalId);
          if (title && !titles.has(title)) {
            titles.add(title);
            addToCompost(title);
            totalArchived += 1;
          }
        });
        await saveDailyPlan(uid, dateStr, {});
      } catch (e) {
        console.warn('archiveStalePlanItems: failed for', dateStr, e);
      }
    }
    return totalArchived;
  }, [googleUser?.uid, goals, addToCompost]);

  /** Critical Mass: soft tasks pushed 3+ days → compost; maintenance (maxDelay 1–2) exceeded → escalate to fixed with warning. */
  const runCriticalMassCheck = useCallback(async () => {
    const uid = googleUser?.uid;
    if (!uid || !planDate) return { composted: 0, escalated: 0 };
    const getGoalId = (a) => {
      if (a == null) return null;
      if (typeof a === 'string') return a;
      return a?.goalId ?? a?.parentGoalId ?? null;
    };
    const earliestByGoal = new Map();
    for (let d = 1; d <= 5; d++) {
      const past = new Date(planDate + 'T12:00:00');
      past.setDate(past.getDate() - d);
      const dateStr = localISODate(past);
      try {
        const { assignments: dayAssignments } = await getDailyPlan(uid, dateStr);
        if (!dayAssignments || typeof dayAssignments !== 'object') continue;
        const allDay = Object.values(dayAssignments).flatMap((val) =>
          Array.isArray(val) ? val : val != null ? [val] : []
        );
        allDay.forEach((val) => {
          const goalId = getGoalId(val);
          if (goalId) {
            const cur = earliestByGoal.get(goalId);
            if (!cur || dateStr < cur) earliestByGoal.set(goalId, dateStr);
          }
        });
      } catch (_) {}
    }
    let composted = 0;
    let escalated = 0;
    const goalsList = goals ?? [];
    for (const goal of goalsList) {
      const earliest = earliestByGoal.get(goal.id);
      if (!earliest) continue;
      const daysAgo = Math.floor((new Date(planDate + 'T12:00:00') - new Date(earliest + 'T12:00:00')) / 864e5);
      const maxD = goal.maxDelay != null ? goal.maxDelay : null;
      const isSoft = maxD == null || maxD >= 3;
      const isMaintenance = maxD === 1 || maxD === 2;
      if (isSoft && daysAgo >= 3) {
        addToCompost(goal.title ?? 'Task');
        deleteGoal(goal.id);
        setAssignments((prev) => {
          const result = {};
          let changed = false;
          if ('anytime' in prev) {
            const list = (prev.anytime ?? []).filter((a) => getGoalId(a) !== goal.id);
            if (list.length !== (prev.anytime ?? []).length) changed = true;
            result.anytime = list;
          }
          for (const key of Object.keys(prev).filter((k) => k !== 'anytime')) {
            const canon = toCanonicalSlotKey(key);
            if (!canon) continue;
            const raw = prev[key];
            const list = Array.isArray(raw) ? raw : raw != null ? [raw] : [];
            const filtered = list.filter((a) => getGoalId(a) !== goal.id);
            if (filtered.length !== list.length) changed = true;
            if (result[canon] !== undefined) {
              result[canon] = [...(Array.isArray(result[canon]) ? result[canon] : [result[canon]]), ...filtered];
            } else {
              result[canon] = filtered.length > 0 ? filtered : [];
            }
          }
          return changed ? result : prev;
        });
        composted++;
      } else if (isMaintenance && daysAgo > maxD) {
        editGoal(goal.id, { isFixed: true, criticalMass: true });
        escalated++;
      }
    }
    return { composted, escalated };
  }, [googleUser?.uid, planDate, goals, addToCompost, deleteGoal, editGoal, setAssignments]);

  const FERTILIZER_BONUS_MINUTES = 15;

  /** Add a goal. Preserves optional domain-support fields: supportDomain, linkedToGoalId (backward compatible). */
  const addGoal = useCallback((goal) => {
    const type = goal.type === 'routine' ? 'routine' : goal.type === 'vitality' ? 'vitality' : goal.type === 'volume' ? 'volume' : 'kaizen';
    const milestones = type === 'routine' || type === 'vitality' || type === 'volume'
      ? []
      : (Array.isArray(goal.milestones) ? goal.milestones : (goal.milestones ? [goal.milestones] : []));
    const subtasks = Array.isArray(goal.subtasks) ? goal.subtasks : [];
    const maxDelay = goal.maxDelay != null ? goal.maxDelay : (type === 'routine' && goal.category === '🧹 Household' ? 2 : null);
    setGoals((prev) => [...prev, {
      ...goal,
      type,
      totalMinutes: goal.totalMinutes ?? 0,
      createdAt: goal.createdAt ?? new Date().toISOString(),
      estimatedMinutes: goal.estimatedMinutes ?? 15,
      category: goal.category ?? null,
      maxDelay: maxDelay ?? goal.maxDelay,
      milestones,
      subtasks,
      ...(type === 'vitality' && { metrics: Array.isArray(goal.metrics) ? goal.metrics : [] }),
      ...(type === 'volume' && {
        targetMetric: goal.targetMetric ?? 'Hours',
        targetValue: goal.targetValue ?? 0,
        currentProgress: goal.currentProgress ?? 0,
        deadline: goal.deadline ?? null,
      }),
    }]);
  }, []);

  /** "1 Care, 1 Admin, 1 Goal" starter garden: one kaizen goal (with first step) + Care & Hygiene + Life Admin routines. */
  const initializeStarterGarden = useCallback((personalGoalTitle, aiStructure = null) => {
    const uid = () => crypto.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const now = new Date().toISOString();

    // 1. Personal Goal (from onboarding, optionally shaped by AI)
    addGoal({
      id: uid(),
      type: 'kaizen',
      title: personalGoalTitle || 'My First Journey',
      estimatedMinutes: aiStructure?.estimatedMinutes ?? 30,
      targetHours: aiStructure?.targetHours ?? 3,
      totalMinutes: 0,
      createdAt: now,
      subtasks: (aiStructure?.vines?.length
        ? aiStructure.vines.map((v) => ({ id: uid(), title: typeof v === 'string' ? v : v?.title ?? 'Step', estimatedHours: 0.1, completedHours: 0 }))
        : [{ id: uid(), title: 'Take the first 5-minute step', estimatedHours: 0.1, completedHours: 0 }]),
      rituals: (aiStructure?.rituals?.length ? aiStructure.rituals.map((r) => ({ ...r, id: uid() })) : []),
      milestones: (aiStructure?.milestones?.length ? aiStructure.milestones.map((m) => ({ id: uid(), title: typeof m === 'string' ? m : m?.title ?? '', completed: false })) : []),
    });

    // 2. Care & Hygiene (Concrete Daily Actions)
    addGoal({
      id: uid(),
      type: 'routine',
      title: 'Care & Hygiene',
      category: 'Care & Hygiene',
      estimatedMinutes: 5,
      totalMinutes: 0,
      createdAt: now,
      rituals: [
        { id: uid(), title: 'Morning: Brush teeth & drink 1 glass of water', days: [0, 1, 2, 3, 4, 5, 6] },
        { id: uid(), title: 'Evening: Wash face & brush teeth', days: [0, 1, 2, 3, 4, 5, 6] },
        { id: uid(), title: 'Shower', days: [0, 2, 4, 6] }, // Sun, Tue, Thu, Sat
        { id: uid(), title: '10-minute stretch or walk outside', days: [0, 1, 2, 3, 4, 5, 6] },
      ],
    });

    // 3. Life Admin (Concrete Maintenance Actions)
    addGoal({
      id: uid(),
      type: 'routine',
      title: 'Life Admin',
      category: 'Life Admin',
      estimatedMinutes: 5,
      totalMinutes: 0,
      createdAt: now,
      rituals: [
        { id: uid(), title: 'Clear email & messages for 5 mins', days: [1, 2, 3, 4, 5] }, // Weekdays
        { id: uid(), title: 'Tidy desk/kitchen for 5 mins', days: [0, 1, 2, 3, 4, 5, 6] }, // Everyday
        { id: uid(), title: 'Plan the upcoming week', days: [0] }, // Sundays
      ],
    });
  }, [addGoal]);

  /** If the garden is empty, plant a single tutorial Kaizen goal so new users have something to try. Call after onboarding/tour. */
  const plantTutorialSeed = useCallback(() => {
    if (goals.length !== 0) return;
    const uid = () => crypto.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    addGoal({
      id: uid(),
      type: 'kaizen',
      title: "🌱 Learn how to use Mochi's Garden",
      estimatedMinutes: 15,
      targetHours: 1,
      subtasks: [
        { id: uid(), title: 'Drag this goal into a time slot today', estimatedHours: 0.5, completedHours: 0 },
        { id: uid(), title: 'Click "Start 5 min" on this task', estimatedHours: 0.5, completedHours: 0 },
        { id: uid(), title: 'Dump a random thought in the Compost Heap', estimatedHours: 0.5, completedHours: 0 },
      ],
    });
  }, [goals.length, addGoal]);

  /** Add a subtask (project) to a goal. Schema: { id, title, estimatedHours, completedHours, deadline, color, phaseId?, weekRange?, days? } — days = [0..6] for per-task recurrence (routines). */
  const addSubtask = useCallback((goalId, subtask) => {
    const sub = {
      id: subtask.id ?? `st-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      title: subtask.title ?? 'Task',
      estimatedHours: Number(subtask.estimatedHours) ?? 1,
      completedHours: Number(subtask.completedHours) ?? 0,
      deadline: subtask.deadline ?? null,
      color: subtask.color ?? null,
      phaseId: subtask.phaseId ?? null,
      weekRange: subtask.weekRange ?? null,
      ...(Array.isArray(subtask.days) && subtask.days.length > 0 ? { days: subtask.days } : {}),
    };
    setGoals((prev) =>
      prev.map((g) =>
        g.id === goalId
          ? { ...g, subtasks: [...(g.subtasks ?? []), sub] }
          : g
      )
    );
  }, []);

  const updateSubtask = useCallback((goalId, subtaskId, updates) => {
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== goalId || !Array.isArray(g.subtasks)) return g;
        return {
          ...g,
          subtasks: g.subtasks.map((s) =>
            s.id === subtaskId ? { ...s, ...updates } : s
          ),
        };
      })
    );
  }, []);

  const deleteSubtask = useCallback((goalId, subtaskId) => {
    setGoals((prev) =>
      prev.map((g) =>
        g.id === goalId && Array.isArray(g.subtasks)
          ? { ...g, subtasks: g.subtasks.filter((s) => s.id !== subtaskId) }
          : g
      )
    );
  }, []);

  /** Add completed hours to a subtask (e.g. after focus session). */
  const updateSubtaskProgress = useCallback((goalId, subtaskId, addHours) => {
    const hrs = Number(addHours) || 0;
    if (hrs <= 0) return;
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== goalId || !Array.isArray(g.subtasks)) return g;
        return {
          ...g,
          subtasks: g.subtasks.map((s) => {
            if (s.id !== subtaskId) return s;
            const completed = (Number(s.completedHours) || 0) + hrs;
            const estimated = Number(s.estimatedHours) || 0;
            return { ...s, completedHours: Math.min(completed, estimated) };
          }),
        };
      })
    );
  }, []);

  const updateGoalProgress = useCallback((goalId, minutes) => {
    const mins = Number(minutes) || 0;
    setGoals((prev) =>
      prev.map((g) =>
        g.id === goalId ? { ...g, totalMinutes: (g.totalMinutes ?? 0) + mins } : g
      )
    );
  }, []);

  const updateGoalMilestone = useCallback((goalId, milestoneId, completed) => {
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== goalId) return g;
        const milestones = (g.milestones ?? []).map((m) =>
          m.id === milestoneId ? { ...m, completed: !!completed } : m
        );
        const modifier = completed ? FERTILIZER_BONUS_MINUTES : -FERTILIZER_BONUS_MINUTES;
        return {
          ...g,
          milestones,
          totalMinutes: Math.max(0, (g.totalMinutes ?? 0) + modifier),
        };
      })
    );
  }, []);

  const toggleMilestone = useCallback((goalId, milestoneId) => {
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== goalId) return g;

        let isNowCompleted = false;

        const milestones = (g.milestones || []).map((m) => {
          if (m.id !== milestoneId) return m;
          isNowCompleted = !m.completed; // Flip value
          return { ...m, completed: isNowCompleted };
        });

        // Infinite Kaizen: Auto-sprout next milestone if all are done
        if (isNowCompleted && !g._projectGoal) {
          const allDone = milestones.every((m) => m.completed);
          if (allDone) {
            milestones.push({
              id: crypto.randomUUID?.() ?? `ms-${Date.now()}`,
              title: 'Kaizen: Increase your previous time by 5 minutes',
              completed: false,
            });
          }
        }

        // If we just checked it -> Add bonus. If unchecked -> Remove bonus.
        const modifier = isNowCompleted ? FERTILIZER_BONUS_MINUTES : -FERTILIZER_BONUS_MINUTES;

        return {
          ...g,
          milestones,
          totalMinutes: Math.max(0, (g.totalMinutes || 0) + modifier)
        };
      })
    );
  }, []);

  /** Update a single milestone (phase) on a project goal. */
  const updateMilestone = useCallback((goalId, milestoneId, updates) => {
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== goalId || !Array.isArray(g.milestones)) return g;
        return {
          ...g,
          milestones: g.milestones.map((m) => (m.id === milestoneId ? { ...m, ...updates } : m)),
        };
      })
    );
  }, []);

  /** Add a milestone (phase) to a project goal. */
  const addMilestone = useCallback((goalId, milestone) => {
    const uid = () => crypto.randomUUID?.() ?? `ms-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const m = {
      id: milestone?.id ?? uid(),
      title: milestone?.title ?? 'New phase',
      weekRange: milestone?.weekRange ?? 'Week 1',
      completed: milestone?.completed ?? false,
    };
    setGoals((prev) =>
      prev.map((g) => (g.id === goalId ? { ...g, milestones: [...(g.milestones ?? []), m] } : g))
    );
  }, []);

  /** Delete a milestone and any subtasks linked to it. */
  const deleteMilestone = useCallback((goalId, milestoneId) => {
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== goalId) return g;
        const milestones = (g.milestones ?? []).filter((m) => m.id !== milestoneId);
        const subtasks = (g.subtasks ?? []).filter((s) => s.phaseId !== milestoneId);
        return { ...g, milestones, subtasks };
      })
    );
  }, []);

  /** Update a single task inside narrativeBreakdown.milestones[mi].tasks[ti] (notes, subTasks, title, etc.). */
  const updateNarrativeTask = useCallback((goalId, milestoneIndex, taskIndex, updates) => {
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== goalId || !g.narrativeBreakdown?.milestones) return g;
        const milestones = g.narrativeBreakdown.milestones.map((m, mi) => {
          if (mi !== milestoneIndex || !Array.isArray(m.tasks)) return m;
          return {
            ...m,
            tasks: m.tasks.map((t, ti) => (ti !== taskIndex ? t : { ...t, ...updates })),
          };
        });
        return { ...g, narrativeBreakdown: { ...g.narrativeBreakdown, milestones } };
      })
    );
  }, []);

  const updateWeeklyEvents = useCallback((events) => {
    const list = Array.isArray(events) ? events : events?.events ?? [];
    setWeeklyEvents(list);
  }, []);

  /** Spend one fertilizer bag on a goal: reduce its target by 10% so progress bar jumps forward. Returns true if applied. */
  const fertilizeGoal = useCallback((goalId) => {
    if (fertilizerCount < 1) return false;
    const goal = goals.find((g) => g.id === goalId);
    if (!goal) return false;
    setFertilizerCount((prev) => Math.max(0, prev - 1));
    const targetH = Number(goal.targetHours);
    const estM = Number(goal.estimatedMinutes);
    if (targetH > 0) {
      const next = Math.max(0.1, targetH * 0.9);
      editGoal(goalId, { targetHours: Math.round(next * 10) / 10 });
    } else if (estM > 0) {
      const next = Math.max(1, Math.round(estM * 0.9));
      editGoal(goalId, { estimatedMinutes: next });
    }
    return true;
  }, [goals, fertilizerCount, editGoal]);

  /** Add water drops (e.g. when a task is completed in TimeSlicer). */
  const addWater = useCallback((amount) => {
    setWaterDrops((prev) => prev + amount);
  }, []);

  /** Water a goal: requires 1 water drop, sets lastWatered and rewards +5 Embers. */
  const waterGoal = useCallback((goalId) => {
    if (waterDrops <= 0) throw new Error('No water left');
    setWaterDrops((prev) => Math.max(0, prev - 1));
    editGoal(goalId, { lastWatered: new Date().toISOString() });
    earnEmbers(5);
  }, [waterDrops, editGoal, earnEmbers]);

  /** Append a metric log to a goal's metrics array and history (for vitality graphing). date defaults to today. */
  const logMetric = useCallback((goalId, value, date) => {
    const dateObj = date instanceof Date ? date : date != null ? new Date(date) : new Date();
    const dateStr = localISODate(dateObj);
    const newValue = Number(value);
    const nowIso = new Date().toISOString();
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== goalId) return g;
        const metrics = Array.isArray(g.metrics) ? [...g.metrics] : [];
        metrics.push({ value: newValue, date: dateStr });
        const history = [...(g.history || []), { date: nowIso, value: newValue }];
        return { ...g, metrics, history };
      })
    );
  }, []);

  const completeMorningCheckIn = useCallback((energyLevelOrModifier) => {
    const n = Number(energyLevelOrModifier);
    let spoonCount = null;
    let energyModifier = null;
    if (n >= 1 && n <= 10) {
      setDailySpoonCount(n);
      setDailyEnergyModifier(0);
      spoonCount = n;
    } else if (n === 0) {
      setDailySpoonCount(0);
      setDailyEnergyModifier(0);
      spoonCount = 0;
    } else {
      setDailyEnergyModifier(n);
      energyModifier = n;
    }
    setLastCheckInDate(planDate);
    const uid = googleUser?.uid;
    if (uid && planDate) {
      saveCheckInForDate(uid, planDate, { spoonCount, energyModifier }).catch((e) => console.warn('saveCheckInForDate failed', e));
    }
  }, [googleUser?.uid, planDate]);

  const markSundayRitualComplete = useCallback(() => {
    setLastSundayRitualDate(getThisWeekSundayLocal());
  }, []);

  const setSpiritConfig = useCallback((config) => {
    setSpiritConfigState(config && typeof config === 'object' ? config : null);
  }, []);

  /** Add a metric (e.g. "Steps", "Sleep hours") for vitality tracking. */
  const addMetric = useCallback((name) => {
    const trimmed = typeof name === 'string' ? name.trim() : '';
    if (!trimmed) return null;
    const id = crypto.randomUUID?.() ?? `m-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setMetrics((prev) => [...prev, { id, name: trimmed }]);
    return id;
  }, []);

  /** Add a ritual category name (e.g. "Sunday Reset") so it appears in the Ritual dropdown for future goals. */
  const addRitualCategory = useCallback((name) => {
    const trimmed = typeof name === 'string' ? name.trim() : '';
    if (!trimmed) return;
    setUserSettings((prev) => {
      const list = Array.isArray(prev.ritualCategories) ? prev.ritualCategories : [];
      if (list.some((n) => String(n).trim().toLowerCase() === trimmed.toLowerCase())) return prev;
      return { ...prev, ritualCategories: [...list, trimmed] };
    });
  }, []);

  /** Update user settings (scheduling, etc.). Merges partial updates; workHours is deep-merged so partial workHours updates do not wipe the rest. */
  const updateUserSettings = useCallback((updates) => {
    if (!updates || typeof updates !== 'object') return;
    setUserSettings((prev) => {
      const next = { ...prev, ...updates };
      if (updates.workHours && typeof updates.workHours === 'object') {
        next.workHours = { ...(prev.workHours || {}), ...updates.workHours };
      }
      return next;
    });
  }, []);

  /** Update position for any placeable object key ("goal:<id>", "decoration:<id>", "shop-stand"). */
  const updateObjectPosition = useCallback((objectKey, newX, newZ) => {
    if (!objectKey) return;
    const x = Math.round(Number(newX) || 0);
    const z = Math.round(Number(newZ) || 0);

    if (String(objectKey).startsWith('goal:')) {
      const id = String(objectKey).slice('goal:'.length);
      if (id) editGoal(id, { position3D: [x, 0, z] });
      return;
    }
    if (String(objectKey).startsWith('decoration:')) {
      const id = String(objectKey).slice('decoration:'.length);
      if (id) updateDecoration(id, { position3D: [x, 0, z] });
      return;
    }
    if (String(objectKey) === 'shop-stand') {
      setUserSettings((prev) => ({
        ...prev,
        gardenLayout: {
          ...(prev?.gardenLayout || {}),
          shopStandPosition3D: [x, 0, z],
        },
      }));
    }
  }, [editGoal, updateDecoration]);

  /** Add a monthly quota (e.g. Freelance Client, targetHours). */
  const addMonthlyQuota = useCallback((quota) => {
    const id = quota?.id ?? crypto.randomUUID?.() ?? `quota-${Date.now()}`;
    const entry = {
      id,
      name: typeof quota?.name === 'string' ? quota.name : 'Quota',
      targetHours: Number(quota?.targetHours) || 0,
      loggedHours: Number(quota?.loggedHours) || 0,
      blocks: Array.isArray(quota?.blocks) ? quota.blocks : [],
    };
    setMonthlyQuotas((prev) => [...prev, entry]);
    return id;
  }, []);

  /** Update a monthly quota by id. */
  const updateMonthlyQuota = useCallback((id, updates) => {
    setMonthlyQuotas((prev) =>
      prev.map((q) => (q.id === id ? { ...q, ...updates } : q))
    );
  }, []);

  /** Add a routine template (micro-habit). */
  const addRoutine = useCallback((routine) => {
    const id = routine?.id ?? crypto.randomUUID?.() ?? `r-${Date.now()}`;
    const entry = {
      id,
      title: typeof routine?.title === 'string' ? routine.title : 'Routine',
      category: typeof routine?.category === 'string' ? routine.category : '📋 Other',
      duration: Math.max(1, Math.min(120, Number(routine?.duration) || 5)),
    };
    setRoutines((prev) => [...prev, entry]);
    return id;
  }, []);

  /** Update a routine by id. Safe merge: existing routine spread first, then updates; duration is clamped 1–120. */
  const updateRoutine = useCallback((id, updates) => {
    setRoutines((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, ...updates, duration: Math.max(1, Math.min(120, Number(updates.duration ?? r.duration) || 5)) }
          : r
      )
    );
  }, []);

  /** Delete a routine by id. */
  const deleteRoutine = useCallback((id) => {
    setRoutines((prev) => prev.filter((r) => r.id !== id));
  }, []);

  /** Import garden data from JSON (e.g. backup). Merges into state; persist effects will save to localStorage/Firestore. */
  const importGardenData = useCallback((data) => {
    if (!data || typeof data !== 'object') return;
    if (Array.isArray(data.goals)) setGoals(data.goals);
    if (Array.isArray(data.weeklyEvents)) setWeeklyEvents(data.weeklyEvents);
    if (data.userSettings && typeof data.userSettings === 'object') setUserSettings(data.userSettings);
    if (typeof data.dailyEnergyModifier === 'number') setDailyEnergyModifier(data.dailyEnergyModifier);
    if (typeof data.dailySpoonCount === 'number' && data.dailySpoonCount >= 0 && data.dailySpoonCount <= 12) setDailySpoonCount(data.dailySpoonCount);
    if (data.lastCheckInDate != null) setLastCheckInDate(data.lastCheckInDate);
    if (data.lastSundayRitualDate != null) setLastSundayRitualDate(data.lastSundayRitualDate);
    if (data.weeklyNorthStarId != null) setWeeklyNorthStarId(data.weeklyNorthStarId);
    if (Array.isArray(data.logs)) setLogs(data.logs);
    if (data.spiritConfig !== undefined) setSpiritConfigState(data.spiritConfig && typeof data.spiritConfig === 'object' ? data.spiritConfig : null);
    if (Array.isArray(data.compost)) setCompost(data.compost);
    if (typeof data.soilNutrients === 'number') setSoilNutrients(Math.min(20, Math.max(0, data.soilNutrients)));
    if (typeof data.spiritPoints === 'number') setSpiritPoints(data.spiritPoints);
    if (typeof data.embers === 'number') setEmbers(data.embers);
    if (Array.isArray(data.decorations)) setDecorations(data.decorations);
    if (Array.isArray(data.ownedSeeds)) setOwnedSeeds(data.ownedSeeds);
    if (data.terrainMap && typeof data.terrainMap === 'object') setTerrainMap(data.terrainMap);
    if (Array.isArray(data.unlockedAnimals)) setUnlockedAnimals(data.unlockedAnimals);
    if (Array.isArray(data.metrics)) setMetrics(data.metrics);
    if (typeof data.fertilizerCount === 'number' && data.fertilizerCount >= 0) setFertilizerCount(data.fertilizerCount);
    if (typeof data.waterDrops === 'number' && data.waterDrops >= 0) setWaterDrops(data.waterDrops);
    if (Array.isArray(data.monthlyQuotas)) setMonthlyQuotas(data.monthlyQuotas);
    if (Array.isArray(data.routines)) setRoutines(data.routines);
    if (data.pausedDays && typeof data.pausedDays === 'object') setPausedDays(data.pausedDays);
    if (Array.isArray(data.needsRescheduling)) setNeedsRescheduling(data.needsRescheduling);
  }, []);

  /** Clear all garden data (localStorage + in-memory; if logged in, overwrite Firestore with default). */
  const deleteAllData = useCallback(async () => {
    setGoals(defaultData.goals);
    setWeeklyEvents(defaultData.weeklyEvents);
    setUserSettings(defaultData.userSettings);
    setDailyEnergyModifier(defaultData.dailyEnergyModifier);
    setDailySpoonCount(defaultData.dailySpoonCount);
    setLastCheckInDate(defaultData.lastCheckInDate);
    setLastSundayRitualDate(defaultData.lastSundayRitualDate);
    setWeeklyNorthStarId(defaultData.weeklyNorthStarId);
    setLogs(defaultData.logs);
    setSpiritConfigState(defaultData.spiritConfig);
    setCompost(defaultData.compost);
    setSoilNutrients(defaultData.soilNutrients ?? 0);
    setAssignments({});
    setSpiritPoints(defaultData.spiritPoints);
    setEmbers(defaultData.embers ?? 100);
    setDecorations(defaultData.decorations);
    setOwnedSeeds(defaultData.ownedSeeds ?? []);
    setTerrainMap(defaultData.terrainMap ?? {});
    setUnlockedAnimals(defaultData.unlockedAnimals ?? []);
    setMetrics(defaultData.metrics);
    setFertilizerCount(defaultData.fertilizerCount ?? 0);
    setWaterDrops(defaultData.waterDrops ?? 5);
    setMonthlyQuotas(defaultData.monthlyQuotas ?? []);
    setPausedDays(defaultData.pausedDays ?? {});
    setNeedsRescheduling(defaultData.needsRescheduling ?? []);
    setRoutines(defaultData.routines ?? []);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultData));
    } catch (e) {
      console.warn('GardenContext: failed to clear localStorage', e);
    }
    const uid = googleUser?.uid;
    if (uid) {
      try {
        const ref = doc(db, 'users', uid, 'garden', 'data');
        await setDoc(ref, { ...defaultData, updatedAt: new Date().toISOString() }, { merge: true });
        await saveDailyPlan(uid, planDate, {});
      } catch (e) {
        console.warn('GardenContext: failed to clear cloud data', e);
      }
    }
  }, [googleUser?.uid]);

  const value = {
    goals,
    weeklyEvents,
    userSettings,
    setUserSettings,
    updateUserSettings,
    dailyEnergyModifier,
    dailySpoonCount,
    lastCheckInDate,
    completeMorningCheckIn,
    hydrated,
    lastSundayRitualDate,
    markSundayRitualComplete,
    weeklyNorthStarId,
    setWeeklyNorthStarId,
    logs,
    addLog,
    logMetric,
    addGoal,
    plantTutorialSeed,
    initializeStarterGarden,
    updateGoalProgress,
    updateGoalMilestone,
    toggleMilestone,
    updateMilestone,
    addMilestone,
    deleteMilestone,
    updateNarrativeTask,
    updateWeeklyEvents,
    editGoal,
    deleteGoal,
    fertilizeGoal,
    waterGoal,
    fertilizerCount,
    waterDrops,
    setWaterDrops,
    addWater,
    addSubtask,
    updateSubtask,
    deleteSubtask,
    updateSubtaskProgress,
    googleUser,
    googleToken,
    connectCalendar,
    disconnectCalendar,
    msUser,
    msToken,
    connectOutlook,
    disconnectOutlook,
    refreshOutlookToken,
    cloudSaveStatus,
    spiritConfig,
    setSpiritConfig,
    compost,
    addToCompost,
    removeFromCompost,
    smallJoys,
    addSmallJoy,
    soilNutrients,
    consumeSoilNutrients,
    today: planDate,
    getCheckInHistory: useCallback(() => {
      const uid = googleUser?.uid;
      return uid ? getCheckInsForLastDays(uid, 7) : Promise.resolve([]);
    }, [googleUser?.uid]),
    assignments,
    setAssignments,
    gentleResetToToday,
    archivePlanToCompost,
    archiveStalePlanItems,
    runCriticalMassCheck,
    weekAssignments,
    setWeekAssignments,
    loadDayPlan,
    saveDayPlanForDate,
    loadWeekPlans,
    clearDaySchedule,
    rescheduleNeedsReschedulingItem,
    removeFromNeedsRescheduling,
    spawnedVolumeBlocks,
    addSpawnedVolumeBlocks,
    removeSpawnedVolumeBlock,
    stagingTaskStatus,
    setStagingTaskStatus,
    promoteTaskToThisWeek,
    pausedDays,
    needsRescheduling,
    eveningMode,
    setEveningMode,
    spiritPoints,
    embers,
    decorations,
    ownedSeeds,
    placeDecoration,
    buyDecoration,
    addDecoration,
    updateDecoration,
    updateDecorationPosition,
    removeDecoration,
    terrainMap,
    paintTerrain,
    activeTool,
    setActiveTool,
    tourStep,
    setTourStep,
    isArchitectMode,
    setIsArchitectMode,
    selectedObjectId,
    setSelectedObjectId,
    updateObjectPosition,
    unlockedAnimals,
    addUnlockedAnimal,
    spendEmbers,
    earnEmbers,
    buyItem,
    decorationCosts: { lantern: 15, bench: 25, pond: 40, path: 10, bush: 20 },
    metrics,
    addMetric,
    importGardenData,
    deleteAllData,
    addRitualCategory,
    monthlyQuotas,
    addMonthlyQuota,
    updateMonthlyQuota,
    routines,
    setRoutines,
    addRoutine,
    updateRoutine,
    deleteRoutine,
  };

  return (
    <GardenContext.Provider value={value}>
      {children}
    </GardenContext.Provider>
  );
}

export function useGarden() {
  const ctx = useContext(GardenContext);
  if (!ctx) throw new Error('useGarden must be used within GardenProvider');
  return ctx;
}