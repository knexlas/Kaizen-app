/** dayIndex: JS getDay() convention (0=Sun..6=Sat). Goals store ritual.days in this convention. */
export function getRitualForToday(goal, dayIndex) {
  return goal?.rituals?.find((ritual) => Array.isArray(ritual.days) && ritual.days.includes(dayIndex));
}
