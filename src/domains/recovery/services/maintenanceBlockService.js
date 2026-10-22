const DEFAULT_DURATION_MINUTES = 45;

export const MAINTENANCE_BLOCK_TEMPLATES = [
  { id: 'social_catchup', title: 'Social catch-up', category: 'Relationship maintenance', durationMinutes: 45, preferredDays: [2, 5], preferredTimeBand: 'evening', flexibility: 'flexible', importance: 'medium', protectionStrength: 'strong' },
  { id: 'message_reset', title: 'Message reset', category: 'Communication', durationMinutes: 30, preferredDays: [1, 3, 5], preferredTimeBand: 'late_afternoon', flexibility: 'flexible', importance: 'medium' },
  { id: 'weekly_planning_reset', title: 'Weekly planning reset', category: 'Planning', durationMinutes: 60, preferredDays: [0], preferredTimeBand: 'late_morning', flexibility: 'structured', importance: 'high', protectionStrength: 'normal' },
  { id: 'life_admin', title: 'Life admin block', category: 'Life admin', durationMinutes: 60, preferredDays: [2, 4], preferredTimeBand: 'early_afternoon', flexibility: 'flexible', importance: 'high' },
  { id: 'relationship_maintenance', title: 'Relationship maintenance', category: 'Relationship maintenance', durationMinutes: 45, preferredDays: [6], preferredTimeBand: 'evening', flexibility: 'flexible', importance: 'medium', protectionStrength: 'strong' },
  { id: 'errands_logistics', title: 'Errands / logistics check', category: 'Logistics', durationMinutes: 60, preferredDays: [6], preferredTimeBand: 'early_afternoon', flexibility: 'structured', importance: 'medium' },
  { id: 'inbox_cleanup', title: 'Inbox cleanup', category: 'Life admin', durationMinutes: 30, preferredDays: [1, 3, 5], preferredTimeBand: 'late_afternoon', flexibility: 'flexible', importance: 'medium' },
  { id: 'home_reset', title: 'Home reset', category: 'Home', durationMinutes: 45, preferredDays: [6], preferredTimeBand: 'late_afternoon', flexibility: 'structured', importance: 'medium', protectionStrength: 'normal' },
];

const TIME_BAND_START = {
  early_morning: '07:00',
  late_morning: '10:00',
  early_afternoon: '13:00',
  late_afternoon: '16:00',
  evening: '19:00',
};

function addMinutes(timeStr, minutesToAdd) {
  const [h, m] = String(timeStr || '09:00').split(':').map(Number);
  const total = (Math.max(0, Math.min(23, Number(h) || 9)) * 60) + (Math.max(0, Math.min(59, Number(m) || 0))) + minutesToAdd;
  const endTotal = Math.max(0, Math.min(23 * 60 + 59, total));
  const endH = Math.floor(endTotal / 60);
  const endM = endTotal % 60;
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}

export function createMaintenanceBlock(input = {}) {
  const template = MAINTENANCE_BLOCK_TEMPLATES.find((item) => item.id === input.templateId) ?? null;
  const preferredTimeBand = input.preferredTimeBand ?? template?.preferredTimeBand ?? 'early_afternoon';
  const durationMinutes = Math.max(15, Math.min(180, Number(input.durationMinutes ?? template?.durationMinutes ?? DEFAULT_DURATION_MINUTES) || DEFAULT_DURATION_MINUTES));
  return {
    id: input.id ?? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `mb-${Date.now()}`),
    templateId: template?.id ?? input.templateId ?? null,
    title: String(input.title ?? template?.title ?? 'Maintenance block').trim(),
    category: String(input.category ?? template?.category ?? 'Life admin').trim(),
    durationMinutes,
    preferredDays: Array.isArray(input.preferredDays ?? template?.preferredDays)
      ? (input.preferredDays ?? template.preferredDays).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
      : [1],
    preferredTimeBand,
    flexibility: input.flexibility === 'structured' ? 'structured' : 'flexible',
    importance: input.importance === 'high' || input.importance === 'low' ? input.importance : 'medium',
    protectionStrength: ['soft', 'normal', 'strong'].includes(input.protectionStrength ?? template?.protectionStrength)
      ? (input.protectionStrength ?? template?.protectionStrength)
      : 'normal',
    active: input.active !== false,
  };
}

export function createGoalFromMaintenanceBlock(block) {
  const normalized = createMaintenanceBlock(block ?? {});
  const start = TIME_BAND_START[normalized.preferredTimeBand] ?? '13:00';
  const end = addMinutes(start, normalized.durationMinutes);
  return {
    id: `maintenance-${normalized.id}`,
    title: normalized.title,
    type: 'routine',
    category: '🧰 Maintenance',
    estimatedMinutes: normalized.durationMinutes,
    scheduleCategory: 'work',
    energyType: normalized.importance === 'high' ? 'maintenance' : 'restorative',
    _maintenanceBlockId: normalized.id,
    _maintenanceMeta: {
      category: normalized.category,
      preferredTimeBand: normalized.preferredTimeBand,
      flexibility: normalized.flexibility,
      importance: normalized.importance,
      protectionStrength: normalized.protectionStrength,
    },
    _protectedTimeCategory: normalized.category?.toLowerCase().includes('relationship')
      ? 'relationships'
      : normalized.category?.toLowerCase().includes('home')
        ? 'decompression'
        : normalized.category?.toLowerCase().includes('planning')
          ? 'transition'
          : 'rest',
    _protectedTimeStrength: normalized.protectionStrength ?? 'normal',
    schedulerSettings: normalized.flexibility === 'structured'
      ? { mode: 'solid', days: normalized.preferredDays, start, end }
      : { mode: 'liquid', preference: normalized.preferredTimeBand.includes('morning') ? 'morning' : 'afternoon', weeklyTarget: Math.max(1, Math.round((normalized.durationMinutes * Math.max(1, normalized.preferredDays.length)) / 60)) },
    subtasks: [
      {
        id: `st-maintenance-${normalized.id}`,
        title: normalized.title,
        estimatedHours: Math.max(0.25, normalized.durationMinutes / 60),
        completedHours: 0,
        deadline: null,
      },
    ],
  };
}

export function suggestMaintenanceTemplates({ compost = [], logs = [], maintenanceBlocks = [] } = {}) {
  const existingTemplateIds = new Set((maintenanceBlocks ?? []).map((item) => item?.templateId).filter(Boolean));
  const textBlob = (compost ?? []).slice(0, 24).map((item) => String(item?.text ?? '')).join(' ').toLowerCase();
  const logBlob = (logs ?? []).slice(-40).map((item) => String(item?.taskTitle ?? '')).join(' ').toLowerCase();
  const corpus = `${textBlob} ${logBlob}`;
  const suggestions = [];
  const push = (templateId, reason) => {
    if (existingTemplateIds.has(templateId)) return;
    if (suggestions.some((entry) => entry.templateId === templateId)) return;
    const template = MAINTENANCE_BLOCK_TEMPLATES.find((item) => item.id === templateId);
    if (!template) return;
    suggestions.push({ templateId, template, reason });
  };
  if (/\b(inbox|email|message|reply|follow up|slack)\b/.test(corpus)) push('message_reset', 'Messages keep resurfacing. A reset block can protect your focus.');
  if (/\b(plan|planning|week|weekly|reset)\b/.test(corpus)) push('weekly_planning_reset', 'A weekly planning reset helps prevent floating obligations.');
  if (/\b(bill|admin|logistics|dentist|groceries|errands|renew)\b/.test(corpus)) push('life_admin', 'Life admin tasks are recurring. A block can make them easier to contain.');
  if (/\b(friend|family|relationship|call|catch up)\b/.test(corpus)) push('social_catchup', 'A social catch-up block supports relationships without pressure.');
  if ((compost?.length ?? 0) >= 8) push('inbox_cleanup', 'Your capture inbox is filling up. A light cleanup block could help.');
  return suggestions.slice(0, 2);
}
