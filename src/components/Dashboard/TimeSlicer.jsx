import { useState, useMemo, useRef, useEffect } from 'react';
import { DndContext, useDraggable, useDroppable } from '@dnd-kit/core';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { createGoogleEvent } from '../../services/googleCalendarService';
import { suggestLoadLightening, generateDailyPlan } from '../../services/schedulerService';
import { useGarden } from '../../context/GardenContext';
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
}) {
  const { setNodeRef, isOver } = useDroppable({ id: hour });
  const goalId = getGoalIdFromAssignment(assignment);
  const slotRitualTitle = getRitualTitleFromAssignment(assignment);
  const subtask = getSubtaskFromAssignment(assignment);
  const routineSession = isRoutineSession(assignment);
  const goal = goalId ? goals?.find((g) => g.id === goalId) : null;
  const isEmpty = !goal && !routineSession;
  const thisSlotOverLimit = goal && filledCount > maxSlots && filledOrderIndex >= maxSlots;
  const isSlotBlocked = isEmpty && filledCount >= maxSlots;
  const firstUncompleted = goal?.milestones?.find((m) => !m.completed);
  const milestoneTitle = firstUncompleted?.title ?? firstUncompleted?.text;

  const slotHourNum = parseInt(hour.slice(0, 2), 10);
  const isCurrentHour = now && slotHourNum === now.getHours() && slotHourNum >= HOUR_START && slotHourNum <= HOUR_END;
  const currentMinutePercent = isCurrentHour ? (now.getMinutes() / 60) * 100 : 0;
  const timeLabel = isCurrentHour ? `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}` : '';

  const slotBg = isSlotBlocked
    ? 'bg-stone-200 border-2 border-dashed border-stone-400'
    : isEmpty
      ? 'bg-stone-100 border-2 border-dashed border-stone-300'
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
      if (typeof window === 'undefined') return;
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
        role={isMobile && isEmpty && onEmptySlotClick ? 'button' : undefined}
        tabIndex={isMobile && isEmpty && onEmptySlotClick ? 0 : undefined}
        onClick={isMobile && isEmpty && onEmptySlotClick ? () => onEmptySlotClick(hour) : undefined}
        onKeyDown={isMobile && isEmpty && onEmptySlotClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onEmptySlotClick(hour); } } : undefined}
        className={`flex-1 min-h-[52px] rounded-lg flex flex-col justify-center px-3 py-2 transition-colors relative overflow-hidden ${slotBg} ${
          isOver && isEmpty && !isSlotBlocked ? 'ring-2 ring-moss-500/50 ring-offset-1' : ''
        } ${isFullyHarvested && !routineSession ? 'border-moss-600/60' : ''} ${isMobile && isEmpty && onEmptySlotClick && !isSlotBlocked ? 'cursor-pointer hover:bg-stone-200/80 active:bg-stone-300/80' : ''} ${isSlotBlocked ? 'cursor-not-allowed' : ''}`}
      >
        {/* Blocked overlay: striped + stone texture when over capacity or empty at capacity */}
        {(isSlotBlocked || thisSlotOverLimit) && (
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
          <span className={`font-sans text-sm relative z-10 ${isSlotBlocked ? 'text-stone-500' : 'text-stone-400'}`}>
            {isSlotBlocked ? 'No spoons left' : isMobile && onEmptySlotClick ? 'Tap to plant a seed' : 'Plant Seed'}
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

function SeedChip({ goal, assignments = {}, onSeedClick, onMilestoneCheck, onEditGoal, onCompostGoal, onAddRoutineTime, onPlantRoutineBlock, onAddSubtask }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuAnchorRef = useRef(null);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: goal.id, data: { goal } });
  const isRoutine = goal?.type === 'routine';
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
  return (
    <div
      ref={setNodeRef}
      className={`shrink-0 flex flex-col gap-1 px-3 py-2 rounded-lg border border-stone-200 bg-white shadow-sm font-sans text-sm text-stone-800 hover:border-moss-500/50 transition-colors relative ${
        isDragging ? 'opacity-50 shadow-md cursor-grabbing' : 'cursor-grab'
      }`}
    >
      <div className="flex items-center gap-1 min-w-0">
        <span {...listeners} {...attributes} className="flex-1 min-w-0 truncate">{goal.title}</span>
        {onSeedClick && !isRoutine && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onSeedClick(goal); }}
            className="shrink-0 p-0.5 rounded text-stone-400 hover:text-moss-600 hover:bg-moss-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
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
              className="p-0.5 rounded text-stone-400 hover:text-stone-600 hover:bg-stone-100 focus:outline-none"
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
function RitualSeedChip({ goal, ritualTitle, assignments = {}, onSeedClick, onMilestoneCheck, onEditGoal, onCompostGoal, onAddRoutineTime, onPlantRoutineBlock }) {
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
        <span {...listeners} {...attributes} className="flex-1 min-w-0 truncate">{ritualTitle || goal.title}</span>
        {onSeedClick && !isRoutine && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onSeedClick(goal); }}
            className="shrink-0 p-0.5 rounded text-stone-400 hover:text-moss-600 hover:bg-moss-100 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
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
              className="p-0.5 rounded text-stone-400 hover:text-stone-600 hover:bg-stone-100 focus:outline-none"
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
}) {
  const { googleToken: googleTokenContext } = useGarden();
  const googleToken = googleTokenProp ?? googleTokenContext ?? null;

  const [internalAssignments, setInternalAssignments] = useState({});
  const [recentlyExportedSlot, setRecentlyExportedSlot] = useState(null);
  const [pendingRoutineDrop, setPendingRoutineDrop] = useState(null); // { time, goal, value }
  const [seedPickerTargetHour, setSeedPickerTargetHour] = useState(null);
  const [spoonsToast, setSpoonsToast] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT);
  const isControlled = onAssignmentsChange != null;
  const assignments = isControlled ? controlledAssignments ?? {} : internalAssignments;

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

  const baseCapacity = MAX_SLOTS_BY_WEATHER[weather] ?? 6;
  const maxSlots =
    typeof dailySpoonCount === 'number' && dailySpoonCount >= 1 && dailySpoonCount <= 12
      ? dailySpoonCount
      : Math.max(1, baseCapacity + dailyEnergyModifier);
  const isLowEnergy =
    (typeof dailySpoonCount === 'number' && dailySpoonCount <= 4) || dailyEnergyModifier === -2;
  const filledTimes = HOURS.filter((h) => {
    const gid = getGoalIdFromAssignment(assignments[h]);
    return gid && goals.some((g) => g.id === gid);
  });
  const filledCount = filledTimes.length;
  const isOverCapacity = filledCount > maxSlots;

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
    const targetWasEmpty = !assignments[time];
    if (targetWasEmpty && filledCount >= maxSlots) {
      setSpoonsToast(true);
      return;
    }
    const data = active.data?.current;
    const ritualTitle = data?.ritualTitle;
    const goalId = data?.goal?.id ?? active.id;
    const goal = goals.find((g) => g.id === goalId);

    let value;
    if (goal?.type === 'routine') {
      value = {
        id: crypto.randomUUID?.() ?? `s-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        parentGoalId: goal.id,
        title: goal.title,
        type: 'routine',
        duration: 60,
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
    const slotWasEmpty = !assignments[time];
    if (slotWasEmpty && filledCount >= maxSlots) {
      setSpoonsToast(true);
      setSeedPickerTargetHour(null);
      return;
    }
    let value;
    if (goal.type === 'routine') {
      value = {
        id: crypto.randomUUID?.() ?? `s-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        parentGoalId: goal.id,
        title: goal.title,
        type: 'routine',
        duration: 60,
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

  return (
    <div className="bg-stone-50 rounded-xl border border-stone-200 p-6">
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <div className="flex items-center gap-2">
          <h2 className="font-serif text-stone-900 text-lg">Daily Schedule</h2>
          {isLowEnergy && (
            <span className="flex items-center gap-1 font-sans text-xs text-amber-700" title="Low energy — reduced capacity">
              <LowBatteryIcon />
              <span>Low battery</span>
            </span>
          )}
        </div>
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
      </div>
      {!hideCapacityOnMobile && (
        <SpoonBattery
          used={filledCount}
          total={maxSlots}
          isLowEnergy={isLowEnergy}
          onLightenLoad={isOverCapacity ? handleLightenLoad : undefined}
        />
      )}

      <DndContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] gap-6">
          {/* Left — Bamboo Timeline (scrollable) */}
          <div className="flex gap-3 max-h-[70vh] md:max-h-[420px] overflow-y-auto overflow-x-hidden rounded-lg">
            <div className="shrink-0 w-px bg-stone-300 rounded-full self-stretch" />
            <div className="flex-1 relative min-h-0">
              <div className="space-y-0">
                {HOURS.map((hour) => (
                  <TimeSlot
                    key={hour}
                    hour={hour}
                    assignment={assignments[hour] ?? null}
                    goals={goals}
                    filledOrderIndex={assignments[hour] ? filledTimes.indexOf(hour) : -1}
                    filledCount={filledCount}
                    maxSlots={maxSlots}
                    onStartFocus={onStartFocus}
                    onMilestoneCheck={onMilestoneCheck}
                    cloudSaved={recentlyExportedSlot === hour}
                    now={now}
                    isMobile={isMobile}
                    onEmptySlotClick={isMobile ? (h) => { if (filledCount >= maxSlots) { setSpoonsToast(true); return; } setSeedPickerTargetHour(h); } : undefined}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right — Seed Bag */}
          <div className="border border-stone-200 rounded-lg bg-white/60 p-4">
            <h3 className="font-serif text-stone-800 text-sm mb-3">Seed Bag</h3>
            <div className="flex flex-col gap-4">
              {todayRitualItems.length === 0 && goalBank.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="font-sans text-sm text-stone-500 mb-3">
                    Your seed bag is empty. Plant a seed to start planning.
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
                      {todayRitualItems.length === 0 ? (
                        <p className="font-sans text-xs text-stone-400">No rituals scheduled for today.</p>
                      ) : (
                        todayRitualItems.map(({ goal, ritualTitle }) => (
                          <RitualSeedChip
                            key={`ritual-${goal.id}`}
                            goal={goal}
                            ritualTitle={ritualTitle}
                            assignments={assignments}
                            onSeedClick={onSeedClick}
                            onMilestoneCheck={onMilestoneCheck}
                            onEditGoal={onEditGoal}
                            onCompostGoal={onCompostGoal}
                            onAddRoutineTime={onAddRoutineTime}
                            onPlantRoutineBlock={handlePlantRoutineBlock}
                          />
                        ))
                      )}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-sans text-xs font-medium text-stone-600 mb-2">🌰 Goal Bank</h4>
                    <div className="flex flex-wrap gap-2">
                      {goalBank.length === 0 ? (
                        <p className="font-sans text-xs text-stone-400">No other goals.</p>
                      ) : (
                        goalBank.map((goal) => <SeedChip key={goal.id} goal={goal} assignments={assignments} onSeedClick={onSeedClick} onMilestoneCheck={onMilestoneCheck} onEditGoal={onEditGoal} onCompostGoal={onCompostGoal} onAddRoutineTime={onAddRoutineTime} onPlantRoutineBlock={handlePlantRoutineBlock} onAddSubtask={onAddSubtask} />)
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </DndContext>

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
                {todayRitualItems.length > 0 && (
                  <div>
                    <h3 className="font-sans text-xs font-medium text-amber-800 mb-2">🌱 Today&apos;s Rituals</h3>
                    <div className="flex flex-col gap-2">
                      {todayRitualItems.map(({ goal, ritualTitle }) => (
                        <button
                          key={`ritual-${goal.id}-${ritualTitle}`}
                          type="button"
                          onClick={() => handleSelectSeedForSlot(seedPickerTargetHour, goal, ritualTitle ?? undefined)}
                          className="w-full py-3 px-4 rounded-xl border-2 border-amber-200 bg-amber-50/80 font-sans text-sm text-stone-800 hover:bg-amber-100 hover:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-left transition-colors"
                        >
                          {ritualTitle || goal.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <h3 className="font-sans text-xs font-medium text-stone-600 mb-2">🌰 Goal Bank</h3>
                  {goalBank.length === 0 ? (
                    <p className="font-sans text-xs text-stone-400 py-2">No other goals.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {goalBank.map((goal) => (
                        <button
                          key={goal.id}
                          type="button"
                          onClick={() => handleSelectSeedForSlot(seedPickerTargetHour, goal)}
                          className="w-full py-3 px-4 rounded-xl border border-stone-200 bg-white font-sans text-sm text-stone-800 hover:bg-stone-50 hover:border-stone-300 focus:outline-none focus:ring-2 focus:ring-moss-500/40 text-left transition-colors"
                        >
                          {goal.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
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
 * Call from parent when e.g. morning check-in completes with an empty schedule.
 */
export function triggerAutoPlan(goals, energyModifier, onAssignmentsChange) {
  if (typeof onAssignmentsChange !== 'function') return;
  const plan = generateDailyPlan(goals, energyModifier);
  onAssignmentsChange(plan);
}

export { HOURS, MAX_SLOTS_BY_WEATHER };
