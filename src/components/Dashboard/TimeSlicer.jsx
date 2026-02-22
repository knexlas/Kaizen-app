import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { DndContext, useDraggable, useDroppable } from '@dnd-kit/core';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { createGoogleEvent } from '../../services/googleCalendarService';
import { downloadICS } from '../../services/calendarSyncService';
import { suggestLoadLightening, generateDailyPlan, autoFillDailyPlan, timeToMinutes, getSpoonCost } from '../../services/schedulerService';
import { useGarden } from '../../context/GardenContext';
import { localISODate } from '../../services/dateUtils';
import { getSettings } from '../../services/userSettings';
import { shouldReduceMotion } from '../../services/motion';
import WoodenSpoon from '../WoodenSpoon';

const HOUR_START = 6;
const HOUR_END = 23;
const HOURS = Array.from(
  { length: HOUR_END - HOUR_START + 1 },
  (_, i) => `${String(HOUR_START + i).padStart(2, '0')}:00`
);

/** Flexible capacity: storm=3, leaf=5, sun=6 */
const MAX_SLOTS_BY_WEATHER = { storm: 3, leaf: 5, sun: 6 };

/** Assignment: goalId (string), { goalId, ritualTitle }, or { parentGoalId, title, type: 'routine', duration } */
function getGoalIdFromAssignment(a) {
  if (a == null) return null;
  if (typeof a === 'string') return a;
  if (typeof a === 'object' && a.parentGoalId) return a.parentGoalId;
  if (typeof a === 'object' && a.goalId) return a.goalId;
  return null;
}
function getRitualTitleFromAssignment(a) {
  return a && typeof a === 'object' && 'ritualTitle' in a ? a.ritualTitle : null;
}
function getSubtaskFromAssignment(a) {
  return a && typeof a === 'object' && a.subtaskId ? { id: a.subtaskId, title: a.subtaskTitle ?? a.subtaskId } : null;
}
function isRoutineSession(a) {
  return a && typeof a === 'object' && a.type === 'routine' && a.parentGoalId;
}

function LowBatteryIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600 shrink-0" aria-hidden>
      <rect x="2" y="6" width="14" height="12" rx="2" ry="2" />
      <line x1="16" y1="9" x2="18" y2="9" />
      <rect x="4" y="14" width="10" height="4" rx="1" fill="currentColor" />
    </svg>
  );
}

/** Spoon Battery: row of spoons at top; loud and clear. Low energy = fewer spoons, cracked/dim. */
function SpoonBattery({ used, total, isLowEnergy, onLightenLoad }) {
  const safeTotal = Math.max(1, total);
  const displayUsed = Math.min(used, safeTotal);
  const hoursRemaining = Math.max(0, safeTotal - displayUsed);
  const isOverCapacity = used > total;

  return (
    <div className="mb-5">
      <div
        id="tour-battery"
        className={`relative flex flex-wrap items-center gap-3 p-4 rounded-xl border-2 transition-colors duration-300 ${
          isLowEnergy
            ? 'bg-stone-200/90 border-stone-400 text-stone-600'
            : isOverCapacity
              ? 'bg-amber-50/95 border-amber-300 text-amber-900'
              : 'bg-[#FDFCF5] border-[#4A5D23]/30 text-stone-800'
        }`}
        aria-label={`Energy budget: ${hoursRemaining} hours remaining of ${safeTotal}`}
      >
        {/* Row of spoon icons / battery segments */}
        <div className="flex items-center gap-1 shrink-0">
          {Array.from({ length: safeTotal }).map((_, i) => {
            const isUsed = i < displayUsed;
            const cracked = isLowEnergy;
            return (
              <span
                key={i}
                className={`inline-flex items-center justify-center transition-all duration-300 ${
                  isUsed
                    ? isOverCapacity
                      ? 'opacity-90'
                      : isLowEnergy
                        ? 'opacity-50 grayscale'
                        : 'opacity-100'
                    : isLowEnergy
                      ? 'opacity-40 grayscale'
                      : 'opacity-70'
                } ${cracked ? 'contrast-75' : ''}`}
                aria-hidden
                title={isUsed ? 'Used' : 'Available'}
              >
                <WoodenSpoon size={22} />
              </span>
            );
          })}
        </div>
        {isLowEnergy && (
          <span className="shrink-0 text-stone-500/80 text-sm font-medium" aria-hidden>
            (low energy)
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-sans text-stone-900 font-semibold">
            Energy Budget: <span className="tabular-nums text-[#4A5D23]">{hoursRemaining}</span> hour{hoursRemaining !== 1 ? 's' : ''} remaining.
          </p>
          {isLowEnergy && (
            <p className="font-sans text-xs text-stone-500 mt-0.5">Fewer slots today — rest when you need to.</p>
          )}
        </div>
      </div>
      {isOverCapacity && onLightenLoad && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onLightenLoad}
            className="shrink-0 px-3 py-1.5 rounded-lg font-sans text-sm font-medium bg-amber-100 text-amber-800 hover:bg-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
          >
            📉 Lighten My Load
          </button>
        </div>
      )}
    </div>
  );
}

function CloudUploadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-moss-600 shrink-0" aria-hidden>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function RepeatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500 shrink-0" aria-hidden>
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

const MOBILE_BREAKPOINT = 640;

function TimeSlot({
  hour,
  assignment,
  goals,
  filledOrderIndex,
  filledCount,
  maxSlots,
  onStartFocus,
  onMilestoneCheck,
  cloudSaved = false,
  now = null,
  isMobile = false,
  onEmptySlotClick,
  disableConfetti = false,
}) {
  const { setNodeRef, isOver } = useDroppable({ id: hour });
  const goalId = getGoalIdFromAssignment(assignment);
  const slotRitualTitle = getRitualTitleFromAssignment(assignment);
  const subtask = getSubtaskFromAssignment(assignment);
  const routineSession = isRoutineSession(assignment);
  const isRecovery = assignment && typeof assignment === 'object' && assignment.type === 'recovery';
  const goal = goalId ? goals?.find((g) => g.id === goalId) : null;
  const isEmpty = !goal && !routineSession && !isRecovery;
  const thisSlotOverLimit = goal && filledCount > maxSlots;
  const firstUncompleted = goal?.milestones?.find((m) => !m.completed);
  const milestoneTitle = firstUncompleted?.title ?? firstUncompleted?.text;

  const slotHourNum = parseInt(hour.slice(0, 2), 10);
  const isCurrentHour = now && slotHourNum === now.getHours() && slotHourNum >= HOUR_START && slotHourNum <= HOUR_END;
  const currentMinutePercent = isCurrentHour ? (now.getMinutes() / 60) * 100 : 0;
  const timeLabel = isCurrentHour ? `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}` : '';

  const slotBg = isEmpty
    ? 'bg-stone-100 border-2 border-dashed border-stone-300'
    : isRecovery
      ? 'bg-stone-100 border border-stone-300 text-stone-600'
      : routineSession
        ? 'bg-slate-200 border border-slate-300 text-stone-800'
        : thisSlotOverLimit
          ? 'bg-orange-200 border border-orange-300 text-orange-900'
          : 'bg-moss-200 border border-moss-500/50 text-stone-800';

  const estimatedMins = goal?.estimatedMinutes ?? 0;
  const totalMins = goal?.totalMinutes ?? 0;
  const durationLabel = estimatedMins > 0 ? `${estimatedMins}m` : null;
  const progressPercent = estimatedMins > 0 ? Math.min(100, (totalMins / estimatedMins) * 100) : 0;
  const isFullyHarvested = estimatedMins > 0 && totalMins >= estimatedMins;
  const progressBarColor =
    progressPercent >= 100 ? 'bg-moss-500' : progressPercent > 0 ? 'bg-amber-500' : 'bg-stone-400';

  const routineDuration = routineSession ? (assignment.duration ?? 60) : 0;

  const triggerHarvestConfetti = (e) => {
    try {
      if (disableConfetti || typeof window === 'undefined') return;
      const prefersReducedMotion = !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      if (prefersReducedMotion) return;

      const rect = e?.currentTarget?.getBoundingClientRect?.();
      if (!rect || !window.innerWidth || !window.innerHeight) return;

      const x = (rect.left + rect.width / 2) / window.innerWidth;
      const y = (rect.top + rect.height / 2) / window.innerHeight;

      confetti({
        particleCount: 40,
        spread: 60,
        origin: { x, y },
        colors: ['#4ade80', '#22c55e', '#fbbf24', '#e7e5e4'], // Greens, Golds, Stone
        disableForReducedMotion: true,
        scalar: 0.8,
      });
    } catch {
      // confetti is purely celebratory; ignore failures
    }
  };

  return (
    <div ref={setNodeRef} className="relative flex items-center gap-3 py-1.5">
      {isCurrentHour && (
        <div
          className="absolute left-14 right-0 border-t-2 border-red-500/70 z-20 pointer-events-none transition-all duration-1000 ease-linear"
          style={{ top: `${currentMinutePercent}%` }}
        >
          <span className="absolute top-1/2 -translate-y-1/2 -left-1 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-red-400 shadow-sm" />
          <span className="absolute right-2 -top-7 px-2 py-1 rounded-md bg-white/85 backdrop-blur-sm border border-stone-200/80 shadow-sm font-mono text-sm text-stone-700 tabular-nums">
            {timeLabel}
          </span>
        </div>
      )}
      <span className="w-11 shrink-0 font-sans text-sm text-stone-500">{hour}</span>
      <div
        role={isEmpty && onEmptySlotClick ? 'button' : undefined}
        tabIndex={isEmpty && onEmptySlotClick ? 0 : undefined}
        onClick={isEmpty && onEmptySlotClick ? () => onEmptySlotClick(hour) : undefined}
        onKeyDown={isEmpty && onEmptySlotClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEmptySlotClick(hour); } } : undefined}
        className={`flex-1 min-h-[52px] rounded-lg flex flex-col justify-center px-3 py-2 transition-colors relative overflow-hidden ${slotBg} ${
          isOver && isEmpty ? 'ring-2 ring-moss-500/50 ring-offset-1' : ''
        } ${isFullyHarvested && !routineSession ? 'border-moss-600/60' : ''} ${isEmpty && onEmptySlotClick ? 'cursor-pointer hover:bg-stone-200/80 active:bg-stone-300/80' : ''}`}
      >
        {/* Blocked overlay: striped + stone texture when over capacity or empty at capacity */}
        {thisSlotOverLimit && (
            <div
            className="absolute inset-0 rounded-lg pointer-events-none overflow-hidden"
            style={{
              backgroundColor: 'rgba(120, 113, 108, 0.75)',
              backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 6px, rgba(87, 83, 78, 0.4) 6px, rgba(87, 83, 78, 0.4) 12px)',
            }}
            aria-hidden
          />
        )}
        {routineSession ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <RepeatIcon />
                <span className="font-sans text-sm font-medium truncate">{assignment.title ?? goal?.title ?? 'Routine'}</span>
              </div>
              {onStartFocus && goal && (
                <button
                  type="button"
                  onClick={() => onStartFocus(goal.id, hour, undefined, assignment?.subtaskId)}
                  className="shrink-0 flex items-center gap-1 px-2 py-1 rounded font-sans text-xs bg-stone-800 text-stone-50 hover:bg-stone-700 focus:outline-none focus:ring-2 focus:ring-moss-500/50"
                >
                  <span aria-hidden>▶</span>
                  <span>Play</span>
                </button>
              )}
            </div>
            {routineDuration > 0 && (
              <span className="font-sans text-xs text-stone-500 mt-0.5">{routineDuration}m</span>
            )}
            {subtask?.title && (
              <span className="font-sans text-xs text-moss-700 mt-0.5 truncate block" title={subtask.title}>🌱 {subtask.title}</span>
            )}
          </>
        ) : isRecovery ? (
          <span className="font-sans text-sm font-medium text-stone-600">{assignment.title ?? 'Rest'}</span>
        ) : goal ? (
          <>
            {durationLabel && !isFullyHarvested && (
              <span className="absolute top-2 right-2 font-sans text-xs text-stone-500" aria-hidden>
                {durationLabel}
              </span>
            )}
            <div className="flex items-center justify-between gap-2 pr-24">
              <span className="font-sans text-sm font-medium truncate">{goal.title}</span>
              {cloudSaved && (
                <motion.span
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  className="shrink-0 flex items-center"
                  title="Saved to Google Calendar"
                >
                  <CloudUploadIcon />
                </motion.span>
              )}
              {onStartFocus && !isFullyHarvested && (
                <button
                  type="button"
                  onClick={() => onStartFocus(goal.id, hour, slotRitualTitle ?? undefined, assignment?.subtaskId)}
                  className="shrink-0 flex items-center gap-1 px-2 py-1 rounded font-sans text-xs bg-stone-800 text-stone-50 hover:bg-stone-700 focus:outline-none focus:ring-2 focus:ring-moss-500/50"
                >
                  <span aria-hidden>▶</span>
                  <span>Play</span>
                </button>
              )}
              {onStartFocus && isFullyHarvested && (
                <button
                  type="button"
                  onClick={(e) => {
                    triggerHarvestConfetti(e);
                    onStartFocus(goal.id, hour, slotRitualTitle ?? undefined, assignment?.subtaskId);
                  }}
                  className="shrink-0 flex items-center gap-1 px-2 py-1 rounded font-sans text-xs bg-moss-600/90 text-stone-50 font-medium hover:bg-moss-600 focus:outline-none focus:ring-2 focus:ring-moss-500/50"
                  title="Harvested — tap to focus again"
                >
                  <span aria-hidden>✔</span>
                  <span>Harvested</span>
                </button>
              )}
            </div>
            {isFullyHarvested && onStartFocus && (
              <button
                type="button"
                onClick={(e) => {
                  triggerHarvestConfetti(e);
                  onStartFocus(goal.id, hour, slotRitualTitle ?? undefined, assignment?.subtaskId);
                }}
                className="self-start mt-1 font-sans text-xs text-moss-700 hover:text-moss-800 underline underline-offset-1 focus:outline-none focus:ring-2 focus:ring-moss-500/40 rounded"
              >
                Over-water (add more)
              </button>
            )}
            {estimatedMins > 0 && (
              <div className="mt-2 w-full">
                <div className="h-1 w-full rounded-full bg-stone-300 overflow-hidden" role="progressbar" aria-valuenow={Math.round(progressPercent)} aria-valuemin={0} aria-valuemax={100}>
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${progressBarColor}`}
                    style={{ width: `${Math.min(100, progressPercent)}%` }}
                  />
                </div>
              </div>
            )}
            {milestoneTitle && firstUncompleted && (
              <div className="flex items-center gap-2 mt-1.5">
                <input
                  type="checkbox"
                  checked={false}
                  onChange={() => onMilestoneCheck?.(goal.id, firstUncompleted.id, true)}
                  className="rounded border-stone-300 text-moss-500 focus:ring-moss-500/50 shrink-0"
                  aria-label={`Complete milestone: ${milestoneTitle}`}
                />
                <span className="font-sans text-xs text-stone-600 truncate">
                  Next: {milestoneTitle}
                </span>
              </div>
            )}
          </>
        ) : (
          <span className="font-sans text-sm relative z-10 text-stone-400">
            {onEmptySlotClick ? (isMobile ? 'Tap to add' : 'Add task') : 'Add task'}
          </span>
        )}
      </div>
    </div>
  );
}

function GoalMenu({ goal, onEdit, onCompost, onClose, anchorRef }) {
  const menuRef = useRef(null);
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target) && anchorRef?.current && !anchorRef.current.contains(e.target)) onClose?.();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose, anchorRef]);

  const handleCompost = () => {
    if (!window.confirm('Return this energy to the soil? (This cannot be undone).')) return;
    onCompost?.(goal.id);
    onClose?.();
  };

  return (
    <div ref={menuRef} className="absolute right-0 top-full z-50 mt-1 py-1 min-w-[160px] rounded-lg border border-stone-200 bg-stone-50 shadow-lg">
      <button
        type="button"
        onClick={() => { onEdit?.(goal); onClose?.(); }}
        className="w-full px-3 py-2 text-left font-sans text-sm text-stone-700 hover:bg-stone-100 focus:outline-none focus:bg-stone-100 rounded-none first:rounded-t-lg"
      >
        ✏️ Rename / Edit
      </button>
      <button
        type="button"
        onClick={handleCompost}
        className="w-full px-3 py-2 text-left font-sans text-sm text-stone-600 hover:bg-stone-100 focus:outline-none rounded-none last:rounded-b-lg"
      >
        ♻️ Compost
      </button>
    </div>
  );
}

/** Planned minutes for this goal from current week assignments (kaizen: by goalId; routine: by routine sessions) */
function getPlannedMinutesForGoal(goalId, assignments, goalEstimatedMinutes = 60) {
  if (!assignments || !goalId) return 0;
  return HOURS.reduce((sum, hour) => {
    const gid = getGoalIdFromAssignment(assignments[hour]);
    return gid === goalId ? sum + goalEstimatedMinutes : sum;
  }, 0);
}

/** Planned minutes for a routine goal: sum duration of all slots with parentGoalId === goalId */
function getPlannedMinutesForRoutine(goalId, assignments) {
  if (!assignments || !goalId) return 0;
  return HOURS.reduce((sum, hour) => {
    const a = assignments[hour];
    if (!isRoutineSession(a) || a.parentGoalId !== goalId) return sum;
    return sum + (a.duration ?? 60);
  }, 0);
}

/** Subtask status: bloom (done), withered (deadline passed), else bud */
function subtaskStatus(st) {
  const est = Number(st.estimatedHours) || 0;
  const done = Number(st.completedHours) || 0;
  const deadline = st.deadline ? new Date(st.deadline) : null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  if (deadline) {
    deadline.setHours(0, 0, 0, 0);
    if (deadline < now) return 'withered';
  }
  return est > 0 && done >= est ? 'bloom' : 'bud';
}

function SeedChip({ goal, item, isRitual = false, assignments = {}, onSeedClick, onMilestoneCheck, onEditGoal, onCompostGoal, onAddRoutineTime, onPlantRoutineBlock, onAddSubtask, onStartFocus, compact = false }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuAnchorRef = useRef(null);
  const dragId = isRitual && item?.id ? `ritual-${goal?.id}-${item.id}` : goal?.id;
  const dragData = isRitual && item ? { goal, ritualTitle: item.title } : { goal };
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: dragId, data: dragData });
  const isRoutine = goal?.type === 'routine';
  const displayTitle = isRitual && item?.title != null ? item.title : goal?.title;
  const smallLabel = isRitual && item ? (goal?.title ?? 'Routine') : (goal?.domain || (isRoutine ? 'Routine' : goal?.type || 'Kaizen'));
  const isBoost = goal?.energyImpact === 'boost' || item?.energyImpact === 'boost';
  const subtasks = goal?.subtasks ?? [];
  const milestones = goal?.milestones ?? [];
  const completedCount = milestones.filter((m) => m.completed).length;
  const totalSteps = milestones.length;
  const firstUncompleted = milestones.find((m) => !m.completed);
  const milestoneTitle = firstUncompleted?.title ?? firstUncompleted?.text;
  const targetHours = goal?.targetHours ?? 5;
  const plannedMinutes = getPlannedMinutesForGoal(goal?.id, assignments, goal?.estimatedMinutes ?? 60);
  const plannedMinutesRoutine = getPlannedMinutesForRoutine(goal?.id, assignments);
  const plannedHours = Math.round((plannedMinutes / 60) * 10) / 10;
  const filledHours = Math.round(((goal?.totalMinutes ?? 0) / 60) * 10) / 10;
  const plannedHoursFromSlots = Math.round((plannedMinutesRoutine / 60) * 10) / 10;
  const displayHours = isRoutine ? filledHours : plannedHours;
  const needsAttention = isRoutine ? filledHours + plannedHoursFromSlots < targetHours : displayHours < targetHours;
  if (!goal?.id) return null;

  if (compact) {
    const hoursLabel = isRoutine ? `${filledHours + plannedHoursFromSlots}/${targetHours}h` : `${displayHours}/${targetHours}h`;
    const chipClass = isRitual
      ? `shrink-0 flex flex-col gap-0.5 px-3 py-2 rounded-lg border-2 border-amber-200 bg-amber-50/80 shadow-sm font-sans text-sm text-stone-800 hover:border-amber-400 transition-colors relative ${isDragging ? 'opacity-50 shadow-md cursor-grabbing' : 'cursor-grab'}`
      : `shrink-0 flex flex-col gap-0.5 px-3 py-2 rounded-lg border border-stone-200 bg-white shadow-sm font-sans text-sm text-stone-800 hover:border-moss-500/50 transition-colors relative ${isDragging ? 'opacity-50 shadow-md cursor-grabbing' : 'cursor-grab'}`;
    return (
      <div ref={setNodeRef} className={chipClass}>
        <div className="flex items-center gap-1 min-w-0">
          <div {...listeners} {...attributes} className="flex-1 min-w-0 flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-moss-600 mb-0.5 truncate">{smallLabel}</span>
            <span className="font-sans text-sm text-stone-900 font-medium truncate flex items-center gap-1">
              {displayTitle}
              {isBoost && <span className="shrink-0 text-amber-500" aria-hidden title="Gives energy">⚡</span>}
            </span>
          </div>
          {onStartFocus && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onStartFocus(goal.id, null, displayTitle, undefined); }} className="shrink-0 flex items-center gap-1 px-2 py-1 rounded font-sans text-xs bg-moss-600 text-stone-50 hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/50" aria-label={`Do ${displayTitle} now`}>
              <span aria-hidden>▶️</span><span>Do It Now</span>
            </button>
          )}
          {onSeedClick && !isRoutine && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onSeedClick(goal); }} className="shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center p-0.5 rounded text-stone-400 hover:text-moss-600 hover:bg-moss-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40" aria-label="View milestones">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>
            </button>
          )}
          {(onEditGoal || onCompostGoal) && (
            <div className="relative shrink-0">
              <button type="button" ref={menuAnchorRef} onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }} className="min-h-[44px] min-w-[44px] flex items-center justify-center p-0.5 rounded text-stone-400 hover:text-stone-600 hover:bg-stone-100 focus:outline-none" aria-label="More options" aria-expanded={menuOpen}><span className="font-sans text-base leading-none">⋯</span></button>
              {menuOpen && <GoalMenu goal={goal} onEdit={onEditGoal} onCompost={onCompostGoal} onClose={() => setMenuOpen(false)} anchorRef={menuAnchorRef} />}
            </div>
          )}
        </div>
        <span className="font-sans text-xs text-stone-500">{hoursLabel}</span>
      </div>
    );
  }

  const fullChipClass = isRitual
    ? `shrink-0 flex flex-col gap-1 px-3 py-2 rounded-lg border-2 border-amber-200 bg-amber-50/80 shadow-sm font-sans text-sm text-stone-800 hover:border-amber-400 transition-colors relative ${isDragging ? 'opacity-50 shadow-md cursor-grabbing' : 'cursor-grab'}`
    : `shrink-0 flex flex-col gap-1 px-3 py-2 rounded-lg border border-stone-200 bg-white shadow-sm font-sans text-sm text-stone-800 hover:border-moss-500/50 transition-colors relative ${isDragging ? 'opacity-50 shadow-md cursor-grabbing' : 'cursor-grab'}`;
  return (
    <div ref={setNodeRef} className={fullChipClass}>
      <div className="flex items-center gap-1 min-w-0">
        <div {...listeners} {...attributes} className="flex-1 min-w-0 flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-wider text-moss-600 mb-0.5 truncate">
            {smallLabel}
          </span>
          <span className="font-sans text-sm text-stone-900 font-medium truncate flex items-center gap-1">
            {displayTitle}
            {isBoost && <span className="shrink-0 text-amber-500" aria-hidden title="Gives energy">⚡</span>}
          </span>
        </div>
        {onStartFocus && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onStartFocus(goal.id, null, displayTitle, undefined); }}
            className="shrink-0 flex items-center gap-1 px-2 py-1 rounded font-sans text-xs bg-moss-600 text-stone-50 hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/50"
            aria-label={`Do ${displayTitle} now`}
          >
            <span aria-hidden>▶️</span>
            <span>Do It Now</span>
          </button>
        )}
        {onSeedClick && !isRoutine && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onSeedClick(goal); }}
            className="shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center p-0.5 rounded text-stone-400 hover:text-moss-600 hover:bg-moss-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
            aria-label="View milestones"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          </button>
        )}
        {(onEditGoal || onCompostGoal) && (
          <div className="relative shrink-0">
            <button
              type="button"
              ref={menuAnchorRef}
              onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center p-0.5 rounded text-stone-400 hover:text-stone-600 hover:bg-stone-100 focus:outline-none"
              aria-label="More options"
              aria-expanded={menuOpen}
            >
              <span className="font-sans text-base leading-none">⋯</span>
            </button>
            {menuOpen && (
              <GoalMenu
                goal={goal}
                onEdit={onEditGoal}
                onCompost={onCompostGoal}
                onClose={() => setMenuOpen(false)}
                anchorRef={menuAnchorRef}
              />
            )}
          </div>
        )}
      </div>
      {!isRoutine && totalSteps > 0 && (
        <span className="font-sans text-xs text-stone-500" aria-label={`${completedCount} of ${totalSteps} steps completed`}>
          {completedCount}/{totalSteps} Steps
        </span>
      )}
      <div className="flex flex-col gap-0.5">
        {isRoutine ? (
          <>
            <div className="h-1.5 w-full rounded-full bg-stone-100 overflow-hidden flex" role="progressbar" aria-valuenow={filledHours + plannedHoursFromSlots} aria-valuemin={0} aria-valuemax={targetHours}>
              <div
                className="h-full bg-moss-600 transition-all rounded-l-full shrink-0"
                style={{ width: `${targetHours > 0 ? Math.min(100, (filledHours / targetHours) * 100) : 0}%` }}
              />
              <div
                className="h-full shrink-0 rounded-r-full border-l border-moss-500/50"
                style={{
                  width: `${targetHours > 0 ? Math.min(Math.max(0, 100 - (filledHours / targetHours) * 100), (plannedHoursFromSlots / targetHours) * 100) : 0}%`,
                  backgroundColor: 'rgba(74, 93, 35, 0.6)',
                  backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 2px, rgba(255,255,255,0.25) 2px, rgba(255,255,255,0.25) 4px)',
                }}
              />
            </div>
            <span className={`font-sans text-xs ${needsAttention ? 'text-orange-600' : 'text-stone-500'}`}>
              {filledHours}h Done + {plannedHoursFromSlots}h Planned / {targetHours}h Target {needsAttention && '(Needs Attention)'}
            </span>
          </>
        ) : (
          <>
            <div className="h-1 w-full rounded-full bg-stone-100 overflow-hidden" role="progressbar" aria-valuenow={displayHours} aria-valuemin={0} aria-valuemax={targetHours}>
              <div
                className={`h-full rounded-full transition-all ${needsAttention ? 'bg-amber-500' : 'bg-moss-500'}`}
                style={{ width: `${Math.min(100, targetHours > 0 ? (displayHours / targetHours) * 100 : 0)}%` }}
              />
            </div>
            <span className={`font-sans text-xs ${needsAttention ? 'text-orange-600' : 'text-stone-500'}`}>
              {displayHours} / {targetHours} Hours Planned {needsAttention && '(Needs Attention)'}
            </span>
          </>
        )}
      </div>
      {isRoutine && subtasks.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1" onClick={(e) => e.stopPropagation()}>
          {subtasks.map((st) => {
            const status = subtaskStatus(st);
            return (
              <span
                key={st.id}
                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs ${
                  status === 'bloom' ? 'bg-moss-200 text-moss-800' : status === 'withered' ? 'bg-stone-200 text-stone-500' : 'bg-amber-100 text-amber-800'
                }`}
                title={st.title}
              >
                {status === 'bloom' ? '🌸' : status === 'withered' ? '🍂' : '🌱'}
                <span className="truncate max-w-[80px]">{st.title}</span>
              </span>
            );
          })}
        </div>
      )}
      {isRoutine && (onAddRoutineTime || onPlantRoutineBlock || onAddSubtask) && (
        <div className="flex items-center gap-2 mt-0.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
          {onAddSubtask && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const title = window.prompt('Project name?', '');
                if (title?.trim()) onAddSubtask(goal.id, { title: title.trim(), estimatedHours: 0, completedHours: 0, deadline: null, color: null });
              }}
              className="shrink-0 px-2 py-1.5 rounded-lg border border-dashed border-moss-400 bg-moss-50 font-sans text-xs text-moss-700 hover:bg-moss-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
              aria-label="Add project"
            >
              ➕ Add Project
            </button>
          )}
          {onAddRoutineTime && (
            <>
              <button
                type="button"
                onClick={() => onAddRoutineTime(goal.id, -30)}
                className="shrink-0 w-8 h-8 rounded-lg border border-stone-200 bg-stone-50 font-sans text-stone-600 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
                aria-label="Remove 30 minutes"
              >
                −
              </button>
              <span className="font-sans text-xs text-stone-500 shrink-0">30m</span>
              <button
                type="button"
                onClick={() => onAddRoutineTime(goal.id, 30)}
                className="shrink-0 w-8 h-8 rounded-lg border border-moss-300 bg-moss-50 font-sans text-moss-700 hover:bg-moss-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
                aria-label="Add 30 minutes"
              >
                +
              </button>
            </>
          )}
          {onPlantRoutineBlock && (
            <button
              type="button"
              onClick={() => onPlantRoutineBlock(goal)}
              className="shrink-0 px-2 py-1.5 rounded-lg border border-moss-400 bg-moss-100 font-sans text-xs text-moss-800 hover:bg-moss-200 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
              aria-label="Add 1 hour to first empty slot"
            >
              +1h
            </button>
          )}
        </div>
      )}
      {!isRoutine && milestoneTitle && firstUncompleted && onMilestoneCheck && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={false}
            onChange={(e) => { e.stopPropagation(); onMilestoneCheck(goal.id, firstUncompleted.id, true); }}
            className="rounded border-stone-300 text-moss-500 focus:ring-moss-500/50 shrink-0"
            aria-label={`Complete: ${milestoneTitle}`}
          />
          <span className="font-sans text-xs text-stone-600 truncate">Next: {milestoneTitle}</span>
        </div>
      )}
    </div>
  );
}

/** Ritual seed: goal + ritual title for today; drag stores ritualTitle so session config shows ritual name */
function RitualSeedChip({ goal, ritualTitle, assignments = {}, onSeedClick, onMilestoneCheck, onEditGoal, onCompostGoal, onAddRoutineTime, onPlantRoutineBlock, onStartFocus }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuAnchorRef = useRef(null);
  const dragId = `ritual-${goal.id}`;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: dragId, data: { goal, ritualTitle } });
  const isRoutine = goal?.type === 'routine';
  const milestones = goal?.milestones ?? [];
  const completedCount = milestones.filter((m) => m.completed).length;
  const totalSteps = milestones.length;
  const firstUncompleted = milestones.find((m) => !m.completed);
  const milestoneTitle = firstUncompleted?.title ?? firstUncompleted?.text;
  const targetHours = goal?.targetHours ?? 5;
  const plannedMinutes = getPlannedMinutesForGoal(goal?.id, assignments, goal?.estimatedMinutes ?? 60);
  const plannedHours = Math.round((plannedMinutes / 60) * 10) / 10;
  const plannedMinutesRoutine = getPlannedMinutesForRoutine(goal?.id, assignments);
  const plannedHoursFromSlots = Math.round((plannedMinutesRoutine / 60) * 10) / 10;
  const filledHours = Math.round(((goal?.totalMinutes ?? 0) / 60) * 10) / 10;
  const displayHours = isRoutine ? filledHours : plannedHours;
  const needsAttention = isRoutine ? (filledHours + plannedHoursFromSlots < targetHours) : (displayHours < targetHours);
  if (!goal?.id) return null;
  return (
    <div
      ref={setNodeRef}
      className={`shrink-0 flex flex-col gap-1 px-3 py-2 rounded-lg border-2 border-amber-200 bg-amber-50/80 shadow-sm font-sans text-sm text-stone-800 hover:border-amber-400 transition-colors relative ${
        isDragging ? 'opacity-50 shadow-md cursor-grabbing' : 'cursor-grab'
      }`}
    >
      <div className="flex items-center gap-1 min-w-0">
        <div {...listeners} {...attributes} className="flex-1 min-w-0 flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-wider text-moss-600 mb-0.5 truncate">
            {goal.title}
          </span>
          <span className="font-sans text-sm text-stone-900 font-medium truncate">{ritualTitle || goal.title}</span>
        </div>
        {onStartFocus && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onStartFocus(goal.id, null, ritualTitle ?? goal.title, undefined); }}
            className="shrink-0 flex items-center gap-1 px-2 py-1 rounded font-sans text-xs bg-moss-600 text-stone-50 hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/50"
            aria-label={`Do ${ritualTitle || goal.title} now`}
          >
            <span aria-hidden>▶️</span>
            <span>Do It Now</span>
          </button>
        )}
        {onSeedClick && !isRoutine && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onSeedClick(goal); }}
            className="shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center p-0.5 rounded text-stone-400 hover:text-moss-600 hover:bg-moss-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
            aria-label="View milestones"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          </button>
        )}
        {(onEditGoal || onCompostGoal) && (
          <div className="relative shrink-0">
            <button
              type="button"
              ref={menuAnchorRef}
              onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center p-0.5 rounded text-stone-400 hover:text-stone-600 hover:bg-stone-100 focus:outline-none"
              aria-label="More options"
              aria-expanded={menuOpen}
            >
              <span className="font-sans text-base leading-none">⋯</span>
            </button>
            {menuOpen && (
              <GoalMenu
                goal={goal}
                onEdit={onEditGoal}
                onCompost={onCompostGoal}
                onClose={() => setMenuOpen(false)}
                anchorRef={menuAnchorRef}
              />
            )}
          </div>
        )}
      </div>
      {!isRoutine && totalSteps > 0 && (
        <span className="font-sans text-xs text-stone-500" aria-label={`${completedCount} of ${totalSteps} steps completed`}>
          {completedCount}/{totalSteps} Steps
        </span>
      )}
      <div className="flex flex-col gap-0.5">
        {isRoutine ? (
          <>
            <div className="h-1.5 w-full rounded-full bg-stone-100 overflow-hidden flex" role="progressbar" aria-valuenow={filledHours + plannedHoursFromSlots} aria-valuemin={0} aria-valuemax={targetHours}>
              <div
                className="h-full bg-moss-600 transition-all rounded-l-full shrink-0"
                style={{ width: `${targetHours > 0 ? Math.min(100, (filledHours / targetHours) * 100) : 0}%` }}
              />
              <div
                className="h-full shrink-0 rounded-r-full border-l border-moss-500/50"
                style={{
                  width: `${targetHours > 0 ? Math.min(Math.max(0, 100 - (filledHours / targetHours) * 100), (plannedHoursFromSlots / targetHours) * 100) : 0}%`,
                  backgroundColor: 'rgba(74, 93, 35, 0.6)',
                  backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 2px, rgba(255,255,255,0.25) 2px, rgba(255,255,255,0.25) 4px)',
                }}
              />
            </div>
            <span className={`font-sans text-xs ${needsAttention ? 'text-orange-600' : 'text-stone-500'}`}>
              {filledHours}h Done + {plannedHoursFromSlots}h Planned / {targetHours}h Target {needsAttention && '(Needs Attention)'}
            </span>
          </>
        ) : (
          <>
            <div className="h-1 w-full rounded-full bg-stone-100 overflow-hidden" role="progressbar" aria-valuenow={displayHours} aria-valuemin={0} aria-valuemax={targetHours}>
              <div
                className={`h-full rounded-full transition-all ${needsAttention ? 'bg-amber-500' : 'bg-moss-500'}`}
                style={{ width: `${Math.min(100, targetHours > 0 ? (displayHours / targetHours) * 100 : 0)}%` }}
              />
            </div>
            <span className={`font-sans text-xs ${needsAttention ? 'text-orange-600' : 'text-stone-500'}`}>
              {displayHours} / {targetHours} Hours Planned {needsAttention && '(Needs Attention)'}
            </span>
          </>
        )}
      </div>
      {isRoutine && (onAddRoutineTime || onPlantRoutineBlock) && (
        <div className="flex items-center gap-2 mt-0.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
          {onAddRoutineTime && (
            <>
              <button
                type="button"
                onClick={() => onAddRoutineTime(goal.id, -30)}
                className="shrink-0 w-8 h-8 rounded-lg border border-stone-200 bg-stone-50 font-sans text-stone-600 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
                aria-label="Remove 30 minutes"
              >
                −
              </button>
              <span className="font-sans text-xs text-stone-500 shrink-0">30m</span>
              <button
                type="button"
                onClick={() => onAddRoutineTime(goal.id, 30)}
                className="shrink-0 w-8 h-8 rounded-lg border border-moss-300 bg-moss-50 font-sans text-moss-700 hover:bg-moss-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
                aria-label="Add 30 minutes"
              >
                +
              </button>
            </>
          )}
          {onPlantRoutineBlock && (
            <button
              type="button"
              onClick={() => onPlantRoutineBlock(goal)}
              className="shrink-0 px-2 py-1.5 rounded-lg border border-moss-400 bg-moss-100 font-sans text-xs text-moss-800 hover:bg-moss-200 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
              aria-label="Add 1 hour to first empty slot"
            >
              +1h
            </button>
          )}
        </div>
      )}
      {!isRoutine && milestoneTitle && firstUncompleted && onMilestoneCheck && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={false}
            onChange={(e) => { e.stopPropagation(); onMilestoneCheck(goal.id, firstUncompleted.id, true); }}
            className="rounded border-stone-300 text-moss-500 focus:ring-moss-500/50 shrink-0"
            aria-label={`Complete: ${milestoneTitle}`}
          />
          <span className="font-sans text-xs text-stone-600 truncate">Next: {milestoneTitle}</span>
        </div>
      )}
    </div>
  );
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function getWeekDates() {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return localISODate(d);
  });
}

function summarizeDayAssignments(dayAssign, goals) {
  if (!dayAssign || typeof dayAssign !== 'object') return [];
  const goalHours = {};
  Object.values(dayAssign).forEach((a) => {
    const gid = getGoalIdFromAssignment(a);
    if (!gid) return;
    goalHours[gid] = (goalHours[gid] || 0) + 1;
  });
  return Object.entries(goalHours).map(([gid, hours]) => {
    const goal = goals.find((g) => g.id === gid);
    return { goalId: gid, title: goal?.title ?? 'Task', hours, type: goal?.type ?? 'kaizen' };
  });
}

function getWeekWeather(calendarEvents, dateStr) {
  const dayEvents = (calendarEvents ?? []).filter((e) => {
    const d = e.start ? new Date(e.start) : e.date ? new Date(e.date) : null;
    return d && localISODate(d) === dateStr;
  });
  const count = dayEvents.length;
  if (count >= 4) return { icon: 'storm', events: dayEvents };
  if (count >= 2) return { icon: 'cloud', events: dayEvents };
  return { icon: 'sun', events: dayEvents };
}

const WeatherBadge = ({ type }) => {
  if (type === 'storm') return <span className="text-sm" title="Busy day">⛈️</span>;
  if (type === 'cloud') return <span className="text-sm" title="Some events">🌤️</span>;
  return <span className="text-sm" title="Clear day">☀️</span>;
};

function WeekView({ weekAssignments, goals, onDayClick, onPlanWeek, planningWeek, weekPreview, onConfirmWeekPlan, onDiscardWeekPlan, calendarEvents }) {
  const dates = useMemo(() => getWeekDates(), []);
  const todayStr = useMemo(() => localISODate(), []);
  const displayAssignments = weekPreview ?? weekAssignments;

  const weekStats = useMemo(() => {
    let totalPlanned = 0;
    dates.forEach((d) => {
      const da = displayAssignments[d] ?? {};
      const s = summarizeDayAssignments(da, goals);
      totalPlanned += s.reduce((sum, x) => sum + x.hours, 0);
    });
    return { totalPlanned };
  }, [dates, displayAssignments, goals]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-serif text-stone-800 text-base">This Week</h3>
          <p className="font-sans text-xs text-stone-400 mt-0.5">{weekStats.totalPlanned}h planned across the week</p>
        </div>
        <div className="flex items-center gap-2">
          {weekPreview && onConfirmWeekPlan && (
            <>
              <button
                type="button"
                onClick={onDiscardWeekPlan}
                className="px-3 py-1.5 rounded-lg border border-stone-300 bg-white font-sans text-sm text-stone-600 hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-stone-300/40 transition-colors"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={onConfirmWeekPlan}
                className="px-3 py-1.5 rounded-lg border border-moss-500 bg-moss-600 font-sans text-sm text-white hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/40 transition-colors"
              >
                Apply Plan
              </button>
            </>
          )}
          {!weekPreview && onPlanWeek && (
            <button
              type="button"
              onClick={onPlanWeek}
              disabled={planningWeek}
              className="px-3 py-1.5 rounded-lg border border-moss-300 bg-moss-50 font-sans text-sm text-moss-800 hover:bg-moss-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40 disabled:opacity-60 transition-colors"
            >
              {planningWeek ? 'Planning...' : '✨ Plan My Week'}
            </button>
          )}
        </div>
      </div>
      {weekPreview && (
        <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 font-sans text-sm text-amber-800">
          Preview — review the plan below, then <strong>Apply</strong> or <strong>Discard</strong>.
        </div>
      )}
      <div className="min-w-0 overflow-x-auto pb-2 -mx-1 px-1">
        <div className="grid grid-cols-7 gap-1.5 min-w-[280px] w-max max-w-full mx-auto">
        {dates.map((dateStr, i) => {
          const dayAssign = displayAssignments[dateStr] ?? {};
          const summary = summarizeDayAssignments(dayAssign, goals);
          const totalHours = summary.reduce((s, x) => s + x.hours, 0);
          const isToday = dateStr === todayStr;
          const isPast = dateStr < todayStr;
          const dayNum = new Date(dateStr + 'T12:00:00').getDate();
          const weather = getWeekWeather(calendarEvents, dateStr);
          const eventCount = weather.events.length;
          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => onDayClick?.(dateStr)}
              className={`flex flex-col rounded-xl p-2.5 min-h-[140px] border transition-all text-left focus:outline-none focus:ring-2 focus:ring-moss-500/40 group min-w-0 ${
                isToday
                  ? 'border-moss-500 bg-moss-50/80 ring-1 ring-moss-500/30 shadow-sm'
                  : isPast
                    ? 'border-stone-100 bg-stone-50/50 text-stone-400'
                    : 'border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1">
                  <WeatherBadge type={weather.icon} />
                  <span className={`font-sans text-xs font-semibold ${isToday ? 'text-moss-700' : isPast ? 'text-stone-400' : 'text-stone-500'}`}>
                    {DAY_LABELS[i]}
                  </span>
                </div>
                <span className={`font-sans text-sm tabular-nums font-medium ${isToday ? 'text-moss-600' : isPast ? 'text-stone-300' : 'text-stone-400'}`}>
                  {dayNum}
                </span>
              </div>
              {eventCount > 0 && (
                <div className="mb-1.5 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-100">
                  <span className="font-sans text-[10px] text-amber-700">
                    {eventCount} event{eventCount > 1 ? 's' : ''}
                  </span>
                </div>
              )}
              {summary.length === 0 ? (
                <span className="font-sans text-xs text-stone-300 mt-auto italic">No tasks</span>
              ) : (
                <div className="flex flex-col gap-0.5 flex-1">
                  {summary.slice(0, 3).map((s) => (
                    <div
                      key={s.goalId}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-sans truncate ${
                        s.type === 'routine' ? 'bg-slate-100 text-slate-600' : 'bg-moss-100 text-moss-700'
                      }`}
                      title={`${s.title} — ${s.hours}h`}
                    >
                      {s.title}
                    </div>
                  ))}
                  {summary.length > 3 && (
                    <span className="font-sans text-[10px] text-stone-400">+{summary.length - 3} more</span>
                  )}
                </div>
              )}
              <div className="mt-auto pt-1.5 flex items-center justify-between">
                {totalHours > 0 ? (
                  <span className="font-sans text-[10px] text-stone-400 tabular-nums">{totalHours}h</span>
                ) : <span />}
                <span className="font-sans text-[10px] text-stone-300 opacity-0 group-hover:opacity-100 transition-opacity">view →</span>
              </div>
            </button>
          );
        })}
        </div>
      </div>
    </div>
  );
}

function MonthPlanView({ weekAssignments, goals, onDayClick, monthlyRoadmap, onPlanMonth, planningMonth, calendarEvents = [] }) {
  const today = useMemo(() => new Date(), []);
  const year = today.getFullYear();
  const month = today.getMonth();
  const todayStr = localISODate(today);
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDow = (firstDay.getDay() + 6) % 7;

  const cells = useMemo(() => {
    const arr = [];
    for (let i = 0; i < startDow; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      arr.push(ds);
    }
    return arr;
  }, [year, month, startDow, daysInMonth]);

  const monthStats = useMemo(() => {
    let totalHours = 0;
    let plannedDays = 0;
    cells.forEach((dateStr) => {
      if (!dateStr) return;
      const da = weekAssignments[dateStr] ?? {};
      const slots = Object.keys(da).length;
      if (slots > 0) { plannedDays++; totalHours += slots; }
    });
    return { totalHours, plannedDays, daysInMonth };
  }, [cells, weekAssignments, daysInMonth]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-serif text-stone-800 text-base">{MONTH_NAMES[month]} {year}</h3>
          <p className="font-sans text-xs text-stone-400 mt-0.5">
            {monthStats.totalHours}h across {monthStats.plannedDays} of {monthStats.daysInMonth} days
          </p>
        </div>
        {onPlanMonth && (
          <button
            type="button"
            onClick={onPlanMonth}
            disabled={planningMonth}
            className="px-3 py-1.5 rounded-lg border border-moss-300 bg-moss-50 font-sans text-sm text-moss-800 hover:bg-moss-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40 disabled:opacity-60 transition-colors"
          >
            {planningMonth ? 'Planning...' : '✨ Plan My Month'}
          </button>
        )}
      </div>

      {monthlyRoadmap && (
        <div className="p-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200">
          <p className="font-sans text-sm font-medium text-amber-900 mb-1.5">Monthly Roadmap</p>
          {monthlyRoadmap.summary && <p className="font-sans text-xs text-amber-700 mb-2">{monthlyRoadmap.summary}</p>}
          {Array.isArray(monthlyRoadmap.weeks) && (
            <div className="grid grid-cols-2 gap-2">
              {monthlyRoadmap.weeks.map((w, i) => (
                <div key={i} className="p-2 rounded-lg bg-white/60 border border-amber-100">
                  <span className="font-sans text-[10px] font-semibold text-amber-600 uppercase tracking-wider">Week {i + 1}</span>
                  <p className="font-sans text-xs text-amber-800 mt-0.5">
                    {w.focus || Object.entries(w.goals || {}).map(([id, h]) => {
                      const g = goals.find((x) => x.id === id);
                      return `${g?.title ?? id}: ${h}h`;
                    }).join(', ')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-7 gap-1">
        {DAY_LABELS.map((d) => (
          <div key={d} className="text-center font-sans text-[10px] font-semibold text-stone-400 py-1">{d}</div>
        ))}
        {cells.map((dateStr, i) => {
          if (!dateStr) return <div key={`empty-${i}`} />;
          const dayAssign = weekAssignments[dateStr] ?? {};
          const slotCount = Object.keys(dayAssign).length;
          const weather = getWeekWeather(calendarEvents, dateStr);
          const eventCount = weather.events.length;
          const isToday = dateStr === todayStr;
          const isPast = dateStr < todayStr;
          const dayNum = new Date(dateStr + 'T12:00:00').getDate();
          const density = slotCount === 0 ? 'none' : slotCount <= 3 ? 'light' : slotCount <= 6 ? 'medium' : 'heavy';
          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => onDayClick?.(dateStr)}
              className={`relative aspect-square flex flex-col items-center justify-center rounded-lg font-sans text-xs transition-all focus:outline-none focus:ring-2 focus:ring-moss-500/30 group ${
                isToday
                  ? 'ring-2 ring-moss-500 font-bold text-moss-800 bg-moss-50'
                  : isPast
                    ? 'text-stone-400 bg-stone-50/50'
                    : 'text-stone-600 hover:bg-stone-100'
              }`}
              title={`${slotCount > 0 ? slotCount + 'h planned' : 'No tasks'}${eventCount > 0 ? ' · ' + eventCount + ' event' + (eventCount > 1 ? 's' : '') : ''}`}
            >
              {dayNum}
              <div className="flex gap-px mt-0.5">
                {density !== 'none' && (
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    density === 'light' ? 'bg-moss-400' : density === 'medium' ? 'bg-amber-400' : 'bg-red-400'
                  }`} />
                )}
                {eventCount > 0 && (
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    eventCount >= 4 ? 'bg-purple-500' : eventCount >= 2 ? 'bg-sky-400' : 'bg-sky-300'
                  }`} />
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-3 pt-1 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-moss-400" />
          <span className="font-sans text-[10px] text-stone-500">Light</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="font-sans text-[10px] text-stone-500">Moderate</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-400" />
          <span className="font-sans text-[10px] text-stone-500">Heavy</span>
        </div>
        <span className="text-stone-300">|</span>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-sky-400" />
          <span className="font-sans text-[10px] text-stone-500">Calendar</span>
        </div>
      </div>
    </div>
  );
}

function DayDetailModal({ dateStr, dayAssignments, goals, onClose, onSwitchToDay, calendarEvents = [] }) {
  if (!dateStr) return null;
  const dateObj = new Date(dateStr + 'T12:00:00');
  const label = dateObj.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const summary = summarizeDayAssignments(dayAssignments, goals);
  const totalHours = summary.reduce((s, x) => s + x.hours, 0);
  const filledHours = HOURS.filter((h) => dayAssignments[h]);
  const dayCalEvents = (calendarEvents ?? []).filter((e) => {
    const d = e.start ? new Date(e.start) : e.date ? new Date(e.date) : null;
    return d && localISODate(d) === dateStr;
  });

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-2xl shadow-xl border border-stone-200 w-full max-w-md max-h-[80vh] flex flex-col"
        >
          <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
            <div>
              <h3 className="font-serif text-stone-900 text-lg">{label}</h3>
              <p className="font-sans text-xs text-stone-500 mt-0.5">{totalHours}h planned · {filledHours.length} slots filled</p>
            </div>
            <button type="button" onClick={onClose} className="min-h-[44px] min-w-[44px] flex items-center justify-center p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100" aria-label="Close">
              <span className="text-lg leading-none">×</span>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-3">
            {dayCalEvents.length > 0 && (
              <div className="mb-3">
                <p className="font-sans text-[10px] font-semibold text-sky-600 uppercase tracking-wider mb-1.5">Calendar Events</p>
                <div className="space-y-1">
                  {dayCalEvents.map((ev, idx) => {
                    const startTime = ev.start ? new Date(ev.start) : null;
                    const timeLabel = startTime ? startTime.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '';
                    return (
                      <div key={ev.id || idx} className="flex items-center gap-3 py-1.5 px-3 rounded-lg bg-sky-50 border border-sky-100">
                        <span className="font-mono text-xs text-sky-500 w-12 shrink-0">{timeLabel}</span>
                        <span className="font-sans text-sm text-sky-800 flex-1 min-w-0 truncate">{ev.title}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-sans font-medium ${
                          ev.type === 'storm' ? 'bg-red-100 text-red-600' : ev.type === 'sun' ? 'bg-amber-100 text-amber-600' : 'bg-sky-100 text-sky-600'
                        }`}>{ev.type === 'storm' ? 'Busy' : ev.type === 'sun' ? 'Break' : 'Event'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {filledHours.length === 0 && dayCalEvents.length === 0 ? (
              <p className="font-sans text-sm text-stone-400 py-8 text-center">Nothing planned yet.</p>
            ) : filledHours.length === 0 ? null : (
              <div className="space-y-1">
                {filledHours.length > 0 && dayCalEvents.length > 0 && (
                  <p className="font-sans text-[10px] font-semibold text-moss-600 uppercase tracking-wider mb-1.5">Kaizen Schedule</p>
                )}
                {HOURS.map((hour) => {
                  const a = dayAssignments[hour];
                  if (!a) return null;
                  const gid = getGoalIdFromAssignment(a);
                  const goal = goals.find((g) => g.id === gid);
                  const ritualTitle = getRitualTitleFromAssignment(a);
                  const isRoutine = a && typeof a === 'object' && a.type === 'routine';
                  return (
                    <div key={hour} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-stone-50">
                      <span className="font-mono text-xs text-stone-400 w-12 shrink-0">{hour}</span>
                      <div className="flex-1 min-w-0">
                        <span className={`font-sans text-sm font-medium ${isRoutine ? 'text-slate-700' : 'text-stone-900'}`}>
                          {goal?.title ?? 'Task'}
                        </span>
                        {ritualTitle && (
                          <span className="font-sans text-xs text-stone-500 ml-2">· {ritualTitle}</span>
                        )}
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-sans font-medium ${
                        isRoutine ? 'bg-slate-100 text-slate-600' : 'bg-moss-100 text-moss-700'
                      }`}>
                        {isRoutine ? 'Routine' : 'Kaizen'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="px-5 py-3 border-t border-stone-100 flex gap-2">
            {onSwitchToDay && (
              <button
                type="button"
                onClick={onSwitchToDay}
                className="flex-1 py-2 rounded-lg bg-moss-600 text-white font-sans text-sm hover:bg-moss-700 transition-colors"
              >
                Edit this day
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-stone-200 font-sans text-sm text-stone-600 hover:bg-stone-50 transition-colors"
            >
              Close
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function ViewToggle({ value, onChange }) {
  return (
    <div className="inline-flex rounded-lg border border-stone-200 bg-stone-100 p-0.5">
      {[
        { id: 'day', label: 'Day' },
        { id: 'week', label: 'Week' },
        { id: 'month', label: 'Month' },
      ].map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`px-3 py-1 rounded-md font-sans text-sm transition-colors ${
            value === id ? 'bg-white text-stone-900 shadow-sm font-medium' : 'text-stone-500 hover:text-stone-700'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function TimeSlicer({
  weather = 'sun',
  goals = [],
  todayRitualItems = [],
  goalBank = [],
  dailyEnergyModifier = 0,
  dailySpoonCount = null,
  assignments: controlledAssignments,
  onAssignmentsChange,
  onStartFocus,
  onSeedClick,
  onMilestoneCheck,
  onEditGoal,
  onCompostGoal,
  onAddRoutineTime,
  onAutoFillWeek,
  onAddSubtask,
  onLoadLightened,
  onOpenGoalCreator,
  autoFillLoading = false,
  googleToken: googleTokenProp = null,
  hideCapacityOnMobile = false,
  calendarEvents = [],
  onPlanWeek,
  onPlanMonth,
  planningWeek = false,
  weekPreview = null,
  onConfirmWeekPlan,
  onDiscardWeekPlan,
  monthlyRoadmap = null,
}) {
  const { googleToken: googleTokenContext } = useGarden();
  const googleToken = googleTokenProp ?? googleTokenContext ?? null;

  const [viewMode, setViewMode] = useState('day'); // 'day' | 'week' | 'month'
  const [editingDate, setEditingDate] = useState(null); // null = today, 'YYYY-MM-DD' = specific date
  const [internalAssignments, setInternalAssignments] = useState({});
  const [recentlyExportedSlot, setRecentlyExportedSlot] = useState(null);
  const [pendingRoutineDrop, setPendingRoutineDrop] = useState(null); // { time, goal, value }
  const [seedPickerTargetHour, setSeedPickerTargetHour] = useState(null);
  const [spoonsToast, setSpoonsToast] = useState(false);
  const [autoPlanToast, setAutoPlanToast] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT);
  const { weekAssignments, loadWeekPlans, loadDayPlan, saveDayPlanForDate } = useGarden();
  const isControlled = onAssignmentsChange != null;
  const assignments = isControlled ? controlledAssignments ?? {} : internalAssignments;

  const viewedDate = editingDate ? new Date(editingDate + 'T12:00:00') : now;
  const currentDay = viewedDate.getDay();
  const dayOfMonth = viewedDate.getDate();
  const isEvenWeek = Math.floor((viewedDate.getTime() - new Date(viewedDate.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000)) % 2 === 0;
  const routines = goals.filter((g) => g.type === 'routine');
  const todayRitualEntries = useMemo(
    () =>
      routines.flatMap((goal) =>
        (goal.rituals || [])
          .filter((r) => {
            if (r.frequency === 'monthly') return Number(r.monthDay) === dayOfMonth;
            if (r.frequency === 'biweekly' && !isEvenWeek) return false;
            return r.days && r.days.includes(currentDay);
          })
          .map((r) => ({ goal, ritual: r }))
      ),
    [goals, currentDay, dayOfMonth, isEvenWeek]
  );

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const interval = setInterval(tick, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (viewMode === 'week' || viewMode === 'month') loadWeekPlans();
  }, [viewMode, loadWeekPlans]);

  const applyAssignment = (time, value) => {
    const next = { ...assignments, [time]: value };
    if (isControlled) onAssignmentsChange(next);
    else setInternalAssignments(next);
  };

  useEffect(() => {
    if (recentlyExportedSlot == null) return;
    const t = setTimeout(() => setRecentlyExportedSlot(null), 2500);
    return () => clearTimeout(t);
  }, [recentlyExportedSlot]);

  useEffect(() => {
    if (!spoonsToast) return;
    const t = setTimeout(() => setSpoonsToast(false), 4000);
    return () => clearTimeout(t);
  }, [spoonsToast]);

  useEffect(() => {
    if (!autoPlanToast) return;
    const t = setTimeout(() => setAutoPlanToast(false), 3000);
    return () => clearTimeout(t);
  }, [autoPlanToast]);

  const handleAutoPlanDay = () => {
    const energyLevel =
      typeof dailySpoonCount === 'number' && dailySpoonCount >= 1 && dailySpoonCount <= 12
        ? dailySpoonCount
        : dailyEnergyModifier < 0
          ? 'low'
          : dailyEnergyModifier > 0
            ? 'high'
            : 'normal';
    const plan = autoFillDailyPlan(goals, calendarEvents, energyLevel);
    const next = { ...assignments, ...plan };
    if (isControlled) onAssignmentsChange(next);
    else setInternalAssignments(next);
    setAutoPlanToast(true);
  };

  const baseCapacity = MAX_SLOTS_BY_WEATHER[weather] ?? 6;
  const maxSlots =
    typeof dailySpoonCount === 'number' && dailySpoonCount >= 0 && dailySpoonCount <= 12
      ? dailySpoonCount
      : Math.max(1, baseCapacity + dailyEnergyModifier);
  const isLowEnergy =
    (typeof dailySpoonCount === 'number' && dailySpoonCount <= 4) || dailyEnergyModifier === -2;
  const filledTimes = HOURS.filter((h) => assignments[h] != null);
  const filledSpoonTotal = HOURS.reduce((sum, h) => {
    const a = assignments[h];
    if (!a) return sum;
    if (a && typeof a === 'object' && (a.type === 'recovery' || a.spoonCost === 0)) return sum;
    const gid = getGoalIdFromAssignment(a);
    const goal = goals.find((g) => g.id === gid);
    return sum + getSpoonCost(goal ?? a);
  }, 0);
  const isOverCapacity = filledSpoonTotal > maxSlots;

  const handleLightenLoad = () => {
    const energyModifier =
      typeof dailySpoonCount === 'number' && dailySpoonCount <= 12
        ? (dailySpoonCount <= 4 ? -2 : dailySpoonCount >= 9 ? 1 : 0)
        : dailyEnergyModifier;
    const result = suggestLoadLightening(assignments, goals, maxSlots, energyModifier);
    if (result != null) {
      if (isControlled) onAssignmentsChange(result.assignments);
      else setInternalAssignments(result.assignments);
      onLoadLightened?.(result.removedItems);
    }
  };

  /** Plant one 1h routine block in the first empty slot. Used by [+1h] on routine cards. */
  const handlePlantRoutineBlock = (goal) => {
    if (!goal?.id || goal?.type !== 'routine') return;
    const firstEmpty = HOURS.find((h) => !assignments[h]);
    if (!firstEmpty) return;
    const value = {
      id: crypto.randomUUID?.() ?? `s-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      parentGoalId: goal.id,
      title: goal.title,
      type: 'routine',
      duration: 60,
      spoonCost: getSpoonCost(goal),
    };
    const next = { ...assignments, [firstEmpty]: value };
    if (isControlled) onAssignmentsChange(next);
    else setInternalAssignments(next);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || !active) return;
    const time = String(over.id);
    if (!HOURS.includes(time)) return;
    const data = active.data?.current;
    const ritualTitle = data?.ritualTitle;
    const goalId = data?.goal?.id ?? active.id;
    const goal = goals.find((g) => g.id === goalId);
    const targetWasEmpty = !assignments[time];

    let value;
    if (goal?.type === 'routine') {
      value = {
        id: crypto.randomUUID?.() ?? `s-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        parentGoalId: goal.id,
        title: goal.title,
        type: 'routine',
        duration: 60,
        spoonCost: getSpoonCost(goal),
      };
      const subtasks = goal.subtasks ?? [];
      if (subtasks.length > 0) {
        setPendingRoutineDrop({ time, goal, value });
        return;
      }
    } else {
      value = ritualTitle ? { goalId, ritualTitle } : goalId;
    }

    applyAssignment(time, value);

    if (googleToken && goal?.type !== 'routine') {
      if (goal?.title) {
        const [hourStr, minStr] = time.split(':');
        const startTime = new Date();
        startTime.setHours(parseInt(hourStr, 10), parseInt(minStr || '0', 10), 0, 0);
        const durationMinutes = goal.estimatedMinutes ?? 60;
        const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
        createGoogleEvent(googleToken, {
          title: goal.title,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        })
          .then(() => {
            console.log('Event saved to Google Calendar:', goal.title);
            setRecentlyExportedSlot(time);
          })
          .catch((e) => console.warn('TimeSlicer: create Google event failed', e));
      }
    }
  };

  const handleProjectSelect = (subtask) => {
    if (!pendingRoutineDrop) return;
    const { time, value } = pendingRoutineDrop;
    const nextValue = subtask
      ? { ...value, subtaskId: subtask.id, subtaskTitle: subtask.title }
      : value;
    applyAssignment(time, nextValue);
    setPendingRoutineDrop(null);
  };

  /** Assign a goal/ritual to the given hour (used by Seed Picker modal on mobile). */
  const handleSelectSeedForSlot = (time, goal, ritualTitle = null) => {
    if (!time || !HOURS.includes(time) || !goal?.id) return;
    let value;
    if (goal.type === 'routine') {
      value = {
        id: crypto.randomUUID?.() ?? `s-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        parentGoalId: goal.id,
        title: goal.title,
        type: 'routine',
        duration: 60,
        spoonCost: getSpoonCost(goal),
      };
      const subtasks = goal.subtasks ?? [];
      if (subtasks.length > 0) {
        setPendingRoutineDrop({ time, goal, value });
        setSeedPickerTargetHour(null);
        return;
      }
    } else {
      value = ritualTitle ? { goalId: goal.id, ritualTitle } : goal.id;
    }
    applyAssignment(time, value);
    setSeedPickerTargetHour(null);
  };

  const [inspectedDate, setInspectedDate] = useState(null);
  const [activeSeedTab, setActiveSeedTab] = useState('all');
  const todayStr = useMemo(() => localISODate(), []);

  const handleDayClickFromWeek = useCallback((dateStr) => {
    loadDayPlan(dateStr);
    setInspectedDate(dateStr);
  }, [loadDayPlan]);

  const handleSwitchToInspectedDay = useCallback(() => {
    const dateStr = inspectedDate;
    setInspectedDate(null);
    if (dateStr && dateStr !== todayStr) {
      setEditingDate(dateStr);
      const dayData = weekAssignments[dateStr] ?? {};
      if (isControlled) onAssignmentsChange(dayData);
      else setInternalAssignments(dayData);
    } else {
      setEditingDate(null);
    }
    setViewMode('day');
  }, [inspectedDate, todayStr, weekAssignments, isControlled, onAssignmentsChange]);

  const handleBackToToday = useCallback(() => {
    if (editingDate && isControlled) {
      saveDayPlanForDate(editingDate, assignments);
    }
    setEditingDate(null);
    if (isControlled) onAssignmentsChange(weekAssignments[todayStr] ?? {});
  }, [editingDate, isControlled, assignments, onAssignmentsChange, weekAssignments, todayStr, saveDayPlanForDate]);

  return (
    <div className="bg-stone-50 rounded-xl border border-stone-200 p-6 min-w-0">
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="font-serif text-stone-900 text-lg">Schedule</h2>
          <ViewToggle value={viewMode} onChange={(mode) => {
            if (viewMode === 'day' && editingDate && editingDate !== todayStr) {
              saveDayPlanForDate(editingDate, assignments);
              setEditingDate(null);
              if (isControlled) onAssignmentsChange(weekAssignments[todayStr] ?? {});
            }
            setViewMode(mode);
          }} />
          {viewMode === 'day' && isLowEnergy && (
            <span className="flex items-center gap-1 font-sans text-xs text-amber-700" title="Low energy — reduced capacity">
              <LowBatteryIcon />
              <span>Low battery</span>
            </span>
          )}
        </div>
        {viewMode === 'day' && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAutoPlanDay}
              className="shrink-0 px-3 py-1.5 rounded-lg border border-moss-300 bg-moss-50 font-sans text-sm text-moss-800 hover:bg-moss-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40 transition-colors"
              aria-label="Auto-plan day with Smart Plan"
            >
              ✨ Auto-Plan Day
            </button>
            {onAutoFillWeek && (
              <button
                type="button"
                onClick={onAutoFillWeek}
                disabled={autoFillLoading}
                className="shrink-0 px-3 py-1.5 rounded-lg border border-moss-300 bg-moss-50 font-sans text-sm text-moss-800 hover:bg-moss-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40 disabled:opacity-60 disabled:pointer-events-none transition-colors"
                aria-label="Auto-fill week with routine blocks"
              >
                {autoFillLoading ? '…' : '✨ Auto-Fill Week'}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                const dateStr = editingDate || localISODate();
                const dayEvents = HOURS
                  .filter((h) => assignments[h])
                  .map((h) => {
                    const gid = getGoalIdFromAssignment(assignments[h]);
                    const goal = goals.find((g) => g.id === gid);
                    const hourNum = parseInt(h);
                    const startTime = new Date(dateStr + 'T' + h + ':00');
                    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
                    return { id: 'kz-' + h, title: goal?.title || 'Kaizen Task', start: startTime, end: endTime };
                  });
                if (dayEvents.length === 0) return;
                downloadICS(dayEvents, 'kaizen-' + dateStr + '.ics');
              }}
              className="shrink-0 px-3 py-1.5 rounded-lg border border-stone-200 bg-white font-sans text-xs text-stone-600 hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-stone-300/40 transition-colors"
              title="Export day to .ics (works with Apple Calendar, Outlook, Google)"
            >
              Export .ics
            </button>
          </div>
        )}
      </div>

      {viewMode === 'week' && (
        <WeekView
          weekAssignments={weekAssignments}
          goals={goals}
          onDayClick={handleDayClickFromWeek}
          onPlanWeek={onPlanWeek}
          planningWeek={planningWeek}
          weekPreview={weekPreview}
          onConfirmWeekPlan={onConfirmWeekPlan}
          onDiscardWeekPlan={onDiscardWeekPlan}
          calendarEvents={calendarEvents}
        />
      )}

      {viewMode === 'month' && (
        <MonthPlanView
          weekAssignments={weekAssignments}
          goals={goals}
          onDayClick={handleDayClickFromWeek}
          monthlyRoadmap={monthlyRoadmap}
          onPlanMonth={onPlanMonth}
          calendarEvents={calendarEvents}
        />
      )}

      {viewMode === 'day' && !hideCapacityOnMobile && (
        <SpoonBattery
          used={filledSpoonTotal}
          total={maxSlots}
          isLowEnergy={isLowEnergy}
          onLightenLoad={isOverCapacity ? handleLightenLoad : undefined}
        />
      )}

      {viewMode === 'day' && <DndContext onDragEnd={handleDragEnd}>
        {editingDate && editingDate !== todayStr && (
          <div className="mb-3 px-4 py-2.5 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-between">
            <div>
              <span className="font-sans text-sm font-medium text-sky-800">
                Editing: {new Date(editingDate + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
              </span>
              <span className="font-sans text-xs text-sky-600 ml-2">(not today)</span>
            </div>
            <button
              type="button"
              onClick={handleBackToToday}
              className="px-3 py-1 rounded-lg bg-sky-100 text-sky-700 font-sans text-xs font-medium hover:bg-sky-200 transition-colors"
            >
              ← Back to Today
            </button>
          </div>
        )}
        {filledSpoonTotal >= maxSlots && (
          <div className="mb-4 p-3 bg-amber-50/80 border border-amber-200/60 rounded-xl flex items-start gap-3" role="status">
            <span className="text-xl shrink-0" aria-hidden>🦉</span>
            <p className="font-sans text-sm text-amber-800 leading-relaxed">
              &ldquo;Your energy is depleted today. You may still plant these seeds, but please consider resting first. The garden will wait for you.&rdquo;
            </p>
          </div>
        )}
        <div className="flex flex-col gap-6 min-w-0">
          {/* Schedule — Bamboo Timeline (scrollable) */}
          <div className="flex gap-3 max-h-[70vh] md:max-h-[420px] overflow-y-auto overflow-x-hidden rounded-lg">
            <div className="shrink-0 w-px bg-stone-300 rounded-full self-stretch" />
            <div className="flex-1 relative min-h-0">
              {/* Calendar events for this day */}
              {(() => {
                const targetDate = editingDate || localISODate();
                const dayEvts = (calendarEvents ?? []).filter((e) => {
                  const d = e.start ? new Date(e.start) : null;
                  return d && localISODate(d) === targetDate;
                });
                if (dayEvts.length === 0) return null;
                return (
                  <div className="mb-2 px-2 py-2 rounded-lg bg-sky-50 border border-sky-100">
                    <p className="font-sans text-[10px] font-semibold text-sky-600 uppercase tracking-wider mb-1">Calendar</p>
                    <div className="flex flex-wrap gap-1.5">
                      {dayEvts.map((ev, idx) => {
                        const st = ev.start ? new Date(ev.start) : null;
                        const tl = st ? st.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '';
                        return (
                          <span key={ev.id || idx} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-sky-200 font-sans text-xs text-sky-800">
                            <span className="text-sky-500 font-mono text-[10px]">{tl}</span>
                            <span className="truncate max-w-[120px]">{ev.title}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
              <div className="space-y-0">
                {HOURS.map((hour) => (
                  <TimeSlot
                    key={hour}
                    hour={hour}
                    assignment={assignments[hour] ?? null}
                    goals={goals}
                    filledOrderIndex={assignments[hour] ? filledTimes.indexOf(hour) : -1}
                    filledCount={filledSpoonTotal}
                    maxSlots={maxSlots}
                    onStartFocus={onStartFocus}
                    onMilestoneCheck={onMilestoneCheck}
                    cloudSaved={recentlyExportedSlot === hour}
                    now={now}
                    isMobile={isMobile}
                    onEmptySlotClick={(h) => setSeedPickerTargetHour(h)}
                    disableConfetti={getSettings().lowStim || shouldReduceMotion(getSettings())}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Seed Bag — below schedule */}
          <div className="border border-stone-200 rounded-lg bg-white/60 p-4 flex flex-col min-h-0">
            <h3 className="font-serif text-stone-800 text-sm mb-1 shrink-0">Seed Bag</h3>
            <p className="font-sans text-xs text-stone-500 mb-3 shrink-0">
              Drag or tap a slot to add a task.
            </p>
            <div className="flex flex-col gap-4 min-h-0 max-h-[50vh] overflow-y-auto">
              {todayRitualEntries.length === 0 && goalBank.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="font-sans text-sm text-stone-500 mb-3">
                    Seed bag empty.
                  </p>
                  {onOpenGoalCreator && (
                    <button
                      type="button"
                      onClick={onOpenGoalCreator}
                      className="py-2.5 px-4 rounded-lg border-2 border-dashed border-moss-400 text-moss-700 font-sans text-sm hover:bg-moss-50 hover:border-moss-500 focus:outline-none focus:ring-2 focus:ring-moss-500/40 transition-colors"
                    >
                      Plant a Seed
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div>
                    <h4 className="font-sans text-xs font-medium text-amber-800 mb-2">🌱 Today&apos;s Rituals</h4>
                    <div className="flex flex-wrap gap-2">
                      {todayRitualEntries.length === 0 ? (
                        <p className="font-sans text-xs text-stone-400">No rituals today.</p>
                      ) : (
                        todayRitualEntries.map(({ goal, ritual }) => (
                          <SeedChip
                            key={ritual.id}
                            goal={goal}
                            item={{ ...ritual, goalId: goal.id, _type: 'routine' }}
                            isRitual={true}
                            assignments={assignments}
                            onSeedClick={onSeedClick}
                            onMilestoneCheck={onMilestoneCheck}
                            onEditGoal={onEditGoal}
                            onCompostGoal={onCompostGoal}
                            onAddRoutineTime={onAddRoutineTime}
                            onPlantRoutineBlock={handlePlantRoutineBlock}
                            onStartFocus={onStartFocus}
                          />
                        ))
                      )}
                    </div>
                  </div>
                  {/* Pill tabs + filtered Seed Bag */}
                  {(() => {
                    const kaizenSeeds = goalBank.filter((g) => g.type !== 'routine' && g.type !== 'vitality' && !g._projectGoal);
                    const routineSeeds = goalBank.filter((g) => g.type === 'routine');
                    const vitalitySeeds = goalBank.filter((g) => g.type === 'vitality');
                    const projectSeeds = goalBank.filter((g) => g._projectGoal);
                    const chipProps = (goal) => ({ key: goal.id, goal, assignments, onSeedClick, onMilestoneCheck, onEditGoal, onCompostGoal, onAddRoutineTime, onPlantRoutineBlock: handlePlantRoutineBlock, onAddSubtask, onStartFocus });
                    const hasAny = goalBank.length > 0;
                    if (!hasAny) return (
                      <div className="py-2">
                        <p className="font-sans text-xs text-stone-400 mb-2">No goals yet.</p>
                        {onOpenGoalCreator && (
                          <button type="button" onClick={onOpenGoalCreator} className="font-sans text-xs text-moss-600 hover:text-moss-700 underline underline-offset-2">
                            + Create a goal
                          </button>
                        )}
                      </div>
                    );
                    const tabs = [
                      { id: 'all', label: 'All' },
                      { id: 'kaizen', label: '🌱 Kaizen' },
                      { id: 'routine', label: '🪨 Routines' },
                      { id: 'project', label: '🌻 Projects' },
                    ];
                    const sections = [
                      { id: 'kaizen', label: '🌱 Kaizen', items: kaizenSeeds, emptyText: 'No kaizen goals yet.' },
                      { id: 'routine', label: '🪨 Routines', items: routineSeeds, emptyText: 'No routines.' },
                      { id: 'project', label: '🌻 Projects', items: projectSeeds, emptyText: null },
                      { id: 'vitality', label: '💧 Vitality', items: vitalitySeeds, emptyText: null },
                    ];
                    const sectionsToShow = activeSeedTab === 'all'
                      ? sections.filter((s) => s.items.length > 0 || s.emptyText)
                      : sections.filter((s) => s.id === activeSeedTab);
                    return (
                      <>
                        <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-stone-300 scrollbar-track-transparent" role="tablist" aria-label="Seed bag filter">
                          {tabs.map((tab) => (
                            <button
                              key={tab.id}
                              type="button"
                              role="tab"
                              aria-selected={activeSeedTab === tab.id}
                              onClick={() => setActiveSeedTab(tab.id)}
                              className={`shrink-0 px-3 py-1.5 rounded-full font-sans text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-moss-500/40 ${
                                activeSeedTab === tab.id
                                  ? 'bg-moss-600 text-stone-50'
                                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                              }`}
                            >
                              {tab.label}
                            </button>
                          ))}
                        </div>
                        <div className="flex flex-col gap-3">
                          {sectionsToShow.map((section) => (
                            <div key={section.id}>
                              {activeSeedTab === 'all' && (
                                <h4 className="font-sans text-[11px] font-semibold text-stone-500 uppercase tracking-wider mb-1.5">{section.label}</h4>
                              )}
                              {section.items.length === 0 ? (
                                section.emptyText && <p className="font-sans text-xs text-stone-400">{section.emptyText}</p>
                              ) : (
                                <div className="flex flex-wrap gap-2">
                                  {section.items.map((goal) => <SeedChip key={goal.id} {...chipProps(goal)} compact />)}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  })()}
                </>
              )}
            </div>
          </div>
        </div>
      </DndContext>}

      {/* Day Detail Modal (from week/month click) */}
      {inspectedDate && (
        <DayDetailModal
          dateStr={inspectedDate}
          dayAssignments={weekAssignments[inspectedDate] ?? {}}
          goals={goals}
          calendarEvents={calendarEvents}
          onClose={() => setInspectedDate(null)}
          onSwitchToDay={handleSwitchToInspectedDay}
        />
      )}

      {/* Auto-Plan toast */}
      <AnimatePresence>
        {autoPlanToast && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.25 }}
            className="fixed bottom-6 left-4 right-4 z-50 mx-auto max-w-sm rounded-xl border border-moss-200 bg-moss-50/95 px-4 py-3 shadow-lg font-sans text-sm text-moss-900"
            role="status"
          >
            Mochi has organized your day.
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spoons exceeded toast */}
      <AnimatePresence>
        {spoonsToast && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.25 }}
            className="fixed bottom-6 left-4 right-4 z-50 mx-auto max-w-sm rounded-xl border border-amber-200 bg-amber-50/95 px-4 py-3 shadow-lg font-sans text-sm text-amber-900"
            role="alert"
          >
            <p className="font-medium">You are out of spoons. Rest, or borrow from tomorrow?</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Seed Picker Modal (mobile): choose a seed for the tapped empty slot */}
      <AnimatePresence>
        {seedPickerTargetHour && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-sm"
            onClick={() => setSeedPickerTargetHour(null)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="seed-picker-title"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-white/40 bg-white/95 shadow-2xl shadow-stone-900/10 overflow-hidden"
            >
              <div className="p-4 border-b border-stone-200/80">
                <h2 id="seed-picker-title" className="font-serif text-stone-900 text-lg">
                  Plant a seed at {seedPickerTargetHour}
                </h2>
                <p className="font-sans text-sm text-stone-500 mt-0.5">Choose what to schedule.</p>
              </div>
              <div className="p-4 max-h-[60vh] overflow-y-auto space-y-4">
                {todayRitualEntries.length > 0 && (
                  <div>
                    <h3 className="font-sans text-xs font-medium text-amber-800 mb-2">🌱 Today&apos;s Rituals</h3>
                    <div className="flex flex-col gap-2">
                      {todayRitualEntries.map(({ goal, ritual }) => (
                        <button
                          key={`ritual-${goal.id}-${ritual.id}`}
                          type="button"
                          onClick={() => handleSelectSeedForSlot(seedPickerTargetHour, goal, ritual.title ?? undefined)}
                          className="w-full py-3 px-4 rounded-xl border-2 border-amber-200 bg-amber-50/80 font-sans text-sm text-stone-800 hover:bg-amber-100 hover:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-left transition-colors"
                        >
                          <span className="text-[10px] font-bold uppercase tracking-wider text-moss-600 block mb-0.5">{goal.title}</span>
                          <span className="font-medium">{ritual.title || goal.title}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {(() => {
                  const kz = goalBank.filter((g) => g.type !== 'routine' && g.type !== 'vitality' && !g._projectGoal);
                  const rt = goalBank.filter((g) => g.type === 'routine');
                  const pr = goalBank.filter((g) => g._projectGoal);
                  const vt = goalBank.filter((g) => g.type === 'vitality');
                  const sections = [
                    { id: 'k', label: '🌱 Kaizen', items: kz, border: 'border-moss-200', bg: 'bg-moss-50/60', badge: 'text-moss-600' },
                    { id: 'r', label: '🪨 Routines', items: rt, border: 'border-slate-200', bg: 'bg-slate-50/60', badge: 'text-slate-600' },
                    { id: 'p', label: '🌻 Projects', items: pr, border: 'border-amber-200', bg: 'bg-amber-50/60', badge: 'text-amber-600' },
                    { id: 'v', label: '💧 Vitality', items: vt, border: 'border-sky-200', bg: 'bg-sky-50/60', badge: 'text-sky-600' },
                  ].filter((s) => s.items.length > 0);
                  if (sections.length === 0) return (
                    <div><p className="font-sans text-xs text-stone-400 py-2">No goals yet.</p></div>
                  );
                  return sections.map((s) => (
                    <div key={s.id}>
                      <h3 className={`font-sans text-xs font-medium ${s.badge} mb-2`}>{s.label}</h3>
                      <div className="flex flex-col gap-2">
                        {s.items.map((goal) => (
                          <button
                            key={goal.id}
                            type="button"
                            onClick={() => handleSelectSeedForSlot(seedPickerTargetHour, goal)}
                            className={`w-full py-3 px-4 rounded-xl border ${s.border} ${s.bg} font-sans text-sm text-stone-800 hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-moss-500/40 text-left transition-colors`}
                          >
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${s.badge} block mb-0.5`}>
                              {goal._projectGoal ? goal._projectName || 'Project' : goal.domain || goal.type || 'Kaizen'}
                            </span>
                            <span className="font-medium">{goal.title}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ));
                })()}
              </div>
              <div className="p-4 border-t border-stone-200/80">
                <button
                  type="button"
                  onClick={() => setSeedPickerTargetHour(null)}
                  className="w-full py-2.5 rounded-xl font-sans text-sm text-stone-500 hover:text-stone-700 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Project picker: when dropping routine with subtasks */}
      {pendingRoutineDrop && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-stone-900/50 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Choose project"
        >
          <div className="bg-stone-50 rounded-2xl border border-stone-200 shadow-xl max-w-sm w-full p-6">
            <h3 className="font-serif text-stone-900 text-lg mb-2">Which project are we working on?</h3>
            <p className="font-sans text-sm text-stone-500 mb-4">{pendingRoutineDrop.goal.title}</p>
            <div className="flex flex-col gap-2">
              {(pendingRoutineDrop.goal.subtasks ?? []).map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => handleProjectSelect(st)}
                  className="py-2.5 px-4 rounded-xl border border-stone-200 bg-white font-sans text-sm text-stone-800 hover:bg-moss-50 hover:border-moss-300 focus:outline-none focus:ring-2 focus:ring-moss-500/40 text-left"
                >
                  {st.title}
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleProjectSelect(null)}
                className="py-2.5 px-4 rounded-xl border border-stone-200 bg-stone-100 font-sans text-sm text-stone-600 hover:bg-stone-200 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
              >
                No project
              </button>
            </div>
            <button
              type="button"
              onClick={() => setPendingRoutineDrop(null)}
              className="mt-4 w-full py-2 font-sans text-sm text-stone-500 hover:text-stone-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Wrapper to make a goal card draggable; use when goal is rendered outside TimeSlicer (e.g. in dashboard). */
export function DraggableGoalCard({ goal, children }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: goal.id, data: { goal } });
  if (!goal?.id) return children;
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={isDragging ? 'opacity-50' : ''}>
      {children}
    </div>
  );
}

export default TimeSlicer;

/**
 * Magic Planning: generate today's plan from routine goals and energy, then update assignments.
 * Optional calendarEvents + options make the plan storm-aware (capacity reduction + buffer).
 */
export function triggerAutoPlan(goals, energyModifier, onAssignmentsChange, calendarEvents = null, options = {}) {
  if (typeof onAssignmentsChange !== 'function') return;
  const plan = generateDailyPlan(goals, energyModifier, calendarEvents ?? undefined, options);
  onAssignmentsChange(plan);
}

export { HOURS, MAX_SLOTS_BY_WEATHER };
