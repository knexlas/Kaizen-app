import { useState, useMemo, useCallback } from 'react';
import { useGarden } from '../../context/GardenContext';
import { useTheme } from '../../context/ThemeContext';
import HorizonsGantt from '../Horizons/HorizonsGantt';
import HorizonsNarrativeBoard from '../Horizons/HorizonsNarrativeBoard';
import MonthlyTerrain from '../Dashboard/MonthlyTerrain';
import StagingArea, { PlanDayDrawer, buildBacklogTasks, getPlanItemsForDate, formatHourKey } from './StagingArea';
import GoalEditor from '../Goals/GoalEditor';
import TaskDetailModal from '../Dashboard/TaskDetailModal';
import ProjectPlanner from '../Projects/ProjectPlanner';
import SettingsView from '../Dashboard/SettingsView';
import { DefaultSpiritSvg } from '../Dashboard/MochiSpirit';
import { AnimatePresence, motion } from 'framer-motion';

const MirrorIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
    <path d="M9 18H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
    <path d="M15 6h5a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-5" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const TABS = [
  { id: 'calendar', label: 'Calendar (The Week)', icon: '📅' },
  { id: 'horizons', label: 'Horizons (Big Picture)', icon: '🗺️' },
  { id: 'seedbag', label: 'Seedbag (Backlog)', icon: '🌱' },
];

export default function CommandCenterLayout({ onBack, onNavigateToDashboard }) {
  const { darkMode: themeDarkMode, setDarkModeOverride } = useTheme();
  const isDark = themeDarkMode === true;
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const {
    goals = [],
    weeklyEvents = [],
    weekAssignments = {},
    loadDayPlan,
    saveDayPlanForDate,
    editGoal,
    deleteGoal,
    toggleMilestone,
    updateMilestone,
    addMilestone,
    deleteMilestone,
    updateSubtask,
    addSubtask,
    deleteSubtask,
    updateNarrativeTask,
    googleToken,
    monthlyQuotas = [],
    pausedDays = {},
    needsRescheduling = [],
    rescheduleNeedsReschedulingItem,
    clearDaySchedule,
    today,
    spawnedVolumeBlocks = [],
    removeSpawnedVolumeBlock,
    stagingTaskStatus = {},
    setStagingTaskStatus,
    addGoal,
    spiritConfig,
    eveningMode,
  } = useGarden();

  const navigateToNowAndOpen = useCallback((modal) => {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('kaizen:openModal', modal);
    onNavigateToDashboard?.({ tab: 'today' }) || onBack?.();
  }, [onNavigateToDashboard, onBack]);

  const renderSpiritAvatar = () => {
    if (!spiritConfig) return <span className="text-xl leading-none">✨</span>;
    if (spiritConfig.type === 'mochi') return <DefaultSpiritSvg className="w-10 h-10 drop-shadow-sm" />;
    if (spiritConfig.type === 'custom') {
      const HEADS = { bunny: '🐰', cat: '🐱', bear: '🐻', fox: '🦊', bot: '🤖', owl: '🦉' };
      return <span className="text-xl leading-none">{HEADS[spiritConfig.head] || '✨'}</span>;
    }
    const ARCHETYPES = { cat: '🐱', ember: '🔥', nimbus: '☁️', owl: '🦉' };
    return <span className="text-xl leading-none">{ARCHETYPES[spiritConfig.type] || '✨'}</span>;
  };

  const [activeTab, setActiveTab] = useState('calendar');
  const [editingGoal, setEditingGoal] = useState(null);
  const [taskDetailRef, setTaskDetailRef] = useState(null);
  const [showProjectPlanner, setShowProjectPlanner] = useState(false);
  const [projectPlannerPrefill, setProjectPlannerPrefill] = useState({ prefillTitle: '', prefillParentGoalId: '' });
  const [expandedGoalId, setExpandedGoalId] = useState(null);
  const [expandedRoutineCategory, setExpandedRoutineCategory] = useState(null); // accordion: which routine category is open in Seedbag
  const [planDayDateStr, setPlanDayDateStr] = useState(null);
  const [scheduleDrawerPreSelect, setScheduleDrawerPreSelect] = useState(null);
  const planDayBacklogTasks = useMemo(
    () => (planDayDateStr ? buildBacklogTasks(goals, planDayDateStr.slice(0, 7)) : []),
    [goals, planDayDateStr]
  );

  const handleProjectGoals = useCallback((goalsToCreate) => {
    (goalsToCreate || []).forEach((g) => addGoal(g));
  }, [addGoal]);

  const backlogGoals = useMemo(
    () => (goals || []).filter((g) => g.type === 'kaizen' || g.type === 'project' || g.type === 'vitality'),
    [goals]
  );

  const ROUTINE_CATEGORIES = ['💪 Wellness', '📁 Life Admin', '🧹 Household', '🧼 Care & Hygiene'];
  const routineGoals = useMemo(
    () => (goals || []).filter((g) => g.type === 'routine'),
    [goals]
  );
  const routinesByCategory = useMemo(() => {
    const map = {};
    routineGoals.forEach((g) => {
      const cat = ROUTINE_CATEGORIES.includes(g.category) ? g.category : '📋 Other';
      if (!map[cat]) map[cat] = [];
      map[cat].push(g);
    });
    return ROUTINE_CATEGORIES.filter((c) => (map[c]?.length ?? 0) > 0).concat((map['📋 Other']?.length ?? 0) > 0 ? ['📋 Other'] : []).map((cat) => ({ category: cat, goals: map[cat] || [] }));
  }, [routineGoals]);

  /** Which dates in weekAssignments have this goal (or its subtasks) scheduled. */
  const getPlannedDatesForGoal = useCallback((goalId) => {
    const out = [];
    if (!goalId || !weekAssignments || typeof weekAssignments !== 'object') return out;
    for (const [dateStr, dayPlan] of Object.entries(weekAssignments)) {
      if (!dayPlan || typeof dayPlan !== 'object') continue;
      const hasGoal = Object.values(dayPlan).some((a) => {
        if (a == null) return false;
        const id = typeof a === 'string' ? a : (a.goalId ?? a.parentGoalId);
        return id === goalId;
      });
      if (hasGoal) out.push(dateStr);
    }
    return out.sort();
  }, [weekAssignments]);

  const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const formatDateStr = (dateStr) => {
    try {
      const d = new Date(dateStr + 'T12:00:00');
      const day = d.getDay();
      return `${WEEKDAY_SHORT[day]} ${d.getDate()}`;
    } catch {
      return dateStr;
    }
  };

  /** Human-readable recurring days from goal.rituals (days 0–6 = Sun–Sat). */
  const formatRitualDays = (goal) => {
    const rituals = goal?.rituals ?? [];
    if (rituals.length === 0) return null;
    return rituals.map((r) => {
      const days = r.days ?? [];
      if (days.length === 0) return `${r.title ?? 'Ritual'}: —`;
      const names = [...new Set(days)].sort((a, b) => a - b).map((i) => WEEKDAY_SHORT[i]);
      return `${r.title ?? 'Ritual'}: ${names.join(', ')}`;
    });
  };

  /** Set of day indices (0–6) the routine recurs on, from goal.rituals. */
  const getRecurringDayIndices = (goal) => {
    const rituals = goal?.rituals ?? [];
    const set = new Set();
    rituals.forEach((r) => (r.days ?? []).forEach((d) => set.add(d)));
    return set;
  };

  const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']; // Sun–Sat 0–6

  const todayPlanItems = useMemo(
    () => getPlanItemsForDate(weekAssignments, goals, today),
    [weekAssignments, goals, today]
  );

  return (
    <div className={`min-h-screen flex flex-col transition-colors ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-stone-50'}`}>
      <header className={`sticky top-0 z-20 border-b shrink-0 backdrop-blur-sm ${isDark ? 'border-slate-700 bg-slate-800/95' : 'border-stone-200 bg-white/95'}`}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className={`p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-moss-500/40 ${isDark ? 'text-slate-400 hover:bg-slate-700 hover:text-slate-100' : 'text-stone-500 hover:bg-stone-100 hover:text-stone-800'}`}
                aria-label="Back to Today"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h1 className={`font-serif text-xl ${isDark ? 'text-slate-100' : 'text-stone-900'}`}>Command Center</h1>
          </div>
          {/* Toolbelt — same as Now: Mochi chat, Compost, Mirror, Dark mode, Accessibility, Replay tour (Settings is fixed top-right only) */}
          <div className="flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={() => navigateToNowAndOpen('chat')}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:scale-105 transition-transform cursor-pointer drop-shadow-sm"
              title="Talk to Mochi"
              aria-label="Talk to Mochi"
            >
              {renderSpiritAvatar()}
            </button>
            <button
              type="button"
              onClick={() => navigateToNowAndOpen('compost')}
              className={`w-10 h-10 flex items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-moss-500/40 transition-colors ${
                isDark ? 'text-slate-400 hover:text-slate-100 hover:bg-slate-700/60' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200'
              }`}
              aria-label="Compost Heap"
              title="Compost Heap"
            >
              <span className="text-xl leading-none" aria-hidden>🍂</span>
            </button>
            <button
              type="button"
              onClick={() => navigateToNowAndOpen('mirror')}
              className={`w-10 h-10 flex items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-moss-500/40 transition-colors ${
                isDark ? 'text-slate-400 hover:text-slate-100 hover:bg-slate-700/60' : 'text-stone-500 hover:text-stone-800 hover:bg-stone-200'
              }`}
              aria-label="Customize Spirit (Mirror)"
              title="Mirror"
            >
              <MirrorIcon />
            </button>
            <button
              type="button"
              onClick={() => setDarkModeOverride(!isDark)}
              className={`w-10 h-10 flex items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-moss-500/40 transition-colors ${
                isDark ? 'text-indigo-300 hover:bg-slate-700/60' : 'text-stone-500 hover:text-indigo-600 hover:bg-stone-200'
              }`}
              aria-label="Toggle dark mode"
              title="Toggle dark mode"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            </button>
            {eveningMode !== 'night-owl' && (
              <button
                type="button"
                onClick={() => navigateToNowAndOpen('accessibility')}
                className={`w-10 h-10 flex items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-moss-500/40 transition-colors ${
                  isDark ? 'text-slate-400 hover:text-slate-100 hover:bg-slate-700/60' : 'text-stone-500 hover:text-stone-800 hover:bg-stone-200'
                }`}
                aria-label="Accessibility & Comfort"
                title="Accessibility & Comfort"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v4M12 14h.01M9 9l2 2-2 2" />
                </svg>
              </button>
            )}
            <button
              type="button"
              onClick={() => navigateToNowAndOpen('tour')}
              className={`w-10 h-10 flex items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-moss-500/40 transition-colors ${
                isDark ? 'text-slate-400 hover:text-slate-100 hover:bg-slate-700/60' : 'text-stone-400 hover:text-stone-600 hover:bg-stone-200'
              }`}
              aria-label="Replay tour"
              title="Replay tour"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </button>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 pb-2">
          <nav className={`flex gap-1 p-1 rounded-xl border ${isDark ? 'bg-slate-700/50 border-slate-600' : 'bg-stone-100 border-stone-200'}`} aria-label="Plan sections">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-sans text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-moss-500/40 ${
                  activeTab === tab.id
                    ? isDark ? 'bg-slate-600 text-slate-100 shadow-sm' : 'bg-white text-stone-900 shadow-sm'
                    : isDark ? 'text-slate-300 hover:text-slate-100' : 'text-stone-600 hover:text-stone-800'
                }`}
                aria-current={activeTab === tab.id ? 'page' : undefined}
              >
                <span aria-hidden>{tab.icon}</span>
                <span className="hidden sm:inline truncate">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Persistent top-right Settings (same as dashboard) */}
      <div className="fixed top-4 right-4 z-50 pointer-events-auto">
        <button
          type="button"
          onClick={() => setShowSettingsModal((v) => !v)}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-stone-900/80 backdrop-blur-md border border-white/10 shadow-lg text-stone-200 hover:text-white hover:bg-stone-800/90 transition-colors focus:outline-none focus:ring-2 focus:ring-moss-500/50"
          aria-label={showSettingsModal ? 'Close settings' : 'Settings'}
          title={showSettingsModal ? 'Close' : 'Settings'}
        >
          <span className="text-xl leading-none" aria-hidden>{showSettingsModal ? '←' : '⚙️'}</span>
        </button>
      </div>

      {/* Today strip: quick view of today's schedule */}
      <div className={`shrink-0 border-b px-4 py-2 ${isDark ? 'border-slate-700 bg-slate-800/80' : 'border-stone-200 bg-white/80'}`}>
        <div className="max-w-5xl mx-auto flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className={`font-sans text-sm font-medium ${isDark ? 'text-slate-300' : 'text-stone-700'}`}>Today</span>
          {todayPlanItems.length > 0 ? (
            <>
              <span className={`font-sans text-sm ${isDark ? 'text-slate-400' : 'text-stone-600'}`}>
                {todayPlanItems.map((p) => `${formatHourKey(Number(p.hour))} ${p.title}`).join(' · ')}
              </span>
              <button
                type="button"
                onClick={() => { setActiveTab('calendar'); setPlanDayDateStr(today); }}
                className="font-sans text-sm font-medium text-moss-600 hover:text-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/40 rounded px-1"
              >
                Open full day
              </button>
            </>
          ) : (
            <span className={`font-sans text-sm italic ${isDark ? 'text-slate-500' : 'text-stone-500'}`}>Nothing scheduled yet.</span>
          )}
        </div>
      </div>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6 pb-24">
        {activeTab === 'horizons' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
              <h2 className="font-serif text-stone-800 text-lg mb-3">Goal narrative</h2>
              <p className="font-sans text-sm text-stone-500 mb-4">Expand a goal to see its story as steps — no dates, just the sequence.</p>
              <HorizonsNarrativeBoard
                goals={goals}
                onGoalClick={(goal) => setEditingGoal(goal)}
                onDeleteGoal={deleteGoal}
              />
            </section>
            <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <h2 className="font-serif text-stone-800 text-lg">Project timeline</h2>
                <button
                  type="button"
                  onClick={() => setShowProjectPlanner(true)}
                  className="px-4 py-2 rounded-xl font-sans text-sm font-medium bg-moss-600 text-white hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/50 focus:ring-offset-2 transition-colors"
                >
                  Make project plan
                </button>
              </div>
              <HorizonsGantt
                goals={goals}
                onGoalClick={(goal) => setEditingGoal(goal)}
                onDeleteGoal={deleteGoal}
                onToggleMilestone={toggleMilestone}
                onUpdateSubtask={updateSubtask}
                onEditGoal={editGoal}
                onAddMilestone={addMilestone}
                onUpdateMilestone={updateMilestone}
                onAddSubtask={addSubtask}
                onDeleteSubtask={deleteSubtask}
                onTaskClick={setTaskDetailRef}
                onScheduleTask={(taskPayload) => {
                  if (taskPayload && taskPayload.type === 'staging-task' && taskPayload.task) {
                    setScheduleDrawerPreSelect(taskPayload);
                    setActiveTab('calendar');
                  }
                }}
              />
            </section>
            <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
              <h2 className="font-serif text-stone-800 text-lg mb-3">Month at a glance</h2>
              <MonthlyTerrain
                googleToken={googleToken}
                onRequestPlanDay={setPlanDayDateStr}
              />
            </section>
          </div>
        )}

        {activeTab === 'calendar' && (
          <div className="animate-in fade-in duration-200">
            <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
              <StagingArea
                goals={goals}
                weeklyEvents={weeklyEvents}
                weekAssignments={weekAssignments}
                loadDayPlan={loadDayPlan}
                saveDayPlanForDate={saveDayPlanForDate}
                pausedDays={pausedDays}
                needsRescheduling={needsRescheduling}
                rescheduleNeedsReschedulingItem={rescheduleNeedsReschedulingItem}
                clearDaySchedule={clearDaySchedule}
                today={today}
                editGoal={editGoal}
                spawnedVolumeBlocks={spawnedVolumeBlocks}
                removeSpawnedVolumeBlock={removeSpawnedVolumeBlock}
                onTaskClick={setTaskDetailRef}
                onPlanDay={setPlanDayDateStr}
                stagingTaskStatus={stagingTaskStatus}
                setStagingTaskStatus={setStagingTaskStatus}
                initialScheduleSelection={scheduleDrawerPreSelect}
                onConsumeScheduleSelection={() => setScheduleDrawerPreSelect(null)}
              />
            </section>
          </div>
        )}

        {activeTab === 'seedbag' && (
          <div className="animate-in fade-in duration-200">
            <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
              <h2 className="font-serif text-stone-800 text-lg mb-2">Backlog</h2>
              <p className="font-sans text-sm text-stone-500 mb-4">Goals and projects you can pull into your day. Click to expand phases and tasks. Routines are grouped by category below.</p>

              {backlogGoals.length > 0 && (
                <>
                  <h3 className="font-sans text-sm font-semibold text-stone-700 uppercase tracking-wide mt-2 mb-2">Goals & Projects</h3>
                  <ul className="space-y-2" role="list">
                  {backlogGoals.map((goal) => {
                    const isExpanded = expandedGoalId === goal.id;
                    const milestones = goal.milestones || [];
                    const subtasks = goal.subtasks || [];
                    const narrativeMilestones = goal.narrativeBreakdown?.milestones || [];
                    return (
                      <li
                        key={goal.id}
                        className="rounded-lg border border-stone-100 bg-stone-50/80 overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() => setExpandedGoalId(isExpanded ? null : goal.id)}
                          className="w-full flex items-center justify-between gap-3 py-2 px-3 text-left hover:bg-stone-100/80 transition-colors focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:ring-inset"
                        >
                          <span className="min-w-0 flex-1 flex flex-col items-start">
                            <span className="font-sans text-sm font-medium text-stone-800 truncate w-full">{goal.title}</span>
                            {goal.linkedToGoalId && (() => {
                              const parent = backlogGoals.find((g) => g.id === goal.linkedToGoalId);
                              return parent ? (
                                <span className="font-sans text-xs text-stone-500 dark:text-stone-400 mt-0.5" title={`Supports: ${parent.title}`}>
                                  Supports {parent.title}
                                </span>
                              ) : null;
                            })()}
                          </span>
                          <span className="shrink-0 flex items-center gap-2">
                            <span className="font-sans text-xs text-stone-500">
                              {goal.type === 'routine' ? 'Routine' : goal.type === 'vitality' ? 'Vitality' : goal.type === 'project' ? 'Project' : 'Kaizen'}
                            </span>
                            <span className="text-stone-400" aria-hidden>{isExpanded ? '▼' : '▶'}</span>
                          </span>
                        </button>
                        {isExpanded && (milestones.length > 0 || subtasks.length > 0 || narrativeMilestones.length > 0) && (
                          <div className="border-t border-stone-200 bg-white/60 px-3 py-3 space-y-3">
                            {milestones.map((m) => {
                              const phaseSubtasks = (goal.subtasks || []).filter((st) => st.phaseId === m.id);
                              return (
                                <div key={m.id} className="space-y-1">
                                  <p className="font-sans text-xs font-semibold text-stone-600 uppercase tracking-wider">{m.title}</p>
                                  {phaseSubtasks.length > 0 ? (
                                    <ul className="list-disc list-inside text-stone-600 text-sm space-y-0.5 ml-2">
                                      {phaseSubtasks.map((st) => (
                                        <li key={st.id}>{st.title}</li>
                                      ))}
                                    </ul>
                                  ) : null}
                                </div>
                              );
                            })}
                            {narrativeMilestones.length > 0 && milestones.length === 0 && narrativeMilestones.map((nm, nmi) => (
                              <div key={nmi} className="space-y-1">
                                <p className="font-sans text-xs font-semibold text-stone-600 uppercase tracking-wider">{nm.title ?? `Phase ${nmi + 1}`}</p>
                                {Array.isArray(nm.tasks) && nm.tasks.length > 0 && (
                                  <ul className="list-disc list-inside text-stone-600 text-sm space-y-0.5 ml-2">
                                    {nm.tasks.map((t, i) => (
                                      <li key={i}>{typeof t === 'object' ? (t.title ?? t.name) : String(t)}</li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            ))}
                            {subtasks.length > 0 && (
                              <div className="space-y-1">
                                <p className="font-sans text-xs font-semibold text-stone-600 uppercase tracking-wider">Subtasks</p>
                                <ul className="list-disc list-inside text-stone-600 text-sm space-y-0.5 ml-2">
                                  {subtasks.map((s) => (
                                    <li key={s.id}>{s.title}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {milestones.length === 0 && narrativeMilestones.length === 0 && subtasks.length === 0 && (
                              <p className="font-sans text-xs text-stone-400 italic">No phases or tasks yet.</p>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                  </ul>
                </>
              )}

              {routinesByCategory.length > 0 && (
                <>
                  <h3 className="font-sans text-sm font-semibold text-stone-700 uppercase tracking-wide mt-6 mb-2">Routines</h3>
                  <p className="font-sans text-xs text-stone-500 mb-3">Click a routine to expand tasks, see when it’s planned, and edit. Each category is one seed in your garden; complete any routine in the group to grow it.</p>
                  <p className="font-sans text-xs text-stone-400 mb-3">Routines without a category appear under Other. Edit a routine to set its category (Wellness, Life Admin, etc.).</p>
                  <div className="space-y-2" role="region" aria-label="Routine categories">
                    {routinesByCategory.map(({ category, goals: catGoals }) => {
                      const isCategoryOpen = expandedRoutineCategory === category;
                      return (
                      <div key={category} className="rounded-lg border border-stone-200 bg-stone-50/60 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setExpandedRoutineCategory(isCategoryOpen ? null : category)}
                          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 border-b border-stone-200 bg-stone-100/80 font-sans text-sm font-medium text-stone-800 text-left hover:bg-stone-200/60 transition-colors focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:ring-inset"
                          aria-expanded={isCategoryOpen}
                          aria-controls={`seedbag-routines-${category.replace(/\s/g, '-')}`}
                          id={`seedbag-routine-header-${category.replace(/\s/g, '-')}`}
                        >
                          <span>{category} ({catGoals.length})</span>
                          <span className="shrink-0 text-stone-400" aria-hidden>{isCategoryOpen ? '▼' : '▶'}</span>
                        </button>
                        {isCategoryOpen && (
                        <ul id={`seedbag-routines-${category.replace(/\s/g, '-')}`} className="divide-y divide-stone-100" role="list" aria-labelledby={`seedbag-routine-header-${category.replace(/\s/g, '-')}`}>
                          {catGoals.map((goal) => {
                            const isExpanded = expandedGoalId === goal.id;
                            const subtasks = goal.subtasks || [];
                            const plannedDates = getPlannedDatesForGoal(goal.id);
                            const ritualLines = formatRitualDays(goal);
                            return (
                              <li key={goal.id} className="rounded-lg border border-stone-100 bg-white/80 overflow-hidden">
                                <button
                                  type="button"
                                  onClick={() => setExpandedGoalId(isExpanded ? null : goal.id)}
                                  className="w-full flex items-center justify-between gap-3 py-2.5 px-3 text-left hover:bg-stone-100/80 transition-colors focus:outline-none focus:ring-2 focus:ring-moss-500/40 focus:ring-inset"
                                >
                                  <span className="font-sans text-sm font-medium text-stone-800 truncate">{goal.title}</span>
                                  <span className="shrink-0 flex items-center gap-2">
                                    {goal.estimatedMinutes != null && (
                                      <span className="font-sans text-xs text-stone-500">{goal.estimatedMinutes} min</span>
                                    )}
                                    <span className="text-stone-400" aria-hidden>{isExpanded ? '▼' : '▶'}</span>
                                  </span>
                                </button>
                                {isExpanded && (
                                  <div className="border-t border-stone-200 bg-stone-50/60 px-3 py-3 space-y-3">
                                    {subtasks.length > 0 && (
                                      <div className="space-y-2">
                                        <p className="font-sans text-xs font-semibold text-stone-600 uppercase tracking-wider">Tasks</p>
                                        <ul className="space-y-1.5" role="list">
                                          {subtasks.map((st) => {
                                            const recurringDays = (st.days != null && Array.isArray(st.days) && st.days.length > 0) ? new Set(st.days) : getRecurringDayIndices(goal);
                                            return (
                                              <li key={st.id} className="flex flex-wrap items-center gap-2 py-2 px-2 rounded-lg bg-white/80 border border-stone-100">
                                                <span className="font-sans text-sm text-stone-800 truncate min-w-0 flex-1">{st.title}</span>
                                                <span className="flex items-center gap-0.5 shrink-0" aria-label="Recurring days">
                                                  {DAY_LETTERS.map((letter, i) => (
                                                    <span
                                                      key={i}
                                                      className={`w-6 h-6 flex items-center justify-center rounded font-sans text-[10px] font-medium ${
                                                        recurringDays.has(i) ? 'bg-moss-600 text-white' : 'bg-stone-200 text-stone-400'
                                                      }`}
                                                    >
                                                      {letter}
                                                    </span>
                                                  ))}
                                                </span>
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setTaskDetailRef({ type: 'subtask', goalId: goal.id, subtaskId: st.id });
                                                  }}
                                                  className="shrink-0 px-2.5 py-1 rounded font-sans text-xs font-medium bg-stone-200 text-stone-700 hover:bg-stone-300 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
                                                >
                                                  Edit
                                                </button>
                                              </li>
                                            );
                                          })}
                                        </ul>
                                      </div>
                                    )}
                                    {subtasks.length === 0 && (
                                      <p className="font-sans text-xs text-stone-400 italic">No tasks yet. Add steps in Edit.</p>
                                    )}
                                    <div className="space-y-1">
                                      <p className="font-sans text-xs font-semibold text-stone-600 uppercase tracking-wider">Planned this week</p>
                                      {plannedDates.length > 0 ? (
                                        <p className="font-sans text-sm text-stone-700">{plannedDates.map(formatDateStr).join(', ')}</p>
                                      ) : (
                                        <p className="font-sans text-sm text-stone-500 italic">Not planned this week</p>
                                      )}
                                    </div>
                                    {ritualLines && ritualLines.length > 0 && (
                                      <div className="space-y-1">
                                        <p className="font-sans text-xs font-semibold text-stone-600 uppercase tracking-wider">Recurring</p>
                                        <ul className="font-sans text-sm text-stone-700 space-y-0.5">
                                          {ritualLines.map((line, i) => (
                                            <li key={i}>{line}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                    {(!ritualLines || ritualLines.length === 0) && (
                                      <p className="font-sans text-xs text-stone-500">No recurring days set. Edit to add rituals.</p>
                                    )}
                                    <div className="pt-2">
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setEditingGoal(goal); }}
                                        className="px-3 py-1.5 rounded-lg font-sans text-xs font-medium bg-moss-100 text-moss-800 hover:bg-moss-200 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
                                      >
                                        Edit routine
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                        )}
                      </div>
                    );
                    })}
                  </div>
                </>
              )}

              {backlogGoals.length === 0 && routinesByCategory.length === 0 && (
                <p className="font-sans text-sm text-stone-400 py-8 text-center">No goals or routines in the backlog yet. Add one from the Today view.</p>
              )}
            </section>
          </div>
        )}
      </main>

      <GoalEditor
        open={!!editingGoal}
        goal={editingGoal}
        onClose={() => setEditingGoal(null)}
        onSave={(updates) => {
          if (editingGoal?.id) editGoal(editingGoal.id, updates);
          setEditingGoal(null);
        }}
        addSubtask={addSubtask}
        updateSubtask={updateSubtask}
        deleteSubtask={deleteSubtask}
        onOpenProjectPlanner={(opts) => {
          setProjectPlannerPrefill({ prefillTitle: opts?.prefillTitle ?? '', prefillParentGoalId: opts?.prefillParentGoalId ?? '' });
          setEditingGoal(null);
          setShowProjectPlanner(true);
        }}
      />

      <TaskDetailModal
        open={!!taskDetailRef}
        onClose={() => setTaskDetailRef(null)}
        taskRef={taskDetailRef}
        goals={goals}
        onUpdateNarrativeTask={updateNarrativeTask}
        onUpdateSubtask={updateSubtask}
      />

      <ProjectPlanner
        open={showProjectPlanner}
        onClose={() => { setShowProjectPlanner(false); setProjectPlannerPrefill({ prefillTitle: '', prefillParentGoalId: '' }); }}
        onCreateGoals={handleProjectGoals}
        prefillTitle={projectPlannerPrefill.prefillTitle}
        prefillParentGoalId={projectPlannerPrefill.prefillParentGoalId}
      />

      <PlanDayDrawer
        dateStr={planDayDateStr}
        open={!!planDayDateStr}
        onClose={() => setPlanDayDateStr(null)}
        backlogTasks={planDayBacklogTasks}
        loadDayPlan={loadDayPlan}
        saveDayPlanForDate={saveDayPlanForDate}
        goals={goals}
      />

      <AnimatePresence>
        {showSettingsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-stone-900/40 backdrop-blur-sm overflow-y-auto safe-area-pb"
            onClick={() => setShowSettingsModal(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Settings"
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-2xl bg-[#FDFCF5] border border-stone-200 shadow-2xl"
            >
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                aria-label="Close"
                className="absolute top-3 right-3 z-10 w-9 h-9 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
              >
                ×
              </button>
              <div className="p-6 pt-14">
                <SettingsView
                  onReplayTour={() => {
                    setShowSettingsModal(false);
                    onBack?.();
                  }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom nav: Now | Plan | Garden — same mental model as dashboard */}
      <nav
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-stone-900/80 backdrop-blur-md px-4 sm:px-6 py-3 rounded-full flex gap-4 sm:gap-8 shadow-2xl border border-white/10 safe-area-pb"
        aria-label="Main navigation"
      >
        <button
          type="button"
          onClick={() => (onNavigateToDashboard ? onNavigateToDashboard({ tab: 'today' }) : onBack?.())}
          className="flex items-center gap-2 min-w-[44px] min-h-[44px] justify-center rounded-full px-3 py-2 transition-colors focus:outline-none focus:ring-2 focus:ring-white/30 text-stone-400 hover:text-stone-200"
          aria-label="Now"
        >
          <span className="text-2xl sm:text-xl" aria-hidden>⚡</span>
          <span className="hidden sm:inline text-sm font-medium">Now</span>
        </button>
        <span
          className="flex items-center gap-2 min-w-[44px] min-h-[44px] justify-center rounded-full px-3 py-2 bg-white/20 text-amber-300"
          aria-current="page"
          aria-label="Plan (current)"
        >
          <span className="text-2xl sm:text-xl" aria-hidden>🗺️</span>
          <span className="hidden sm:inline text-sm font-medium">Plan</span>
        </span>
        <button
          type="button"
          onClick={() => onNavigateToDashboard?.({ tab: 'garden' })}
          className="flex items-center gap-2 min-w-[44px] min-h-[44px] justify-center rounded-full px-3 py-2 transition-colors focus:outline-none focus:ring-2 focus:ring-white/30 text-stone-400 hover:text-stone-200"
          aria-label="Garden"
        >
          <span className="text-2xl sm:text-xl" aria-hidden>🌱</span>
          <span className="hidden sm:inline text-sm font-medium">Garden</span>
        </button>
      </nav>
    </div>
  );
}
