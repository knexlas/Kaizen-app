import { useState, useEffect } from 'react';
import { useGarden } from '../../context/GardenContext';

/** Daily habit insight — one-liner about recent patterns. Generated locally from log data. */
export default function HabitInsight({ className = '' }) {
  const { logs = [], goals = [], streakDays = 0 } = useGarden();
  const [insight, setInsight] = useState(null);

  useEffect(() => {
    if (!logs.length && !goals.length) return;

    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const goalSessions = {};
    let totalSessions = 0;
    let totalMinutes = 0;

    logs.forEach((log) => {
      const logDate = log.date ? new Date(log.date) : null;
      if (!logDate || logDate < weekAgo) return;
      totalSessions++;
      totalMinutes += Number(log.minutes) || 0;
      const taskId = log.taskId;
      if (taskId) {
        goalSessions[taskId] = (goalSessions[taskId] || 0) + 1;
      }
    });

    const goalEntries = Object.entries(goalSessions);
    let message = null;

    if (totalSessions === 0) {
      message = {
        icon: '🌿',
        text: 'No sessions this week yet. Even 5 minutes counts — start small.',
        tone: 'gentle',
      };
    } else if (streakDays >= 7) {
      message = {
        icon: '🔥',
        text: `${streakDays}-day streak! You're building real momentum. Keep tending.`,
        tone: 'celebration',
      };
    } else if (streakDays >= 3) {
      message = {
        icon: '✨',
        text: `${streakDays} days in a row — your rhythm is taking root.`,
        tone: 'warm',
      };
    } else if (goalEntries.length > 0) {
      const sorted = goalEntries.sort((a, b) => b[1] - a[1]);
      const topGoalId = sorted[0][0];
      const topGoal = goals.find((g) => g.id === topGoalId);
      const neglected = goals.filter(
        (g) => g.type !== 'routine' && !goalSessions[g.id] && g.id !== topGoalId
      );

      if (topGoal && neglected.length > 0) {
        message = {
          icon: '🎯',
          text: `Strong focus on "${topGoal.title?.slice(0, 20)}". "${neglected[0].title?.slice(0, 20)}" could use some love.`,
          tone: 'balanced',
        };
      } else if (topGoal) {
        message = {
          icon: '🌱',
          text: `${totalSessions} sessions this week, ${totalMinutes} min total. "${topGoal.title?.slice(0, 20)}" is growing well.`,
          tone: 'warm',
        };
      }
    }

    if (!message) {
      message = {
        icon: '🍃',
        text: `${totalSessions} session${totalSessions !== 1 ? 's' : ''} this week. Every bit of tending counts.`,
        tone: 'gentle',
      };
    }

    setInsight(message);
  }, [logs, goals, streakDays]);

  if (!insight) return null;

  const toneColors = {
    gentle: 'bg-stone-50/80 border-stone-200 dark:bg-slate-800/50 dark:border-slate-600/40',
    warm: 'bg-amber-50/60 border-amber-200/60 dark:bg-amber-900/20 dark:border-amber-700/40',
    celebration: 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200/60 dark:from-amber-900/20 dark:to-yellow-900/20 dark:border-amber-700/40',
    balanced: 'bg-indigo-50/50 border-indigo-200/60 dark:bg-indigo-900/20 dark:border-indigo-700/40',
  };

  return (
    <div className={`rounded-xl border px-3 py-2.5 ${toneColors[insight.tone] || toneColors.gentle} ${className}`}>
      <div className="flex items-start gap-2">
        <span className="text-base shrink-0 mt-0.5" aria-hidden>{insight.icon}</span>
        <p className="font-sans text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
          {insight.text}
        </p>
      </div>
    </div>
  );
}
