import {
  generateWeeklyPlan as generateWeeklyPlanFromGemini,
  generateMonthlyPlan as generateMonthlyPlanFromGemini,
  generateMonthlyPlanTasks as generateMonthlyPlanTasksFromGemini,
  rebalanceMonthQuota as rebalanceMonthQuotaFromGemini,
} from '../../../services/geminiService';

export async function generateWeeklyPlan(goals, calendarEvents = [], energyProfile = {}, options = {}) {
  return generateWeeklyPlanFromGemini(goals, calendarEvents, energyProfile, options);
}

export async function generateMonthlyPlan(goals, monthIndex, year, options = {}) {
  return generateMonthlyPlanFromGemini(goals, monthIndex, year, options);
}

export async function generateMonthlyPlanTasks(goals, monthIndex, year, options = {}) {
  return generateMonthlyPlanTasksFromGemini(goals, monthIndex, year, options);
}

export async function rebalanceMonthQuota(remainingHours, availableDates = [], userEvents = [], options = {}) {
  return rebalanceMonthQuotaFromGemini(remainingHours, availableDates, userEvents, options);
}
