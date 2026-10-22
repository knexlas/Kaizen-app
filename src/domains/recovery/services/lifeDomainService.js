import { MAINTENANCE_BLOCK_TEMPLATES } from './maintenanceBlockService';

export const LIFE_DOMAIN_TEMPLATES = [
  { id: 'social_life', title: 'Friends / social life', maintenanceTemplateIds: ['social_catchup', 'message_reset'], defaultFollowUpBucket: 'social_followups', suggestedRoutineTitles: ['Reach out to one person', 'Check messages calmly'] },
  { id: 'family', title: 'Family', maintenanceTemplateIds: ['relationship_maintenance'], defaultFollowUpBucket: 'social_followups', suggestedRoutineTitles: ['Family check-in'] },
  { id: 'home_upkeep', title: 'Home upkeep', maintenanceTemplateIds: ['home_reset'], defaultFollowUpBucket: 'none', suggestedRoutineTitles: ['10-minute reset'] },
  { id: 'life_admin', title: 'Life admin', maintenanceTemplateIds: ['life_admin', 'inbox_cleanup'], defaultFollowUpBucket: 'admin_followups', suggestedRoutineTitles: ['Paperwork triage'] },
  { id: 'health_admin', title: 'Health admin', maintenanceTemplateIds: ['life_admin'], defaultFollowUpBucket: 'admin_followups', suggestedRoutineTitles: ['Book appointments check'] },
  { id: 'finances', title: 'Finances', maintenanceTemplateIds: ['life_admin'], defaultFollowUpBucket: 'admin_followups', suggestedRoutineTitles: ['Money admin check'] },
  { id: 'logistics', title: 'Errands / logistics', maintenanceTemplateIds: ['errands_logistics'], defaultFollowUpBucket: 'admin_followups', suggestedRoutineTitles: ['Errands prep'] },
  { id: 'partner', title: 'Partner connection', maintenanceTemplateIds: ['relationship_maintenance'], defaultFollowUpBucket: 'social_followups', suggestedRoutineTitles: ['Partner check-in'] },
  { id: 'pets', title: 'Pets', maintenanceTemplateIds: ['home_reset'], defaultFollowUpBucket: 'none', suggestedRoutineTitles: ['Pet care prep'] },
];

function slug(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

export function inferLifeDomainTemplate(text = '') {
  const lower = String(text || '').toLowerCase();
  if (/\bfriends|social|reply|follow up|reach out\b/.test(lower)) return 'social_life';
  if (/\bfamily\b/.test(lower)) return 'family';
  if (/\bhome|house|clean|chaos|upkeep\b/.test(lower)) return 'home_upkeep';
  if (/\badmin|paperwork|forms|documents\b/.test(lower)) return 'life_admin';
  if (/\bhealth|doctor|appointment|medical\b/.test(lower)) return 'health_admin';
  if (/\bfinance|money|budget|bill\b/.test(lower)) return 'finances';
  if (/\berrands|logistics|pickup|drop off\b/.test(lower)) return 'logistics';
  if (/\bpartner|relationship\b/.test(lower)) return 'partner';
  if (/\bpet|dog|cat\b/.test(lower)) return 'pets';
  return null;
}

export function createLifeDomain(input = {}) {
  const templateId = input.templateId ?? inferLifeDomainTemplate(input.title ?? input.intent ?? '');
  const template = LIFE_DOMAIN_TEMPLATES.find((item) => item.id === templateId) ?? null;
  const title = String(input.title || template?.title || 'Life domain').trim();
  return {
    id: input.id ?? (crypto.randomUUID?.() ?? `ld-${Date.now()}`),
    templateId: template?.id ?? null,
    title,
    intent: String(input.intent || '').trim(),
    supportGoal: String(input.supportGoal || '').trim(),
    active: input.active !== false,
    createdAt: input.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function buildDomainSupportPlan(domain) {
  const template = LIFE_DOMAIN_TEMPLATES.find((item) => item.id === domain?.templateId) ?? null;
  const maintenanceTemplateIds = template?.maintenanceTemplateIds ?? [];
  const maintenanceTemplates = maintenanceTemplateIds
    .map((id) => MAINTENANCE_BLOCK_TEMPLATES.find((item) => item.id === id))
    .filter(Boolean);
  return {
    maintenanceTemplates,
    followUpBucket: template?.defaultFollowUpBucket ?? 'none',
    suggestedRoutines: template?.suggestedRoutineTitles ?? [],
  };
}

export function computeLifeDomainHealth(domain, { maintenanceBlocks = [], socialFollowUps = [] } = {}) {
  const plan = buildDomainSupportPlan(domain);
  const hasBlock = plan.maintenanceTemplates.some((template) => (maintenanceBlocks ?? []).some((block) => block?.templateId === template.id));
  const socialPending = (socialFollowUps ?? []).filter((item) => item?.status !== 'done').length;
  if (!hasBlock) return { label: 'Needs structure', tone: 'stone' };
  if (plan.followUpBucket === 'social_followups' && socialPending > 8) return { label: 'Backlog building', tone: 'amber' };
  return { label: 'Supported', tone: 'moss' };
}

export function buildLifeDomainFromIntent(intentText = '') {
  const templateId = inferLifeDomainTemplate(intentText);
  const template = LIFE_DOMAIN_TEMPLATES.find((item) => item.id === templateId) ?? null;
  const title = template?.title || `Life domain: ${slug(intentText).replace(/_/g, ' ') || 'support'}`;
  return createLifeDomain({
    templateId: template?.id ?? null,
    title,
    intent: intentText,
    supportGoal: intentText,
  });
}

