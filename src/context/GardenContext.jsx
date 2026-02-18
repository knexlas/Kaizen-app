import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { subscribeToCompost, addCompostItem, deleteCompostItem, subscribeToDailyPlan, saveDailyPlan, getDailyPlan } from '../firebase/services';
import { loginWithGoogle, logoutUser } from '../services/authService';
const STORAGE_KEY = 'gardenData';
const LAST_OPEN_DATE_KEY = 'gardenLastOpenDate';
const CLOUD_DEBOUNCE_MS = 2000;

function yesterdayString() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function todayString() {
  return new Date().toISOString().slice(0, 10);
}

const defaultData = {
  goals: [],
  weeklyEvents: [],
  userSettings: {},
  dailyEnergyModifier: 0,
  lastCheckInDate: null,
  lastSundayRitualDate: null,
  logs: [],
  spiritConfig: null, // { head, body, color, name } from Spirit Builder
  compost: [], // Inbox: { id, text, createdAt }
  spiritPoints: 0, // 1 per minute of focus
  decorations: [], // { id, type: 'lantern'|'bench'|'pond'|'path', x, y }
};

const GardenContext = createContext(null);

export function GardenProvider({ children }) {
  const [goals, setGoals] = useState(defaultData.goals);
  const [weeklyEvents, setWeeklyEvents] = useState(defaultData.weeklyEvents);
  const [userSettings, setUserSettings] = useState(defaultData.userSettings);
  const [dailyEnergyModifier, setDailyEnergyModifier] = useState(defaultData.dailyEnergyModifier);
  const [lastCheckInDate, setLastCheckInDate] = useState(defaultData.lastCheckInDate);
  const [lastSundayRitualDate, setLastSundayRitualDate] = useState(defaultData.lastSundayRitualDate);
  const [logs, setLogs] = useState(defaultData.logs);
  const [spiritConfig, setSpiritConfigState] = useState(defaultData.spiritConfig);
  const [compost, setCompost] = useState(defaultData.compost);
  const [assignments, setAssignments] = useState({}); // daily schedule { [hour]: goalId | assignmentObject }
  const [planDate, setPlanDate] = useState(() => todayString()); // current date for plan subscription (updates so we re-sub at midnight)
  const [eveningMode, setEveningMode] = useState('none'); // 'none' | 'sleep' | 'night-owl'
  const [spiritPoints, setSpiritPoints] = useState(defaultData.spiritPoints);
  const [decorations, setDecorations] = useState(defaultData.decorations);
  const [hydrated, setHydrated] = useState(false);
  const [cloudSaveStatus, setCloudSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved'
  const saveTimeoutRef = useRef(null);
  const savedIdleTimeoutRef = useRef(null);
  const skipCloudSaveUntilRef = useRef(0);

  const [googleUser, setGoogleUser] = useState(null);
  const [googleToken, setGoogleToken] = useState(null);

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

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (Array.isArray(data.goals)) setGoals(data.goals);
        if (Array.isArray(data.weeklyEvents)) setWeeklyEvents(data.weeklyEvents);
        if (data.userSettings && typeof data.userSettings === 'object') setUserSettings(data.userSettings);
        if (typeof data.dailyEnergyModifier === 'number') setDailyEnergyModifier(data.dailyEnergyModifier);
        if (data.lastCheckInDate != null) setLastCheckInDate(data.lastCheckInDate);
        if (data.lastSundayRitualDate != null) setLastSundayRitualDate(data.lastSundayRitualDate);
        if (Array.isArray(data.logs)) setLogs(data.logs);
        if (data.spiritConfig && typeof data.spiritConfig === 'object') setSpiritConfigState(data.spiritConfig);
        if (Array.isArray(data.compost)) setCompost(data.compost);
        if (typeof data.spiritPoints === 'number') setSpiritPoints(data.spiritPoints);
        if (Array.isArray(data.decorations)) setDecorations(data.decorations);
      }
    } catch (e) {
      console.warn('GardenContext: failed to load gardenData', e);
    }
    setHydrated(true);
  }, []);

  // Gardener: on app open, if it's a new day → archive yesterday's tasks to Goal Bank (compost), clear today's assignments, reset evening mode. Morning check-in shows automatically (lastCheckInDate !== today).
  const gardenerHasRunRef = useRef(false);
  const gardenerArchivedRef = useRef(false);
  useEffect(() => {
    if (!hydrated) return;
    const today = todayString();
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
      const yesterday = yesterdayString();
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
          Object.values(yesterdayAssignments).forEach((val) => {
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
  }, [hydrated, googleUser?.uid, goals, addToCompost]);

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
          if (Array.isArray(data.logs)) setLogs(data.logs);
          if (data.spiritConfig && typeof data.spiritConfig === 'object') setSpiritConfigState(data.spiritConfig);
          // Compost is sourced from subscribeToCompost when uid exists; do not overwrite from garden/data
          if (typeof data.spiritPoints === 'number') setSpiritPoints(data.spiritPoints);
          if (Array.isArray(data.decorations)) setDecorations(data.decorations);
          skipCloudSaveUntilRef.current = Date.now() + 3000;
        }
      } catch (e) {
        if (!cancelled) console.warn('GardenContext: failed to load from cloud', e);
      }
    })();
    return () => { cancelled = true; };
  }, [googleUser?.uid]);

  // Persist compost to Firebase: subscribe when logged in
  useEffect(() => {
    const uid = googleUser?.uid;
    if (!uid) return;
    const unsubscribe = subscribeToCompost(uid, setCompost);
    return () => unsubscribe();
  }, [googleUser?.uid]);

  // Keep plan date in sync so we re-subscribe at midnight
  useEffect(() => {
    const interval = setInterval(() => setPlanDate(todayString()), 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Subscribe to today's daily plan when logged in
  useEffect(() => {
    const uid = googleUser?.uid;
    if (!uid) return;
    const unsubscribe = subscribeToDailyPlan(uid, planDate, ({ assignments: next }) => {
      setAssignments(next && typeof next === 'object' ? next : {});
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

  // Save to localStorage when state changes
  useEffect(() => {
    if (!hydrated) return;
    try {
      const data = { goals, weeklyEvents, userSettings, dailyEnergyModifier, lastCheckInDate, lastSundayRitualDate, logs, spiritConfig, compost, spiritPoints, decorations };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('GardenContext: failed to save gardenData', e);
    }
  }, [hydrated, goals, weeklyEvents, userSettings, dailyEnergyModifier, lastCheckInDate, lastSundayRitualDate, logs, spiritConfig, compost, spiritPoints, decorations]);

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
          lastCheckInDate,
          lastSundayRitualDate,
          logs,
          spiritConfig: spiritConfig ?? null,
          compost: compost ?? [],
          spiritPoints: spiritPoints ?? 0,
          decorations: decorations ?? [],
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
  }, [hydrated, googleUser?.uid, goals, weeklyEvents, userSettings, dailyEnergyModifier, lastCheckInDate, lastSundayRitualDate, logs, spiritConfig, compost, spiritPoints, decorations]);

  const addLog = useCallback((log) => {
    const mins = Number(log?.minutes) || 0;
    if (mins > 0) setSpiritPoints((p) => p + mins);
    setLogs((prev) => [...prev, { ...log, date: log.date instanceof Date ? log.date.toISOString() : log.date }]);
  }, []);

  const DECORATION_COSTS = { lantern: 15, bench: 25, pond: 40, path: 10, bush: 20 };

  const buyDecoration = useCallback((type) => {
    const cost = DECORATION_COSTS[type] ?? 0;
    setSpiritPoints((p) => {
      if (p < cost) return p;
      setDecorations((prev) => [
        ...prev,
        { id: crypto.randomUUID?.() ?? `dec-${Date.now()}`, type, x: '50%', y: '50%' },
      ]);
      return p - cost;
    });
  }, []);

  const addDecoration = useCallback((type, x, y) => {
    const cost = DECORATION_COSTS[type] ?? 0;
    setSpiritPoints((p) => {
      if (p < cost) return p;
      setDecorations((prev) => [
        ...prev,
        { id: crypto.randomUUID?.() ?? `dec-${Date.now()}`, type, x: x ?? '50%', y: y ?? '50%' },
      ]);
      return p - cost;
    });
  }, []);

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

  const addToCompost = useCallback(
    async (text) => {
      const trimmed = (text || '').trim();
      if (!trimmed) return;
      const uid = googleUser?.uid;
      if (uid) {
        try {
          await addCompostItem(uid, trimmed);
        } catch (e) {
          console.warn('addCompostItem failed, using local state', e);
          const item = {
            id: crypto.randomUUID?.() ?? `compost-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            text: trimmed,
            createdAt: new Date().toISOString(),
          };
          setCompost((prev) => [item, ...prev]);
        }
      } else {
        const item = {
          id: crypto.randomUUID?.() ?? `compost-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          text: trimmed,
          createdAt: new Date().toISOString(),
        };
        setCompost((prev) => [item, ...prev]);
      }
    },
    [googleUser?.uid]
  );

  const removeFromCompost = useCallback(
    (id) => {
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

  const FERTILIZER_BONUS_MINUTES = 15;

  const addGoal = useCallback((goal) => {
    const type = goal.type === 'routine' ? 'routine' : goal.type === 'vitality' ? 'vitality' : 'kaizen';
    const milestones = type === 'routine' || type === 'vitality'
      ? []
      : (Array.isArray(goal.milestones) ? goal.milestones : (goal.milestones ? [goal.milestones] : []));
    const subtasks = Array.isArray(goal.subtasks) ? goal.subtasks : [];
    setGoals((prev) => [...prev, {
      ...goal,
      type,
      totalMinutes: goal.totalMinutes ?? 0,
      createdAt: goal.createdAt ?? new Date().toISOString(),
      milestones,
      subtasks,
      ...(type === 'vitality' && { metrics: Array.isArray(goal.metrics) ? goal.metrics : [] }),
    }]);
  }, []);

  /** Add a subtask (project) to a goal. Schema: { id, title, estimatedHours, completedHours, deadline, color } */
  const addSubtask = useCallback((goalId, subtask) => {
    const sub = {
      id: subtask.id ?? `st-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      title: subtask.title ?? 'Project',
      estimatedHours: Number(subtask.estimatedHours) || 0,
      completedHours: Number(subtask.completedHours) || 0,
      deadline: subtask.deadline ?? null,
      color: subtask.color ?? null,
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

        // If we just checked it -> Add bonus. If unchecked -> Remove bonus.
        const modifier = isNowCompleted ? FERTILIZER_BONUS_MINUTES : -FERTILIZER_BONUS_MINUTES;

        return { 
          ...g, 
          milestones, 
          // Ensure we don't drop below 0 minutes
          totalMinutes: Math.max(0, (g.totalMinutes || 0) + modifier) 
        };
      })
    );
  }, []);

  const updateWeeklyEvents = useCallback((events) => {
    const list = Array.isArray(events) ? events : events?.events ?? [];
    setWeeklyEvents(list);
  }, []);

  const editGoal = useCallback((goalId, updates) => {
    setGoals((prev) =>
      prev.map((g) => (g.id === goalId ? { ...g, ...updates } : g))
    );
  }, []);

  const deleteGoal = useCallback((goalId) => {
    setGoals((prev) => prev.filter((g) => g.id !== goalId));
  }, []);

  /** Append a metric log to a goal's metrics array. date defaults to today. */
  const logMetric = useCallback((goalId, value, date) => {
    const dateObj = date instanceof Date ? date : date != null ? new Date(date) : new Date();
    const dateStr = dateObj.toISOString ? dateObj.toISOString().slice(0, 10) : String(dateObj);
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== goalId) return g;
        const metrics = Array.isArray(g.metrics) ? [...g.metrics] : [];
        metrics.push({ value: Number(value), date: dateStr });
        return { ...g, metrics };
      })
    );
  }, []);

  const completeMorningCheckIn = useCallback((modifier) => {
    setDailyEnergyModifier(modifier);
    setLastCheckInDate(todayString());
  }, []);

  const markSundayRitualComplete = useCallback(() => {
    setLastSundayRitualDate(todayString());
  }, []);

  const setSpiritConfig = useCallback((config) => {
    setSpiritConfigState(config && typeof config === 'object' ? config : null);
  }, []);

  /** Import garden data from JSON (e.g. backup). Merges into state; persist effects will save to localStorage/Firestore. */
  const importGardenData = useCallback((data) => {
    if (!data || typeof data !== 'object') return;
    if (Array.isArray(data.goals)) setGoals(data.goals);
    if (Array.isArray(data.weeklyEvents)) setWeeklyEvents(data.weeklyEvents);
    if (data.userSettings && typeof data.userSettings === 'object') setUserSettings(data.userSettings);
    if (typeof data.dailyEnergyModifier === 'number') setDailyEnergyModifier(data.dailyEnergyModifier);
    if (data.lastCheckInDate != null) setLastCheckInDate(data.lastCheckInDate);
    if (data.lastSundayRitualDate != null) setLastSundayRitualDate(data.lastSundayRitualDate);
    if (Array.isArray(data.logs)) setLogs(data.logs);
    if (data.spiritConfig !== undefined) setSpiritConfigState(data.spiritConfig && typeof data.spiritConfig === 'object' ? data.spiritConfig : null);
    if (Array.isArray(data.compost)) setCompost(data.compost);
    if (typeof data.spiritPoints === 'number') setSpiritPoints(data.spiritPoints);
    if (Array.isArray(data.decorations)) setDecorations(data.decorations);
  }, []);

  /** Clear all garden data (localStorage + in-memory; if logged in, overwrite Firestore with default). */
  const deleteAllData = useCallback(async () => {
    setGoals(defaultData.goals);
    setWeeklyEvents(defaultData.weeklyEvents);
    setUserSettings(defaultData.userSettings);
    setDailyEnergyModifier(defaultData.dailyEnergyModifier);
    setLastCheckInDate(defaultData.lastCheckInDate);
    setLastSundayRitualDate(defaultData.lastSundayRitualDate);
    setLogs(defaultData.logs);
    setSpiritConfigState(defaultData.spiritConfig);
    setCompost(defaultData.compost);
    setAssignments({});
    setSpiritPoints(defaultData.spiritPoints);
    setDecorations(defaultData.decorations);
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
        await saveDailyPlan(uid, todayString(), {});
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
    dailyEnergyModifier,
    lastCheckInDate,
    completeMorningCheckIn,
    hydrated,
    lastSundayRitualDate,
    markSundayRitualComplete,
    logs,
    addLog,
    logMetric,
    addGoal,
    updateGoalProgress,
    updateGoalMilestone,
    toggleMilestone,
    updateWeeklyEvents,
    editGoal,
    deleteGoal,
    addSubtask,
    updateSubtask,
    deleteSubtask,
    updateSubtaskProgress,
    googleUser,
    googleToken,
    connectCalendar,
    disconnectCalendar,
    cloudSaveStatus,
    spiritConfig,
    setSpiritConfig,
    compost,
    addToCompost,
    removeFromCompost,
    assignments,
    setAssignments,
    eveningMode,
    setEveningMode,
    spiritPoints,
    decorations,
    buyDecoration,
    addDecoration,
    updateDecoration,
    updateDecorationPosition,
    removeDecoration,
    decorationCosts: { lantern: 15, bench: 25, pond: 40, path: 10, bush: 20 },
    importGardenData,
    deleteAllData,
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