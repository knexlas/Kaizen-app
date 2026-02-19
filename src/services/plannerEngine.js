export const ENERGY_ZONES = {
  HIGH: { start: 9, end: 12, label: 'Deep Work 🧠' },
  MEDIUM: { start: 13, end: 17, label: 'Action Mode ⚡' },
  LOW: { start: 17, end: 21, label: 'Gentle Admin 🍵' },
};

/**
 * Generates milestones working backward from a hard deadline (e.g., Marathon).
 * @param {string} goalTitle
 * @param {string} endDateStr - "2024-05-01"
 */
export function generateBackwardsPlan(goalTitle, endDateStr) {
  const end = new Date(endDateStr);
  const now = new Date();
  const weeks = Math.floor((end - now) / (1000 * 60 * 60 * 24 * 7));

  const milestones = [];

  // Simple heuristic: Break into 4 phases
  for (let i = 1; i <= 4; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() + (weeks / 4) * i * 7);
    milestones.push({
      title: `${goalTitle} - Phase ${i}`,
      deadline: date.toISOString().split('T')[0],
      completed: false,
    });
  }
  return milestones;
}

/**
 * Re-shuffles the schedule when a task is missed.
 * Moves the missed task to the next available slot based on priority.
 */
export function recalibrateSchedule(missedTask, currentSchedule) {
  const newSchedule = { ...currentSchedule };

  // Find next empty slot
  // (Placeholder logic: in a real app, this would check calendar events)
  console.log('Recalibrating for missed task:', missedTask.title);

  return newSchedule;
}

/**
 * Auto-assigns tasks to hours based on Energy Level.
 */
export function optimizeDailySchedule(tasks, energyLevel = 'medium') {
  // 1. Sort tasks: Deep work first
  const deepTasks = tasks.filter((t) => t.estimatedMinutes >= 45);
  const quickTasks = tasks.filter((t) => t.estimatedMinutes < 45);

  const schedule = {};

  // 2. Assign High Energy tasks to Morning (9-12)
  if (energyLevel === 'high' || energyLevel === 'medium') {
    deepTasks.forEach((t, i) => {
      const hour = 9 + i;
      if (hour < 12) schedule[`${hour}:00`] = t;
    });
  }

  // 3. Assign remaining to afternoon
  quickTasks.forEach((t, i) => {
    const hour = 13 + i;
    if (hour < 17) schedule[`${hour}:00`] = t;
  });

  return schedule;
}
