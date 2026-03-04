import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { DndContext, useDraggable, useDroppable } from '@dnd-kit/core';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { createGoogleEvent } from '../../services/googleCalendarService';
import { downloadICS } from '../../services/calendarSyncService';
import { suggestLoadLightening, generateDailyPlan, timeToMinutes, getSpoonCost, getGentlePriorities } from '../../services/schedulerService';
import { toCanonicalSlotKey } from '../../services/schedulingConflictService';
import { recommendDailyPriority } from '../../services/geminiService';
import { useGarden } from '../../context/GardenContext';
import { useReward } from '../../context/RewardContext';
import { buildReward } from '../../services/dopamineEngine';
import { localISODate } from '../../services/dateUtils';
import { getSettings } from '../../services/userSettings';
import { shouldReduceMotion } from '../../services/motion';
import { DefaultSpiritSvg } from './MochiSpirit';
import { AiButtonThinking, AiThinkingOverlay } from './AiThinkingIndicator';
import WoodenSpoon from '../WoodenSpoon';
import PrioritizeModal from './PrioritizeModal';

const HOUR_START = 6;
const HOUR_END = 23;
const HOURS = Array.from(
  { length: HOUR_END - HOUR_START + 1 },
  (_, i) => `${String(HOUR_START + i).padStart(2, '0')}:00`
);

/** Parse "HH:mm" or "H:mm" to hour (0–23). Returns null if invalid. */
function parseTimeToHour(str) {
  if (!str || typeof str !== 'string') return null;
  const parts = str.trim().split(':');
  const h = parseInt(parts[0], 10);
  if (Number.isNaN(h)) return null;
  return Math.max(0, Math.min(23, Math.floor(h)));
}

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
function isPriorityAssignment(a) {
  return a && typeof a === 'object' && a.priority === true;
}

/** True if this assignment is a fixed-time event (e.g. meeting); should stay in chronological order. */
function isAssignmentFixed(a) {
  if (!a || typeof a !== 'object') return false;
  return a.isFixed === true || a.type === 'fixed' || a.fixed === true;
}

/** Return array of assignments for a slot (supports legacy single value). Hour keys: "14:00" or "14". Exported for consumers (NextTinyStep, SpiritChat, etc.). */
export function getAssignmentsForHour(assignments, hour) {
  if (!assignments || !hour) return [];
  let a = assignments[hour];
  if (a == null) {
    const hourNum = parseInt(String(hour).replace(/:.*$/, ''), 10);
    if (!Number.isNaN(hourNum)) a = assignments[String(hourNum)];
  }
  if (a == null) return [];
  return Array.isArray(a) ? a : [a];
}

/** True if the hour has no assignments. */
function isSlotEmpty(assignments, hour) {
  return getAssignmentsForHour(assignments, hour).length === 0;
}

/** First assignment for a slot (backward compatibility). */
function getAssignmentForHour(assignments, hour) {
  const list = getAssignmentsForHour(assignments, hour);
  return list[0] ?? null;
}

/** Parse duration in minutes from a title string (e.g. "5 mins", "10-minute stretch"). */
function parseDurationFromTitle(title) {
  if (!title || typeof title !== 'string') return null;
  const m = title.match(/(\d+)\s*(?:min|minute|mins?)\b/i) || title.match(/(\d+)-minute/i);
  return m ? parseInt(m[1], 10) : null;
}

/** Get duration in minutes for an assignment (for capacity and proportional height). */
function getDurationMinutesFromAssignment(assignment, goals) {
  if (!assignment) return 15;
  if (typeof assignment === 'object' && typeof assignment.duration === 'number') return Math.max(1, assignment.duration);
  const goalId = getGoalIdFromAssignment(assignment);
  const goal = goals?.find((g) => g.id === goalId);
  return Math.max(1, Number(goal?.estimatedMinutes) || 15);
}

/** Get duration in minutes for a value about to be dropped (for capacity check). */
function getDurationMinutesFromValue(value, goal) {
  if (!value) return 15;
  if (typeof value === 'object' && typeof value.duration === 'number') return Math.max(1, value.duration);
  return Math.max(1, Number(goal?.estimatedMinutes) || 15);
}

/** Backlog category display labels with emoji for section headers. */
const BACKLOG_CATEGORY_LABELS = {
  'Care & Hygiene': '🧼 Care & Hygiene',
  'Life Admin': '📁 Life Admin',
  'Deep Work': '💼 Deep Work',
  'Other': '📋 Other',
};

/** Emoji for the user's spirit from Spirit Builder (creation). Matches GardenDashboard / MochiSpirit. */
function getSpiritEmoji(spiritConfig) {
  if (!spiritConfig) return '🦉';
  if (spiritConfig.type === 'custom' && spiritConfig.head) {
    const HEADS = { bunny: '🐰', cat: '🐱', bear: '🐻', fox: '🦊', bot: '🤖', owl: '🦉' };
    return HEADS[spiritConfig.head] ?? '✨';
  }
  if (spiritConfig.type === 'cat') return '🐱';
  if (spiritConfig.type === 'ember') return '🔥';
  if (spiritConfig.type === 'nimbus') return '☁️';
  if (spiritConfig.type === 'mochi') return '🐱';
  return '🦉';
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
  assignmentsList = [],
  goals,
  filledOrderIndex,
  filledCount,
  maxSlots,
  onStartFocus,
  onMilestoneCheck,
  onHarvestedClick,
  cloudSaved = false,
  now = null,
  isMobile = false,
  onEmptySlotClick,
  onRemoveSlotItem,
  disableConfetti = false,
  hourStart = HOUR_START,
  hourEnd = HOUR_END,
}) {
  const { setNodeRef, isOver } = useDroppable({ id: hour });
  const list = Array.isArray(assignmentsList) ? assignmentsList : (assignmentsList != null ? [assignmentsList] : []);
  const isEmpty = list.length === 0;
  const firstAssignment = list[0] ?? null;
  const goalIdFirst = getGoalIdFromAssignment(firstAssignment);
  const goalFirst = goalIdFirst ? goals?.find((g) => g.id === goalIdFirst) : null;
  const thisSlotOverLimit = goalFirst && filledCount > maxSlots;
  const routineFirst = firstAssignment && isRoutineSession(firstAssignment);
  const estFirst = goalFirst?.estimatedMinutes ?? 0;
  const totalFirst = goalFirst?.totalMinutes ?? 0;
  const isFullyHarvestedFirst = estFirst > 0 && totalFirst >= estFirst;
  const isSlotCompletedFirst = (goalFirst && isGoalCompleted(goalFirst)) || (routineFirst && isFullyHarvestedFirst);
  const isFixedAndPriorityFirst = firstAssignment && isPriorityAssignment(firstAssignment) && isAssignmentFixed(firstAssignment);

  const slotHourNum = parseInt(hour.slice(0, 2), 10);
  const isCurrentHour = now && slotHourNum === now.getHours() && slotHourNum >= hourStart && slotHourNum <= hourEnd;
  const currentMinutePercent = isCurrentHour ? (now.getMinutes() / 60) * 100 : 0;
  const timeLabel = isCurrentHour ? `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}` : '';

  const slotBg = isEmpty
    ? 'bg-stone-100 border-2 border-dashed border-stone-300'
    : 'bg-stone-50 border border-stone-200';
  const slotBgWhenFilled = 'bg-stone-50 border border-stone-200';

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
        className={`flex-1 min-h-[52px] rounded-xl flex flex-col ${isEmpty ? 'justify-center' : 'justify-start'} px-3 py-2 transition-all relative overflow-hidden ${isEmpty ? slotBg : slotBgWhenFilled} ${!isEmpty ? 'hover:shadow-md' : ''} ${
          isOver && isEmpty ? 'ring-2 ring-moss-500/50 ring-offset-1' : ''
        } ${!isEmpty && isFullyHarvestedFirst && !routineFirst ? 'border-moss-600/60' : ''} ${isEmpty && onEmptySlotClick ? 'cursor-pointer hover:bg-stone-200/80 active:bg-stone-300/80' : ''} ${
          isFixedAndPriorityFirst ? 'ring-2 ring-amber-400/70 bg-amber-50/90 border-amber-300/80' : ''
        } ${isSlotCompletedFirst ? 'opacity-75 bg-stone-200/80 border-stone-300 text-stone-500' : ''}`}
      >
        {/* Blocked overlay: striped + stone texture when over capacity or empty at capacity */}
        {thisSlotOverLimit && (
            <div
            className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden"
            style={{
              backgroundColor: 'rgba(120, 113, 108, 0.75)',
              backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 6px, rgba(87, 83, 78, 0.4) 6px, rgba(87, 83, 78, 0.4) 12px)',
            }}
            aria-hidden
          />
        )}
        {/* North Star priority / Critical Mass from first assignment */}
        {firstAssignment && (() => {
          const gid = getGoalIdFromAssignment(firstAssignment);
          const g = gid ? goals?.find((gr) => gr.id === gid) : null;
          const isP = isPriorityAssignment(firstAssignment);
          const isCM = g?.criticalMass === true;
          return (
            <>
              {isP && !isCM && (
                <span className="absolute top-2 left-2 text-amber-400 drop-shadow-sm" title="North Star priority" aria-hidden>⭐</span>
              )}
              {isCM && (
                <span className="absolute top-2 left-2 w-2.5 h-2.5 rounded-full bg-orange-500 shrink-0" title="Critical Mass" aria-hidden />
              )}
            </>
          );
        })()}
        {!isEmpty ? (
          (() => {
            const slotDurations = list.map((a) => getDurationMinutesFromAssignment(a, goals));
            const totalDuration = slotDurations.reduce((s, d) => s + d, 0);
            const SLOT_BASE_HEIGHT_PX = 80;
            const slotHeightPx = Math.max(SLOT_BASE_HEIGHT_PX, Math.round((totalDuration / 60) * SLOT_BASE_HEIGHT_PX));
            return (
          <div className="flex flex-col gap-1 p-1 overflow-auto" style={{ minHeight: SLOT_BASE_HEIGHT_PX, height: slotHeightPx }}>
            <AnimatePresence initial={false} mode="popLayout">
            {list.map((assignment, index) => {
              const goalId = getGoalIdFromAssignment(assignment);
              const slotRitualTitle = getRitualTitleFromAssignment(assignment);
              const subtask = getSubtaskFromAssignment(assignment);
              const routineSession = isRoutineSession(assignment);
              const isRoutineTemplate = assignment && typeof assignment === 'object' && assignment.type === 'routineTemplate';
              const isRecovery = assignment && typeof assignment === 'object' && assignment.type === 'recovery';
              const isPriority = isPriorityAssignment(assignment);
              const isFixed = isAssignmentFixed(assignment);
              const isFixedAndPriority = isPriority && isFixed;
              const goal = goalId ? goals?.find((g) => g.id === goalId) : null;
              const isCriticalMass = goal?.criticalMass === true;
              const estimatedMins = goal?.estimatedMinutes ?? 0;
              const totalMins = goal?.totalMinutes ?? 0;
              const durationLabel = estimatedMins > 0 ? `${estimatedMins}m` : null;
              const progressPercent = estimatedMins > 0 ? Math.min(100, (totalMins / estimatedMins) * 100) : 0;
              const isFullyHarvested = estimatedMins > 0 && totalMins >= estimatedMins;
              const progressBarColor = progressPercent >= 100 ? 'bg-moss-500' : progressPercent > 0 ? 'bg-amber-500' : 'bg-stone-400';
              const isSlotCompleted = (goal && isGoalCompleted(goal)) || (routineSession && isFullyHarvested);
              const routineDuration = routineSession ? (assignment.duration ?? 60) : 0;
              const durationMinutes = routineSession ? routineDuration : ((goal?.estimatedMinutes ?? estimatedMins) || 60);
              const heightPx = totalDuration > 0 ? Math.max(12, Math.round((durationMinutes / totalDuration) * slotHeightPx)) : slotHeightPx;
              const isMicroTask = durationMinutes < 20;
              const slotBgForChip = isRecovery ? 'bg-stone-100 border-stone-300 text-stone-600' : routineSession || isRoutineTemplate ? 'bg-slate-200 border-slate-300 text-stone-800' : isCriticalMass ? 'bg-orange-200 border-orange-300' : 'bg-moss-200 border-moss-500/50 text-stone-800';
              const firstUncompleted = goal?.milestones?.find((m) => !m.completed);
              const milestoneTitle = firstUncompleted?.title ?? firstUncompleted?.text;
              const taskKey = assignment.id ?? `${hour}-${index}-${assignment.title ?? goal?.title ?? 'task'}`;
              return (
                <motion.div
                  key={taskKey}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  className="flex items-start gap-2 min-w-0 flex-shrink-0"
                  style={{ height: heightPx, minHeight: 12 }}
                >
                  <div className={`flex-1 min-w-0 h-full rounded-xl overflow-hidden px-2 border transition-shadow hover:shadow-md ${slotBgForChip} ${isSlotCompleted ? 'opacity-90 border-stone-300' : ''} ${isMicroTask ? 'flex flex-row items-center py-1' : 'flex flex-col justify-center py-1.5'}`}>
                    {routineSession ? (
                      isMicroTask ? (
                        <div className="flex items-center gap-1.5 min-w-0 w-full">
                          <RepeatIcon />
                          <span className={`font-sans text-xs font-medium truncate ${isFullyHarvested ? 'line-through text-stone-400 opacity-60' : ''}`}>{assignment.title ?? goal?.title ?? 'Routine'}</span>
                          {onStartFocus && goal && (
                            <button type="button" onClick={() => onStartFocus(goal.id, hour, undefined, assignment?.subtaskId)} className="shrink-0 ml-auto flex items-center gap-0.5 px-1.5 py-0.5 rounded font-sans text-[10px] bg-stone-800 text-stone-50 hover:bg-stone-700 focus:outline-none focus:ring-2 focus:ring-moss-500/50"><span aria-hidden>▶</span></button>
                          )}
                        </div>
                      ) : (
                      <>
                        <div className={`flex items-center justify-between gap-2 ${isFullyHarvested ? 'line-through text-stone-400 opacity-60' : ''} ${isPriority ? 'pl-5' : ''}`}>
                          <div className="flex items-center gap-2 min-w-0">
                            <RepeatIcon />
                            <span className="font-sans text-sm font-medium truncate">{assignment.title ?? goal?.title ?? 'Routine'}</span>
                          </div>
                          {onStartFocus && goal && (
                            <button type="button" onClick={() => onStartFocus(goal.id, hour, undefined, assignment?.subtaskId)} className="shrink-0 flex items-center gap-1 px-2 py-1 rounded font-sans text-xs bg-stone-800 text-stone-50 hover:bg-stone-700 focus:outline-none focus:ring-2 focus:ring-moss-500/50">
                              <span aria-hidden>▶</span><span>Play</span>
                            </button>
                          )}
                        </div>
                        {routineDuration > 0 && <span className="font-sans text-xs text-stone-500 mt-0.5">{routineDuration}m</span>}
                        {subtask?.title && <span className="font-sans text-xs text-moss-700 mt-0.5 truncate block" title={subtask.title}>🌱 {subtask.title}</span>}
                      </>
                      )
                    ) : isRoutineTemplate ? (
                      isMicroTask ? (
                        <div className="flex items-center gap-1.5 min-w-0 w-full">
                          <RepeatIcon />
                          <span className="font-sans text-xs font-medium truncate">{assignment.title ?? 'Routine'}</span>
                        </div>
                      ) : (
                      <>
                        <div className="flex items-center gap-2 min-w-0">
                          <RepeatIcon />
                          <span className="font-sans text-sm font-medium truncate">{assignment.title ?? 'Routine'}</span>
                        </div>
                        {(assignment.duration > 0) && <span className="font-sans text-xs text-stone-500 mt-0.5">{assignment.duration}m</span>}
                      </>
                      )
                    ) : isRecovery ? (
                      <span className={`font-sans font-medium text-stone-600 ${isMicroTask ? 'text-xs' : 'text-sm'}`}>{assignment.title ?? 'Rest'}</span>
                    ) : goal ? (
                      isMicroTask ? (
                        <div className="flex items-center gap-1.5 min-w-0 w-full">
                          {durationLabel && !isFullyHarvested && <span className="font-sans text-[10px] text-stone-500 shrink-0" aria-hidden>{durationLabel}</span>}
                          <span className={`font-sans text-xs font-medium truncate min-w-0 ${isFullyHarvested ? 'line-through text-stone-400 opacity-60' : ''}`}>{goal.title}</span>
                          {cloudSaved && index === 0 && (
                            <motion.span initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }} className="shrink-0" title="Saved to Google Calendar"><CloudUploadIcon /></motion.span>
                          )}
                          {onStartFocus && !isFullyHarvested && (
                            <button type="button" onClick={() => onStartFocus(goal.id, hour, slotRitualTitle ?? undefined, assignment?.subtaskId)} className="shrink-0 ml-auto flex items-center gap-0.5 px-1.5 py-0.5 rounded font-sans text-[10px] bg-stone-800 text-stone-50 hover:bg-stone-700 focus:outline-none focus:ring-2 focus:ring-moss-500/50"><span aria-hidden>▶</span></button>
                          )}
                          {onStartFocus && isFullyHarvested && (
                            <button type="button" onClick={(e) => { triggerHarvestConfetti(e); onHarvestedClick?.(); onStartFocus(goal.id, hour, slotRitualTitle ?? undefined, assignment?.subtaskId); }} className="shrink-0 ml-auto flex items-center gap-0.5 px-1.5 py-0.5 rounded font-sans text-[10px] bg-moss-600/90 text-stone-50 font-medium hover:bg-moss-600 focus:outline-none focus:ring-2 focus:ring-moss-500/50" title="Harvested"><span aria-hidden>✔</span></button>
                          )}
                        </div>
                      ) : (
                      <>
                        {durationLabel && !isFullyHarvested && <span className="absolute top-2 right-2 font-sans text-xs text-stone-500" aria-hidden>{durationLabel}</span>}
                        <div className={`flex flex-col gap-0.5 ${isCriticalMass ? 'pl-5' : ''} ${isPriority && !isCriticalMass ? 'pl-5' : ''}`}>
                          <div className={`flex items-center justify-between gap-2 pr-24 ${isFullyHarvested ? 'line-through text-stone-400 opacity-60' : ''}`}>
                            <span className="font-sans text-sm font-medium truncate">{goal.title}</span>
                            {cloudSaved && index === 0 && (
                              <motion.span initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }} className="shrink-0" title="Saved to Google Calendar"><CloudUploadIcon /></motion.span>
                            )}
                            {onStartFocus && !isFullyHarvested && (
                              <button type="button" onClick={() => onStartFocus(goal.id, hour, slotRitualTitle ?? undefined, assignment?.subtaskId)} className="shrink-0 flex items-center gap-1 px-2 py-1 rounded font-sans text-xs bg-stone-800 text-stone-50 hover:bg-stone-700 focus:outline-none focus:ring-2 focus:ring-moss-500/50"><span aria-hidden>▶</span><span>Play</span></button>
                            )}
                            {onStartFocus && isFullyHarvested && (
                              <button type="button" onClick={(e) => { triggerHarvestConfetti(e); onHarvestedClick?.(); onStartFocus(goal.id, hour, slotRitualTitle ?? undefined, assignment?.subtaskId); }} className="shrink-0 flex items-center gap-1 px-2 py-1 rounded font-sans text-xs bg-moss-600/90 text-stone-50 font-medium hover:bg-moss-600 focus:outline-none focus:ring-2 focus:ring-moss-500/50" title="Harvested — tap to focus again"><span aria-hidden>✔</span><span>Harvested</span></button>
                            )}
                          </div>
                          {isCriticalMass && <p className="font-sans text-xs text-orange-700 mt-0.5" role="status">Critical Mass: Let&apos;s tackle this before it becomes overwhelming.</p>}
                          {isFullyHarvested && onStartFocus && (
                            <button type="button" onClick={(e) => { triggerHarvestConfetti(e); onHarvestedClick?.(); onStartFocus(goal.id, hour, slotRitualTitle ?? undefined, assignment?.subtaskId); }} className="self-start mt-1 font-sans text-xs text-moss-700 hover:text-moss-800 underline underline-offset-1 focus:outline-none focus:ring-2 focus:ring-moss-500/40 rounded">Over-water (add more)</button>
                          )}
                          {estimatedMins > 0 && (
                            <div className="mt-2 w-full">
                              <div className="h-1 w-full rounded-full bg-stone-300 overflow-hidden" role="progressbar" aria-valuenow={Math.round(progressPercent)} aria-valuemin={0} aria-valuemax={100}>
                                <div className={`h-full rounded-full transition-all duration-300 ${progressBarColor}`} style={{ width: `${Math.min(100, progressPercent)}%` }} />
                              </div>
                            </div>
                          )}
                          {milestoneTitle && firstUncompleted && (
                            <div className="flex items-center gap-2 mt-1.5">
                              <input type="checkbox" checked={false} onChange={() => onMilestoneCheck?.(goal.id, firstUncompleted.id, true)} className="rounded border-stone-300 text-moss-500 focus:ring-moss-500/50 shrink-0" aria-label={`Complete milestone: ${milestoneTitle}`} />
                              <span className="font-sans text-xs text-stone-600 truncate">Next: {milestoneTitle}</span>
                            </div>
                          )}
                        </div>
                      </>
                      )
                    ) : null}
                  </div>
                  {typeof onRemoveSlotItem === 'function' && (
                    <button type="button" onClick={() => onRemoveSlotItem(hour, index)} className="shrink-0 p-1.5 rounded text-stone-400 hover:text-stone-600 hover:bg-stone-200 focus:outline-none focus:ring-2 focus:ring-moss-500/50" aria-label={`Remove from ${hour}`}>×</button>
                  )}
                </motion.div>
              );
            })}
            </AnimatePresence>
          </div>
            );
          })() ) : (
          <span className="font-sans text-sm relative z-10 text-stone-400">
            {onEmptySlotClick ? (isMobile ? 'Tap to add' : 'Add task') : 'Add task'}
          </span>
        )}
      </div>
    </div>
  );
}

/** True if goal is considered completed (harvested) for cross-off styling. */
function isGoalCompleted(goal) {
  if (!goal) return false;
  const est = Number(goal.estimatedMinutes) || 0;
  const total = Number(goal.totalMinutes) || 0;
  if (est > 0 && total >= est) return true;
  const milestones = goal.milestones ?? [];
  return milestones.length > 0 && milestones.every((m) => m.completed);
}

/** Anytime Today (Flexible) drop zone: tasks without a fixed hour. */
function AnytimePoolSection({
  assignments,
  goals,
  onStartFocus,
  onRemove,
  onMilestoneCheck,
}) {
  const { setNodeRef, isOver } = useDroppable({ id: 'anytime-pool' });
  const rawList = assignments?.anytime ?? [];
  const listWithIndex = rawList.map((assignment, originalIndex) => ({ assignment, originalIndex }));
  // Group B (Flexible): uncompleted first (priority true to top), then completed at bottom.
  const list = [...listWithIndex].sort((a, b) => {
    const goalA = goals?.find((g) => g.id === getGoalIdFromAssignment(a.assignment));
    const goalB = goals?.find((g) => g.id === getGoalIdFromAssignment(b.assignment));
    const doneA = isGoalCompleted(goalA);
    const doneB = isGoalCompleted(goalB);
    if (doneA !== doneB) return doneA ? 1 : -1; // uncompleted first
    if (!doneA) {
      const prioA = isPriorityAssignment(a.assignment);
      const prioB = isPriorityAssignment(b.assignment);
      if (prioA !== prioB) return prioA ? -1 : 1; // priority true to top
    }
    return 0;
  });
  return (
    <div className="mb-4">
      <h3 className="font-sans text-sm font-semibold text-stone-700 mb-2 flex items-center gap-2">
        <span aria-hidden>💧</span>
        Anytime Today (Flexible)
      </h3>
      <div
        ref={setNodeRef}
        className={`min-h-[56px] rounded-xl border-2 border-dashed transition-colors flex flex-wrap items-stretch gap-2 p-2 ${
          isOver ? 'border-moss-500/60 bg-moss-50/50' : 'border-stone-300 bg-stone-50/80'
        } ${list.length === 0 ? 'justify-center items-center' : ''}`}
      >
        {list.length === 0 && (
          <span className="font-sans text-sm text-stone-400 py-2">Drop liquid tasks here — no fixed time</span>
        )}
        {list.map(({ assignment, originalIndex }, index) => {
          const goalId = getGoalIdFromAssignment(assignment);
          const slotRitualTitle = getRitualTitleFromAssignment(assignment);
          const subtask = getSubtaskFromAssignment(assignment);
          const routineSession = isRoutineSession(assignment);
          const goal = goalId ? goals?.find((g) => g.id === goalId) : null;
          const title = routineSession ? (assignment.title ?? goal?.title ?? 'Routine') : (goal?.title ?? 'Task');
          const firstUncompleted = goal?.milestones?.find((m) => !m.completed);
          const milestoneTitle = firstUncompleted?.title ?? firstUncompleted?.text;
          const completed = isGoalCompleted(goal);
          const completedClasses = completed ? 'line-through text-stone-400 opacity-60 transition-all duration-500' : '';
          return (
            <div
              key={assignment.id ?? `anytime-${originalIndex}`}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border shrink-0 ${completedClasses} ${
                routineSession ? 'bg-slate-200 border-slate-300' : 'bg-moss-200 border-moss-500/50'
              } text-stone-800`}
            >
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {routineSession && <RepeatIcon />}
                  <span className="font-sans text-sm font-medium truncate">{title}</span>
                </div>
                {subtask?.title && (
                  <span className="font-sans text-xs text-moss-700 truncate block" title={subtask.title}>🌱 {subtask.title}</span>
                )}
                {milestoneTitle && firstUncompleted && (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="checkbox"
                      checked={false}
                      onChange={() => onMilestoneCheck?.(goal?.id, firstUncompleted.id, true)}
                      className="rounded border-stone-300 text-moss-500 focus:ring-moss-500/50 shrink-0"
                      aria-label={`Complete milestone: ${milestoneTitle}`}
                    />
                    <span className="font-sans text-xs text-stone-600 truncate">Next: {milestoneTitle}</span>
                  </div>
                )}
              </div>
              {onStartFocus && goal && (
                <button
                  type="button"
                  onClick={() => onStartFocus(goal.id, null, slotRitualTitle ?? undefined, assignment?.subtaskId)}
                  className="shrink-0 flex items-center gap-1 px-2 py-1 rounded font-sans text-xs bg-stone-800 text-stone-50 hover:bg-stone-700 focus:outline-none focus:ring-2 focus:ring-moss-500/50"
                >
                  <span aria-hidden>▶</span>
                  <span>Play</span>
                </button>
              )}
              <label className="flex items-center gap-1.5 shrink-0 cursor-pointer font-sans text-xs text-stone-600 hover:text-stone-800">
                <input
                  type="checkbox"
                  checked={false}
                  onChange={() => onRemove(originalIndex)}
                  className="rounded border-stone-300 text-moss-500 focus:ring-moss-500/50"
                  aria-label={`Complete and remove: ${title}`}
                />
                <span>Complete</span>
              </label>
            </div>
          );
        })}
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

/** Planned minutes for this goal from current week assignments (kaizen: by goalId; routine: by routine sessions). hours defaults to HOURS if not provided. */
function getPlannedMinutesForGoal(goalId, assignments, goalEstimatedMinutes = 60, hours = HOURS) {
  if (!assignments || !goalId) return 0;
  let total = 0;
  for (const hour of hours) {
    for (const a of getAssignmentsForHour(assignments, hour)) {
      if (getGoalIdFromAssignment(a) === goalId) total += goalEstimatedMinutes;
    }
  }
  return total;
}

/** Planned minutes for a routine goal: sum duration of all slots with parentGoalId === goalId. hours defaults to HOURS if not provided. */
function getPlannedMinutesForRoutine(goalId, assignments, hours = HOURS) {
  if (!assignments || !goalId) return 0;
  let total = 0;
  for (const hour of hours) {
    for (const a of getAssignmentsForHour(assignments, hour)) {
      if (!isRoutineSession(a) || a.parentGoalId !== goalId) continue;
      total += a.duration ?? 60;
    }
  }
  return total;
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

function SeedChip({ goal, item, isRitual = false, assignments = {}, hours = HOURS, onSeedClick, onMilestoneCheck, onEditGoal, onCompostGoal, onAddRoutineTime, onPlantRoutineBlock, onAddSubtask, onStartFocus, onTap, compact = false }) {
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
  const plannedMinutes = getPlannedMinutesForGoal(goal?.id, assignments, goal?.estimatedMinutes ?? 60, hours);
  const plannedMinutesRoutine = getPlannedMinutesForRoutine(goal?.id, assignments, hours);
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
          <div
            {...listeners}
            {...attributes}
            className="flex-1 min-w-0 flex flex-col"
            onClick={(e) => { if (onTap) { e.stopPropagation(); onTap(goal, item); } }}
            role={onTap ? 'button' : undefined}
            aria-label={onTap ? `Add ${displayTitle} to schedule` : undefined}
          >
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
        <div
          {...listeners}
          {...attributes}
          className="flex-1 min-w-0 flex flex-col"
          onClick={(e) => { if (onTap) { e.stopPropagation(); onTap(goal, item); } }}
          role={onTap ? 'button' : undefined}
          aria-label={onTap ? `Add ${displayTitle} to schedule` : undefined}
        >
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
function RitualSeedChip({ goal, ritualTitle, assignments = {}, hours = HOURS, onSeedClick, onMilestoneCheck, onEditGoal, onCompostGoal, onAddRoutineTime, onPlantRoutineBlock, onStartFocus }) {
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
  const plannedMinutes = getPlannedMinutesForGoal(goal?.id, assignments, goal?.estimatedMinutes ?? 60, hours);
  const plannedHours = Math.round((plannedMinutes / 60) * 10) / 10;
  const plannedMinutesRoutine = getPlannedMinutesForRoutine(goal?.id, assignments, hours);
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
              {planningWeek ? <AiButtonThinking label="Planning" /> : '✨ Plan My Week'}
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

function MonthPlanView({ weekAssignments, goals, onDayClick, monthlyRoadmap, onPlanMonth, planningMonth, calendarEvents = [], planMonthLabel = '✨ Plan My Month', planMonthBusyLabel = '✨ Mochi is looking at your calendar...' }) {
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
            {planningMonth ? <AiButtonThinking label="Mochi is planning" /> : planMonthLabel}
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

function DayDetailModal({ dateStr, dayAssignments, goals, onClose, onSwitchToDay, calendarEvents = [], hours = HOURS }) {
  if (!dateStr) return null;
  const dateObj = new Date(dateStr + 'T12:00:00');
  const label = dateObj.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const summary = summarizeDayAssignments(dayAssignments, goals);
  const totalHours = summary.reduce((s, x) => s + x.hours, 0);
  const filledHours = hours.filter((h) => dayAssignments[h]);
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
                {hours.map((hour) => {
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
    <div className="relative z-50 inline-flex rounded-lg border border-stone-200 bg-stone-100 p-0.5">
      {[
        { id: 'day', label: 'Day' },
        { id: 'week', label: 'Week' },
        { id: 'month', label: 'Month' },
      ].map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onChange(id);
          }}
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
  onAddSubtask,
  onLoadLightened,
  onOpenGoalCreator,
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
  zenMode = false,
}) {
  const { googleToken: googleTokenContext, spiritConfig, addLog, tourStep, setTourStep } = useGarden();
  const { pushReward } = useReward();
  const googleToken = googleTokenProp ?? googleTokenContext ?? null;

  const [viewMode, setViewMode] = useState('day'); // 'day' | 'week' | 'month'
  const [editingDate, setEditingDate] = useState(null); // null = today, 'YYYY-MM-DD' = specific date
  const [internalAssignments, setInternalAssignments] = useState({});
  const [recentlyExportedSlot, setRecentlyExportedSlot] = useState(null);
  const [pendingRoutineDrop, setPendingRoutineDrop] = useState(null); // { time, goal, value }
  const [seedPickerTargetHour, setSeedPickerTargetHour] = useState(null);
  const [seedBagTapTarget, setSeedBagTapTarget] = useState(null); // { goal, item? } for tap-to-add popover
  const [inspectedDate, setInspectedDate] = useState(null);
  const [activeSeedTab, setActiveSeedTab] = useState('all');
  const [seedBagSearch, setSeedBagSearch] = useState('');
  /** Seed Bag accordion: Set of category keys that are expanded. Default all collapsed. */
  const [seedBagExpandedCategories, setSeedBagExpandedCategories] = useState(() => new Set());
  const [spoonsToast, setSpoonsToast] = useState(false);
  const [energyToast, setEnergyToast] = useState(false);
  const [lightenedTasksFeedback, setLightenedTasksFeedback] = useState([]);
  const [showPrioritize, setShowPrioritize] = useState(false);
  const [priorities, setPriorities] = useState(null);
  const [recommendedTaskId, setRecommendedTaskId] = useState(null);
  const [recommendedReason, setRecommendedReason] = useState(null);
  const [prioritizeSuccess, setPrioritizeSuccess] = useState(false);
  const [prioritizeLoading, setPrioritizeLoading] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT);
  const [showFullSchedule, setShowFullSchedule] = useState(!zenMode);
  const garden = useGarden();
  const userSettings = garden?.userSettings ?? {};
  const dayStartStr = userSettings.dayStart ?? '08:00';
  const dayEndStr = userSettings.dayEnd ?? '22:00';
  const hourStart = useMemo(() => parseTimeToHour(dayStartStr) ?? 8, [dayStartStr]);
  const hourEnd = useMemo(() => parseTimeToHour(dayEndStr) ?? 22, [dayEndStr]);
  const hoursArray = useMemo(
    () =>
      Array.from(
        { length: Math.max(0, hourEnd - hourStart + 1) },
        (_, i) => `${String(hourStart + i).padStart(2, '0')}:00`
      ),
    [hourStart, hourEnd]
  );
  const weekAssignments = garden?.weekAssignments ?? {};
  const loadWeekPlans = typeof garden?.loadWeekPlans === 'function' ? garden.loadWeekPlans : () => {};
  const loadDayPlan = typeof garden?.loadDayPlan === 'function' ? garden.loadDayPlan : async () => ({});
  const saveDayPlanForDate = typeof garden?.saveDayPlanForDate === 'function' ? garden.saveDayPlanForDate : async () => {};
  const routineTemplates = Array.isArray(garden?.routines) ? garden.routines : [];
  const isControlled = typeof onAssignmentsChange === 'function';
  const assignments = isControlled ? (controlledAssignments ?? {}) : internalAssignments;
  const safeOnAssignmentsChange = typeof onAssignmentsChange === 'function' ? onAssignmentsChange : () => {};
  const safeGoals = Array.isArray(goals) ? goals : [];
  const safeCalendarEvents = Array.isArray(calendarEvents) ? calendarEvents : [];
  const safeTodayRitualItems = Array.isArray(todayRitualItems) ? todayRitualItems : [];
  const safeGoalBank = Array.isArray(goalBank) ? goalBank : [];

  const viewedDate = editingDate ? new Date(editingDate + 'T12:00:00') : now;
  const currentDay = viewedDate.getDay();
  const dayOfMonth = viewedDate.getDate();
  const isEvenWeek = Math.floor((viewedDate.getTime() - new Date(viewedDate.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000)) % 2 === 0;
  const routineGoals = safeGoals.filter((g) => g && g.type === 'routine');
  const todayRitualEntries = useMemo(
    () =>
      routineGoals.flatMap((goal) =>
        (goal?.rituals || [])
          .filter((r) => {
            if (r.frequency === 'monthly') return Number(r.monthDay) === dayOfMonth;
            if (r.frequency === 'biweekly' && !isEvenWeek) return false;
            return r.days && r.days.includes(currentDay);
          })
          .map((r) => ({ goal, ritual: r }))
      ),
    [safeGoals, currentDay, dayOfMonth, isEvenWeek]
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
    if ((viewMode === 'week' || viewMode === 'month') && typeof loadWeekPlans === 'function') loadWeekPlans();
  }, [viewMode, loadWeekPlans]);

  const applyAssignment = (time, value) => {
    const next = { ...assignments };
    if (time === 'anytime') {
      next.anytime = [...(next.anytime || []), value];
    } else {
      const slotKey = toCanonicalSlotKey(time) ?? time;
      next[slotKey] = [...getAssignmentsForHour(next, time), value];
      if (slotKey !== time) delete next[time];
    }
    if (isControlled) safeOnAssignmentsChange(next);
    else setInternalAssignments(next);
  };

  const removeAssignment = (hour, index) => {
    const list = getAssignmentsForHour(assignments, hour);
    if (index < 0 || index >= list.length) return;
    const next = { ...assignments };
    const slotKey = toCanonicalSlotKey(hour) ?? hour;
    const newList = list.filter((_, i) => i !== index);
    next[slotKey] = newList.length > 0 ? newList : [];
    if (newList.length === 0) delete next[slotKey];
    if (slotKey !== hour) delete next[hour];
    if (isControlled) safeOnAssignmentsChange(next);
    else setInternalAssignments(next);
  };

  const removeFromAnytime = useCallback((index) => {
    const list = (assignments.anytime || []).filter((_, i) => i !== index);
    const next = { ...assignments, anytime: list };
    if (isControlled) safeOnAssignmentsChange(next);
    else setInternalAssignments(next);
  }, [assignments, isControlled, safeOnAssignmentsChange]);

  /** Complete an Anytime item: remove from list, grant +1 Water, show post-task vibe toast (Energized/Drained). */
  const handleCompleteAnytimeWithVibe = useCallback((index) => {
    if (tourStep === 3 && typeof setTourStep === 'function') setTourStep(4);
    const list = assignments?.anytime ?? [];
    const assignment = list[index];
    if (assignment == null) {
      removeFromAnytime(index);
      return;
    }
    const goalId = getGoalIdFromAssignment(assignment);
    const goal = safeGoals?.find((g) => g.id === goalId);
    const taskTitle = goal?.title ?? (assignment && typeof assignment === 'object' && assignment.title) ?? 'Task';
    removeFromAnytime(index);
    if (typeof garden?.addWater === 'function') garden.addWater(1);
    const taskReward = buildReward({ type: 'TASK_COMPLETE', payload: { goalTitle: taskTitle } });
    pushReward({
      ...(taskReward || { message: 'Task completed.', tone: 'moss', icon: '✓', durationMs: 4000, variableBonus: { waterDrops: 1 } }),
      durationMs: 4000,
      vibePayload: { goalId, taskTitle },
      onVibe: (vibe) => {
        const energyCost = goal?.energyCost ?? goal?.spoonCost ?? undefined;
        addLog?.({ taskId: goalId, taskTitle, minutes: 0, date: new Date(), vibe, energyCost });
      },
    });
  }, [assignments, safeGoals, removeFromAnytime, pushReward, addLog, tourStep, setTourStep, garden]);

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
    if (!energyToast) return;
    const t = setTimeout(() => setEnergyToast(false), 3000);
    return () => clearTimeout(t);
  }, [energyToast]);

  const baseCapacity = MAX_SLOTS_BY_WEATHER[weather] ?? 6;
  /** Sparks 1–10: use as slot count (1 = minimal, 10 = full). Legacy 1–5 used energyLevelToSlots; we now treat 1–10 as capacity. */
  const energyLevelToSlots = (n) => (n <= 2 ? 2 + (n - 1) * 2 : n === 3 ? 6 : n === 4 ? 8 : 10);
  const maxSlots =
    typeof dailySpoonCount === 'number' && dailySpoonCount >= 1 && dailySpoonCount <= 10
      ? dailySpoonCount
      : typeof dailySpoonCount === 'number' && dailySpoonCount === 0
        ? 0
        : typeof dailySpoonCount === 'number' && dailySpoonCount >= 11 && dailySpoonCount <= 12
          ? dailySpoonCount
          : Math.max(1, baseCapacity + dailyEnergyModifier);
  const isLowEnergy =
    (typeof dailySpoonCount === 'number' && dailySpoonCount <= 3) || dailyEnergyModifier === -2;
  const filledTimes = hoursArray.filter((h) => !isSlotEmpty(assignments, h));
  /** Timeline is always in strict chronological order (hoursArray). No re-sorting — tasks stay in their time slot. */
  /** Today's tasks for "Help Me Prioritize" AI: one entry per goal (id, title, isFixed), from flattened assignments. */
  const todayTasks = useMemo(() => {
    const seen = new Set();
    const list = [];
    for (const hour of hoursArray) {
      for (const a of getAssignmentsForHour(assignments, hour)) {
        const id = getGoalIdFromAssignment(a);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const goal = safeGoals?.find((g) => g.id === id);
        list.push({
          id,
          title: goal?.title ?? (a && typeof a === 'object' && a.title) ?? 'Task',
          isFixed: isAssignmentFixed(a),
        });
      }
    }
    for (const a of assignments?.anytime ?? []) {
      const id = getGoalIdFromAssignment(a);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const goal = safeGoals?.find((g) => g.id === id);
      list.push({
        id,
        title: goal?.title ?? (a && typeof a === 'object' && a.title) ?? 'Task',
        isFixed: false,
      });
    }
    return list;
  }, [assignments, hoursArray, safeGoals]);
  /** Today's tasks that are not yet completed (for AI: pick one to prioritize). */
  const todayUncompletedTasks = useMemo(() => {
    return todayTasks.filter((t) => {
      const goal = safeGoals?.find((g) => g.id === t.id);
      return !isGoalCompleted(goal);
    });
  }, [todayTasks, safeGoals]);
  /** True if any assignment today has priority (starred). */
  const hasAnyPrioritizedToday = useMemo(() => {
    for (const key of Object.keys(assignments)) {
      if (key === 'anytime') continue;
      for (const a of getAssignmentsForHour(assignments, key)) {
        if (a && typeof a === 'object' && a.priority === true) return true;
      }
    }
    for (const a of assignments?.anytime ?? []) {
      if (a && typeof a === 'object' && a.priority === true) return true;
    }
    return false;
  }, [assignments]);
  /** Energy 1-5 for AI: Sparks 1-10 map to 1-5 (e.g. 1-2→1, 9-10→5). */
  const energyLevelForAi = useMemo(() => {
    const n = dailySpoonCount;
    if (typeof n === 'number' && n >= 1 && n <= 10) return Math.min(5, Math.ceil(n / 2));
    if (typeof n === 'number' && n >= 11 && n <= 12) return 5;
    return 3;
  }, [dailySpoonCount]);
  const anytimeCount = (assignments?.anytime ?? []).length;
  const hasNoAssignments = filledTimes.length === 0 && anytimeCount === 0;
  const filledSpoonTotal = useMemo(() => {
    let total = 0;
    for (const h of hoursArray) {
      for (const a of getAssignmentsForHour(assignments, h)) {
        if (a && typeof a === 'object' && (a.type === 'recovery' || a.spoonCost === 0)) continue;
        const gid = getGoalIdFromAssignment(a);
        const goal = safeGoals.find((g) => g.id === gid);
        total += getSpoonCost(goal ?? a);
      }
    }
    return total;
  }, [assignments, safeGoals, hoursArray]);
  const isOverCapacity = filledSpoonTotal > maxSlots;

  const handleLightenLoad = () => {
    const energyModifier =
      typeof dailySpoonCount === 'number' && dailySpoonCount <= 10
        ? (dailySpoonCount <= 3 ? -2 : dailySpoonCount >= 8 ? 1 : 0)
        : dailyEnergyModifier;
    const result = suggestLoadLightening(assignments, safeGoals, maxSlots, energyModifier);
    if (result != null) {
      if (isControlled) safeOnAssignmentsChange(result.assignments);
      else setInternalAssignments(result.assignments);
      setLightenedTasksFeedback(result.removedItems ?? []);
      onLoadLightened?.(result.removedItems);
    }
  };

  const handleOpenPrioritize = () => {
    setPriorities(getGentlePriorities(safeGoals, maxSlots));
    setShowPrioritize(true);
    setRecommendedTaskId(null);
    setRecommendedReason(null);
    setPrioritizeSuccess(false);
    setPrioritizeLoading(true);
    const tasksForAi = todayUncompletedTasks.length > 0 ? todayUncompletedTasks : todayTasks;
    if (tasksForAi.length > 0) {
      recommendDailyPriority(tasksForAi, energyLevelForAi)
        .then(({ recommendedTaskId: id, reason }) => {
          setRecommendedTaskId(id);
          setRecommendedReason(reason ?? null);
          if (id) {
            handleApplyPriority(id, { closeModal: false });
            setPrioritizeSuccess(true);
          }
        })
        .catch(() => {})
        .finally(() => setPrioritizeLoading(false));
    } else {
      setPrioritizeLoading(false);
    }
  };

  /** Set priority true on the chosen goal and false on all others; do NOT change date, startTime, or isFixed. */
  const handleApplyPriority = useCallback(
    (goalId, options = {}) => {
      if (!goalId) return;
      const { closeModal = true } = options;
      const next = { ...assignments };
      let changed = false;
      const setPriority = (a, value) => {
        if (a == null) return a;
        const obj = typeof a === 'object' ? { ...a } : { goalId: a };
        obj.priority = value;
        return obj;
      };
      for (const key of Object.keys(next)) {
        if (key === 'anytime') continue;
        const a = next[key];
        if (a == null) continue;
        const gid = getGoalIdFromAssignment(a);
        next[key] = setPriority(a, gid === goalId);
        changed = true;
      }
      if (next.anytime && Array.isArray(next.anytime)) {
        next.anytime = next.anytime.map((a) => {
          const gid = getGoalIdFromAssignment(a);
          changed = true;
          return setPriority(a, gid === goalId);
        });
      }
      if (changed) {
        if (isControlled) safeOnAssignmentsChange(next);
        else setInternalAssignments(next);
      }
      onEditGoal?.(goalId, { priority: true });
      if (closeModal) {
        setShowPrioritize(false);
        setRecommendedTaskId(null);
        setRecommendedReason(null);
        setPrioritizeSuccess(false);
        window.dispatchEvent(new CustomEvent('kaizen:toast', { detail: { message: 'Focus set 🌟' } }));
      }
    },
    [assignments, isControlled, safeOnAssignmentsChange, onEditGoal]
  );

  const handlePrioritizeSelectTask = (goal) => {
    if (!goal?.id) return;
    const firstEmpty = hoursArray.find((h) => isSlotEmpty(assignments, h));
    if (!firstEmpty) {
      window.dispatchEvent(new CustomEvent('kaizen:toast', { detail: { message: "Your day is full. Lighten your load or pick another day." } }));
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
        spoonCost: getSpoonCost(goal),
      };
    } else {
      value = goal.id;
    }
    applyAssignment(firstEmpty, value);
    setShowPrioritize(false);
    window.dispatchEvent(new CustomEvent('kaizen:toast', { detail: { message: 'Added to your day 🌱' } }));
  };

  /** Build assignment value for a goal (and optional ritual item) for tap-to-add. */
  const getTapAssignmentValue = useCallback((goal, item) => {
    if (!goal?.id) return null;
    if (goal.type === 'routine') {
      return {
        id: crypto.randomUUID?.() ?? `s-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        parentGoalId: goal.id,
        title: goal.title,
        type: 'routine',
        duration: 60,
        spoonCost: getSpoonCost(goal),
        ...(item?.title && { ritualTitle: item.title }),
      };
    }
    return goal.id;
  }, []);

  const handleTapAddToNextHour = useCallback(() => {
    const { goal, item, routine } = seedBagTapTarget || {};
    const firstEmpty = hoursArray.find((h) => isSlotEmpty(assignments, h));
    if (!firstEmpty) {
      window.dispatchEvent(new CustomEvent('kaizen:toast', { detail: { message: "Your day is full. Lighten your load or pick another day." } }));
      setSeedBagTapTarget(null);
      return;
    }
    let value = null;
    if (routine) {
      value = { type: 'routineTemplate', routineId: routine.id, title: routine.title, duration: Math.max(1, Math.min(120, Number(routine.duration) || 5)) };
    } else if (goal?.id) {
      value = getTapAssignmentValue(goal, item);
    }
    if (value != null) {
      applyAssignment(firstEmpty, value);
      window.dispatchEvent(new CustomEvent('kaizen:toast', { detail: { message: 'Added to your day 🌱' } }));
    }
    setSeedBagTapTarget(null);
  }, [seedBagTapTarget, assignments, getTapAssignmentValue, applyAssignment, hoursArray]);

  const handleTapAddToAnytime = useCallback(() => {
    const { goal, item, routine } = seedBagTapTarget || {};
    let value = null;
    if (routine) {
      value = { type: 'routineTemplate', routineId: routine.id, title: routine.title, duration: Math.max(1, Math.min(120, Number(routine.duration) || 5)) };
    } else if (goal?.id) {
      value = getTapAssignmentValue(goal, item);
    }
    if (value != null) {
      applyAssignment('anytime', value);
      window.dispatchEvent(new CustomEvent('kaizen:toast', { detail: { message: 'Added to Anytime Today 💧' } }));
    }
    setSeedBagTapTarget(null);
  }, [seedBagTapTarget, getTapAssignmentValue, applyAssignment]);

  /** Plant one 1h routine block in the first empty slot. Used by [+1h] on routine cards. */
  const handlePlantRoutineBlock = (goal) => {
    if (!goal?.id || goal?.type !== 'routine') return;
    const firstEmpty = hoursArray.find((h) => isSlotEmpty(assignments, h));
    if (!firstEmpty) return;
    const value = {
      id: crypto.randomUUID?.() ?? `s-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      parentGoalId: goal.id,
      title: goal.title,
      type: 'routine',
      duration: 60,
      spoonCost: getSpoonCost(goal),
    };
    applyAssignment(firstEmpty, value);
  };

  const handleMilestoneCheck = useCallback((goalId, milestoneId, completed) => {
    setEnergyToast(true);
    onMilestoneCheck?.(goalId, milestoneId, completed);
  }, [onMilestoneCheck]);

  const handleHarvestedClick = useCallback(() => {
    setEnergyToast(true);
  }, []);

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || !active) return;
    const time = String(over.id);
    const data = active.data?.current;
    const ritualTitle = data?.ritualTitle;
    const goalId = data?.goal?.id ?? active.id;
    const goal = safeGoals.find((g) => g.id === goalId);

    if (time === 'anytime-pool') {
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
          setPendingRoutineDrop({ time: 'anytime', goal, value });
          return;
        }
      } else if (goal?.type === 'kaizen') {
        const vines = goal.subtasks ?? [];
        if (vines.length > 0) {
          value = { goalId: goal.id };
          setPendingRoutineDrop({ time: 'anytime', goal, value });
          return;
        }
        value = ritualTitle ? { goalId, ritualTitle } : goalId;
      } else {
        value = ritualTitle ? { goalId, ritualTitle } : goalId;
      }
      applyAssignment('anytime', value);
      return;
    }

    if (!hoursArray.includes(time)) return;
    const targetWasEmpty = isSlotEmpty(assignments, time);

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
    } else if (goal?.type === 'kaizen') {
      const vines = goal.subtasks ?? [];
      if (vines.length > 0) {
        value = { goalId: goal.id };
        setPendingRoutineDrop({ time, goal, value });
        return;
      }
      value = ritualTitle ? { goalId, ritualTitle } : goalId;
    } else {
      value = ritualTitle ? { goalId, ritualTitle } : goalId;
    }

    const existingTotalMins = getAssignmentsForHour(assignments, time).reduce(
      (sum, a) => sum + getDurationMinutesFromAssignment(a, safeGoals),
      0
    );
    const newTaskMins = getDurationMinutesFromValue(value, goal);
    if (existingTotalMins + newTaskMins > 60) {
      window.dispatchEvent(new CustomEvent('kaizen:toast', { detail: { message: 'This hour is getting a bit crowded!' } }));
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
    if (!time || !hoursArray.includes(time) || !goal?.id) return;
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
    } else if (goal.type === 'kaizen') {
      const vines = goal.subtasks ?? [];
      if (vines.length > 0) {
        value = { goalId: goal.id };
        setPendingRoutineDrop({ time, goal, value });
        setSeedPickerTargetHour(null);
        return;
      }
      value = ritualTitle ? { goalId: goal.id, ritualTitle } : goal.id;
    } else {
      value = ritualTitle ? { goalId: goal.id, ritualTitle } : goal.id;
    }
    applyAssignment(time, value);
    setSeedPickerTargetHour(null);
  };

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
      if (isControlled) safeOnAssignmentsChange(dayData);
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
    if (isControlled) safeOnAssignmentsChange(weekAssignments[todayStr] ?? {});
  }, [editingDate, isControlled, assignments, safeOnAssignmentsChange, weekAssignments, todayStr, saveDayPlanForDate]);

  /** Current or next task for zen-mode: first slot at or after now with assignment, or first of day. */
  const currentNextItem = useMemo(() => {
    if (!zenMode) return null;
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const items = [];
    for (const hour of hoursArray) {
      const [h] = hour.split(':').map(Number);
      const slotMins = h * 60;
      for (const a of getAssignmentsForHour(assignments, hour)) {
        const goalId = getGoalIdFromAssignment(a);
        const goal = safeGoals.find((g) => g.id === goalId);
        items.push({ hour, goalId, goal, slotMins, ritualTitle: getRitualTitleFromAssignment(a), subtaskId: getSubtaskFromAssignment(a)?.id });
      }
    }
    if (items.length === 0) return null;
    const sorted = [...items].sort((a, b) => a.slotMins - b.slotMins);
    const upcoming = sorted.filter((i) => i.slotMins >= nowMins);
    const first = upcoming.length > 0 ? upcoming[0] : sorted[0];
    const title = first.ritualTitle || first.goal?.title;
    return { ...first, title: title ?? 'Task', estimatedMinutes: first.goal?.estimatedMinutes ?? 60, spoonCost: getSpoonCost(first.goal ?? {}) };
  }, [zenMode, assignments, safeGoals, now, hoursArray]);

  return (
    <div className="bg-stone-50 rounded-xl border border-stone-200 p-6 min-w-0">
      <div className="relative z-50 flex items-center justify-between gap-2 mb-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="font-serif text-stone-900 text-lg">Schedule</h2>
          <ViewToggle value={viewMode} onChange={(mode) => {
            if (viewMode === 'day' && editingDate && editingDate !== todayStr) {
              saveDayPlanForDate(editingDate, assignments);
              setEditingDate(null);
              if (isControlled) safeOnAssignmentsChange(weekAssignments[todayStr] ?? {});
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
              onClick={(e) => { e.stopPropagation(); handleOpenPrioritize(); }}
              className="shrink-0 px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 font-sans text-sm text-amber-800 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-400/40 transition-colors"
              aria-label="Help me focus (gentle priorities)"
            >
              🎯 Help me focus
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const dateStr = editingDate || localISODate();
                const dayEvents = [];
                for (const h of hoursArray) {
                  const list = getAssignmentsForHour(assignments, h);
                  const [hourNum] = h.split(':').map(Number);
                  let offsetMins = 0;
                  for (let i = 0; i < list.length; i++) {
                    const a = list[i];
                    const gid = getGoalIdFromAssignment(a);
                    const goal = safeGoals.find((g) => g.id === gid);
                    const durationMins = goal?.estimatedMinutes ?? 60;
                    const startTime = new Date(dateStr + 'T' + String(hourNum).padStart(2, '0') + ':00');
                    startTime.setMinutes(startTime.getMinutes() + offsetMins);
                    const endTime = new Date(startTime.getTime() + durationMins * 60 * 1000);
                    dayEvents.push({ id: `kz-${h}-${i}`, title: goal?.title || 'Kaizen Task', start: startTime, end: endTime });
                    offsetMins += durationMins;
                  }
                }
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
          goals={safeGoals}
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
          goals={safeGoals}
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

      {viewMode === 'day' && (zenMode && !showFullSchedule ? (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl border-2 border-moss-400 bg-moss-50/90 shadow-md">
            <p className="font-sans text-xs font-semibold text-moss-700 uppercase tracking-wider mb-2">Current / Next</p>
            {currentNextItem ? (
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <span className="font-sans text-lg font-semibold text-stone-900 block truncate">{currentNextItem.title}</span>
                  <span className="font-sans text-sm text-stone-500">
                    {currentNextItem.estimatedMinutes}m
                    {currentNextItem.spoonCost != null && currentNextItem.spoonCost > 0 ? ` · ${currentNextItem.spoonCost} spoon${currentNextItem.spoonCost !== 1 ? 's' : ''}` : ''}
                  </span>
                </div>
                {onStartFocus && currentNextItem.goal && (
                  <button
                    type="button"
                    onClick={() => onStartFocus(currentNextItem.goal.id, currentNextItem.hour, currentNextItem.ritualTitle ?? undefined, currentNextItem.subtaskId)}
                    className="shrink-0 px-5 py-2.5 rounded-xl font-sans text-sm font-medium bg-moss-600 text-stone-50 hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/50"
                  >
                    Start 5 min
                  </button>
                )}
              </div>
            ) : (
              <p className="font-sans text-stone-500">Nothing planned yet.</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowFullSchedule(true)}
            className="w-full py-3 px-4 rounded-xl font-sans text-sm font-medium border-2 border-stone-300 bg-stone-100 text-stone-700 hover:bg-stone-200 focus:outline-none focus:ring-2 focus:ring-moss-500/50 flex items-center justify-center gap-2"
          >
            <span aria-hidden>📋</span> View Full Schedule
          </button>
        </div>
      ) : (
      <DndContext onDragEnd={handleDragEnd}>
        {zenMode && (
          <div className="flex justify-end mb-2">
            <button
              type="button"
              onClick={() => setShowFullSchedule(false)}
              className="px-3 py-1.5 rounded-lg font-sans text-sm text-stone-500 hover:text-stone-700 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-moss-500/50"
            >
              Collapse schedule
            </button>
          </div>
        )}
        {viewMode === 'day' && todayUncompletedTasks.length > 0 && !hasAnyPrioritizedToday && (
          <div className="mb-4">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleOpenPrioritize(); }}
              className="w-full py-3 px-4 rounded-xl font-sans text-sm font-medium bg-amber-50 border-2 border-amber-200 text-amber-800 hover:bg-amber-100 hover:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:ring-offset-2 transition-all shadow-sm hover:shadow"
              style={{ boxShadow: '0 0 20px rgba(251, 191, 36, 0.25)' }}
              aria-label="Mochi, pick one task for me"
            >
              ✨ Mochi, pick one for me
            </button>
          </div>
        )}
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
            <span className="text-xl shrink-0 inline-flex items-center justify-center" aria-hidden>
              {spiritConfig?.type === 'mochi' ? (
                <DefaultSpiritSvg className="w-8 h-8" />
              ) : (
                getSpiritEmoji(spiritConfig)
              )}
            </span>
            <p className="font-sans text-sm text-amber-800 leading-relaxed">
              &ldquo;Your energy is depleted today. You may still plant these seeds, but please consider resting first. The garden will wait for you.&rdquo;
            </p>
          </div>
        )}
        <AnytimePoolSection
          assignments={assignments}
          goals={safeGoals}
          onStartFocus={onStartFocus}
          onRemove={handleCompleteAnytimeWithVibe}
          onMilestoneCheck={handleMilestoneCheck}
        />
        <div className="flex flex-col gap-6 min-w-0">
          {/* Schedule — Bamboo Timeline (scrollable) */}
          <div className="flex gap-3 max-h-[70vh] md:max-h-[420px] overflow-y-auto overflow-x-hidden rounded-lg">
            <div className="shrink-0 w-px bg-stone-300 rounded-full self-stretch" />
            <div className="flex-1 relative min-h-0">
              {/* Calendar events for this day */}
              {(() => {
                const targetDate = editingDate || localISODate();
                const dayEvts = safeCalendarEvents.filter((e) => {
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
              {hasNoAssignments && (
                <div className="flex flex-col items-center justify-center w-full text-center p-8 opacity-80 animate-in fade-in duration-500" aria-live="polite">
                  <span className="text-6xl mb-4" aria-hidden>🍃</span>
                  <h3 className="text-xl font-bold text-stone-700 mb-2">Your day is clear.</h3>
                  <p className="text-stone-500 text-sm">Rest in your garden, or pull a new seed from the backlog.</p>
                </div>
              )}
              <div className="space-y-0">
                {hoursArray.map((hour) => (
                  <TimeSlot
                    key={hour}
                    hour={hour}
                    assignmentsList={getAssignmentsForHour(assignments, hour)}
                    goals={goals}
                    filledOrderIndex={filledTimes.indexOf(hour)}
                    filledCount={filledSpoonTotal}
                    maxSlots={maxSlots}
                    onStartFocus={onStartFocus}
                    onMilestoneCheck={handleMilestoneCheck}
                    onHarvestedClick={handleHarvestedClick}
                    cloudSaved={recentlyExportedSlot === hour}
                    now={now}
                    isMobile={isMobile}
                    onEmptySlotClick={(h) => setSeedPickerTargetHour(h)}
                    onRemoveSlotItem={removeAssignment}
                    disableConfetti={getSettings().lowStim || shouldReduceMotion(getSettings())}
                    hourStart={hourStart}
                    hourEnd={hourEnd}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Seed Bag — searchable backlog list */}
          <div className="border border-stone-200 rounded-lg bg-white/60 p-4 flex flex-col min-h-0">
            <h3 className="font-serif text-stone-800 text-sm mb-1 shrink-0">Seed Bag</h3>
            <p className="font-sans text-xs text-stone-500 mb-3 shrink-0">
              Tap + to pull an item into your day.
            </p>
            <input
              type="text"
              placeholder="🔍 Search backlog..."
              value={seedBagSearch}
              onChange={(e) => setSeedBagSearch(e.target.value)}
              className="w-full p-3 bg-stone-100 border border-stone-200 rounded-xl mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-400 shrink-0"
              aria-label="Search backlog"
            />
            <div className="flex flex-col min-h-0 max-h-[50vh] overflow-y-auto rounded-xl border border-stone-100 bg-white/80">
              {(() => {
                const searchLower = (seedBagSearch || '').trim().toLowerCase();
                const routineRows = (routineTemplates ?? []).map((r) => ({
                  key: `routine-${r.id}`,
                  goal: null,
                  item: null,
                  routine: r,
                  title: r.title ?? 'Routine',
                  typeLabel: 'Micro-habit',
                  category: r.category ?? '📋 Other',
                  durationMinutes: Math.max(1, Math.min(120, Number(r.duration) || 5)),
                }));
                const bankRows = safeGoalBank.map((goal) => {
                  const durationMin = Number(goal.estimatedMinutes) || 15;
                  return {
                    key: goal.id,
                    goal,
                    item: null,
                    title: goal.title,
                    typeLabel: goal._projectGoal ? (goal._projectName || 'Project') : (goal.type === 'routine' ? 'Routine' : goal.type === 'vitality' ? 'Vitality' : 'Kaizen'),
                    category: goal.category || 'Other',
                    durationMinutes: durationMin,
                  };
                });
                const allRows = [...routineRows, ...bankRows];
                const filtered = searchLower
                  ? allRows.filter((r) => (r.title || '').toLowerCase().includes(searchLower) || (r.typeLabel || '').toLowerCase().includes(searchLower) || (r.category || '').toLowerCase().includes(searchLower))
                  : allRows;

                const categoryOrder = ['Care & Hygiene', 'Life Admin', 'Deep Work', 'Other'];
                const byCategory = filtered.reduce((acc, row) => {
                  const cat = row.category || 'Other';
                  if (!acc[cat]) acc[cat] = [];
                  acc[cat].push(row);
                  return acc;
                }, {});
                const sortedCategories = [...new Set(filtered.map((r) => r.category || 'Other'))].sort(
                  (a, b) => (categoryOrder.indexOf(a) === -1 ? 99 : categoryOrder.indexOf(a)) - (categoryOrder.indexOf(b) === -1 ? 99 : categoryOrder.indexOf(b)) || a.localeCompare(b)
                );

                if (filtered.length === 0) {
                  return (
                    <div className="py-8 text-center">
                      <p className="font-sans text-sm text-stone-500 mb-3">
                        {allRows.length === 0 ? 'Seed bag empty.' : 'No matches.'}
                      </p>
                      {onOpenGoalCreator && allRows.length === 0 && (
                        <button
                          type="button"
                          onClick={onOpenGoalCreator}
                          className="py-2.5 px-4 rounded-lg border-2 border-dashed border-moss-400 text-moss-700 font-sans text-sm hover:bg-moss-50 hover:border-moss-500 focus:outline-none focus:ring-2 focus:ring-moss-500/40 transition-colors"
                        >
                          Plant a Seed
                        </button>
                      )}
                    </div>
                  );
                }
                return (
                  <div className="divide-y divide-stone-100">
                    {sortedCategories.map((cat, catIndex) => {
                      const expanded = seedBagExpandedCategories.has(cat);
                      const count = (byCategory[cat] || []).length;
                      const label = BACKLOG_CATEGORY_LABELS[cat] ?? cat;
                      const panelId = `seedbag-panel-${catIndex}`;
                      const headerId = `seedbag-header-${catIndex}`;
                      return (
                        <section key={cat} className="relative">
                          <button
                            type="button"
                            onClick={() => {
                              setSeedBagExpandedCategories((prev) => {
                                const next = new Set(prev);
                                if (next.has(cat)) next.delete(cat);
                                else next.add(cat);
                                return next;
                              });
                            }}
                            className="sticky top-0 z-10 w-full flex items-center justify-between gap-2 bg-stone-100/95 backdrop-blur py-3 px-3 border-b border-stone-200 text-left hover:bg-stone-200/80 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-inset transition-colors min-h-[44px]"
                            aria-expanded={expanded}
                            aria-controls={panelId}
                            id={headerId}
                          >
                            <span className="font-sans text-xs font-bold text-stone-700 uppercase tracking-wide flex-1 truncate">
                              {label} <span className="font-normal text-stone-500 normal-case">({count})</span>
                            </span>
                            <span
                              className={`shrink-0 w-6 h-6 flex items-center justify-center text-stone-500 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
                              aria-hidden
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="9 18 15 12 9 6" />
                              </svg>
                            </span>
                          </button>
                          <motion.div
                            id={panelId}
                            role="region"
                            aria-labelledby={headerId}
                            initial={false}
                            animate={{ height: expanded ? 'auto' : 0, opacity: expanded ? 1 : 0 }}
                            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                            className="overflow-hidden"
                          >
                            <ul className="divide-y divide-stone-100" role="list">
                              {(byCategory[cat] || []).map(({ key, goal, item, routine, title, typeLabel, durationMinutes }) => {
                                const isKaizen = durationMinutes <= 15;
                                return (
                                  <li key={key}>
                                    <div className="flex justify-between items-center p-3 hover:bg-stone-50 transition-colors">
                                      <div className="min-w-0 flex-1 pr-3">
                                        <p className="font-sans text-sm font-medium text-stone-900 truncate">
                                          <span className="font-sans text-xs text-stone-500 font-normal tabular-nums mr-1.5">[{durationMinutes} min]</span>
                                          {title || 'Untitled'}
                                          {isKaizen && (
                                            <span className="ml-1.5 inline-flex items-center rounded-md bg-emerald-50 px-1.5 py-0.5 font-sans text-[10px] font-medium text-emerald-700" title="Low-friction (≤15 min)">
                                              🌱 Kaizen
                                            </span>
                                          )}
                                        </p>
                                        <p className="font-sans text-[11px] text-stone-500">{typeLabel}</p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => setSeedBagTapTarget(routine ? { routine } : { goal, item })}
                                        className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg font-bold text-sm shrink-0 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                        aria-label={`Add ${title || 'item'} to day`}
                                      >
                                        +
                                      </button>
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          </motion.div>
                        </section>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>

            {/* Tap-to-add popover / action sheet */}
            <AnimatePresence>
              {seedBagTapTarget && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="tap-add-schedule-title"
                >
                  <div
                    className="absolute inset-0 bg-stone-900/40 pointer-events-auto"
                    aria-hidden
                    onClick={() => setSeedBagTapTarget(null)}
                  />
                  <motion.div
                    initial={{ y: 24, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 24, opacity: 0 }}
                    transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                    onClick={(e) => e.stopPropagation()}
                    className="relative w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl bg-stone-50 border border-stone-200 shadow-xl p-4 pb-6 safe-area-pb pointer-events-auto"
                  >
                    <h2 id="tap-add-schedule-title" className="font-serif text-stone-900 text-lg mb-4">Add to schedule</h2>
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={handleTapAddToNextHour}
                        className="w-full py-3 px-4 rounded-xl font-sans text-sm font-medium text-stone-800 bg-moss-100 border border-moss-300 hover:bg-moss-200 focus:outline-none focus:ring-2 focus:ring-moss-500/50 transition-colors"
                      >
                        🎯 Add to next available hour
                      </button>
                      <button
                        type="button"
                        onClick={handleTapAddToAnytime}
                        className="w-full py-3 px-4 rounded-xl font-sans text-sm font-medium text-stone-700 bg-stone-100 border border-stone-200 hover:bg-stone-200 focus:outline-none focus:ring-2 focus:ring-moss-500/40 transition-colors"
                      >
                        💧 Add to Anytime Today
                      </button>
                      <button
                        type="button"
                        onClick={() => setSeedBagTapTarget(null)}
                        className="w-full py-2.5 rounded-lg font-sans text-sm text-stone-500 hover:text-stone-700 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-400/40 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
        </div>
      </DndContext>
      ))}

      {/* Day Detail Modal (from week/month click) */}
      {inspectedDate && (
        <DayDetailModal
          dateStr={inspectedDate}
          dayAssignments={weekAssignments[inspectedDate] ?? {}}
          goals={safeGoals}
          calendarEvents={safeCalendarEvents}
          onClose={() => setInspectedDate(null)}
          onSwitchToDay={handleSwitchToInspectedDay}
          hours={hoursArray}
        />
      )}

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

      {/* Energy restored toast (Harvested / milestone complete) */}
      <AnimatePresence>
        {energyToast && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.25 }}
            className="fixed bottom-6 left-4 right-4 z-50 mx-auto max-w-sm rounded-xl border border-emerald-300 bg-emerald-500 px-4 py-3 shadow-lg font-sans text-sm font-medium text-white"
            role="status"
            aria-live="polite"
          >
            Great job! Energy restored.
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
                  const kz = safeGoalBank.filter((g) => g.type !== 'routine' && g.type !== 'vitality' && !g._projectGoal);
                  const rt = safeGoalBank.filter((g) => g.type === 'routine');
                  const pr = safeGoalBank.filter((g) => g._projectGoal);
                  const vt = safeGoalBank.filter((g) => g.type === 'vitality');
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
                        {s.items.map((goal) => {
                          const parentGoal = goal.linkedToGoalId ? goals?.find((g) => g.id === goal.linkedToGoalId) : null;
                          return (
                            <button
                              key={goal.id}
                              type="button"
                              onClick={() => handleSelectSeedForSlot(seedPickerTargetHour, goal)}
                              className={`w-full py-3 px-4 rounded-xl border ${s.border} ${s.bg} font-sans text-sm text-stone-800 hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-moss-500/40 text-left transition-colors`}
                            >
                              <span className={`text-[10px] font-bold uppercase tracking-wider ${s.badge} block mb-0.5`}>
                                {goal._projectGoal ? goal._projectName || 'Project' : goal.domain || goal.type || 'Kaizen'}
                              </span>
                              <span className="font-medium block">{goal.title}</span>
                              {parentGoal && (
                                <span className="text-xs text-stone-500 mt-0.5 block" title={`Supports: ${parentGoal.title}`}>
                                  Supports {parentGoal.title}
                                </span>
                              )}
                            </button>
                          );
                        })}
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

      {/* Project/vine picker: when dropping routine or kaizen goal with subtasks */}
      {pendingRoutineDrop && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-stone-900/50 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-label={pendingRoutineDrop.goal.type === 'kaizen' ? 'Choose vine' : 'Choose project'}
        >
          <div className="bg-stone-50 rounded-2xl border border-stone-200 shadow-xl max-w-sm w-full p-6">
            <h3 className="font-serif text-stone-900 text-lg mb-2">
              {pendingRoutineDrop.goal.type === 'kaizen'
                ? 'Which vine are we working on?'
                : 'Which project are we working on?'}
            </h3>
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
                {pendingRoutineDrop.goal.type === 'kaizen' ? 'No specific vine' : 'No project'}
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

      {/* Lightened load feedback: show which tasks were removed and why */}
      <AnimatePresence>
        {lightenedTasksFeedback.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-4 left-4 right-4 z-[55] md:left-auto md:right-4 md:max-w-md rounded-2xl border border-stone-200 bg-stone-50 shadow-xl p-6"
            role="status"
            aria-live="polite"
          >
            <h3 className="font-serif text-stone-900 text-lg mb-2">Load lightened</h3>
            <p className="font-sans text-sm text-stone-500 mb-4">These tasks were removed to fit your energy:</p>
            <ul className="space-y-2 mb-4 max-h-40 overflow-y-auto">
              {lightenedTasksFeedback.map((item, i) => (
                <li key={`${item.hour}-${item.title}-${i}`} className="py-2.5 px-4 rounded-xl border border-stone-200 bg-white font-sans text-sm text-stone-800">
                  <span className="font-medium text-stone-900">{item.hour}</span>
                  <span className="text-stone-700"> — {item.title}</span>
                  <p className="font-sans text-stone-500 text-xs mt-0.5">{item.reason}</p>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setLightenedTasksFeedback([])}
              className="w-full py-2.5 px-4 rounded-xl font-sans text-sm font-medium bg-moss-600 text-stone-50 hover:bg-moss-700 focus:outline-none focus:ring-2 focus:ring-moss-500/40"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <PrioritizeModal
        open={showPrioritize}
        onClose={() => {
          setShowPrioritize(false);
          setRecommendedTaskId(null);
          setRecommendedReason(null);
          setPrioritizeSuccess(false);
        }}
        priorities={priorities ?? {}}
        onSelectTask={handlePrioritizeSelectTask}
        todayTasks={todayTasks}
        recommendedTaskId={recommendedTaskId}
        recommendedReason={recommendedReason}
        onApplyPriority={todayTasks.length > 0 ? handleApplyPriority : undefined}
        prioritizeLoading={prioritizeLoading}
        prioritizeSuccess={prioritizeSuccess}
      />
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
export { MonthPlanView };
