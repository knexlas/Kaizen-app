/**
 * Helper copy by tone (getHelperTone): business | professional | calm | default.
 * Used in empty states, recovery prompts, and supportive lines. Keeps impact high, surface area small.
 */

const COPY = {
  empty_need_energy_title: {
    business: "Set your capacity",
    professional: "How's your energy today?",
    calm: "Let's start gently. How's your energy?",
    default: "Let's start gently. How's your energy today?",
  },
  empty_need_energy_cta: {
    business: "Set capacity",
    professional: "Set today's spoons",
    calm: "Set today's spoons",
    default: "Set today's spoons",
  },
  empty_next_step_title: {
    business: "Next action",
    professional: "Next step",
    calm: "Next step",
    default: "Next step",
  },
  empty_next_step_subtitle: {
    business: "5 min, one slot. Pick one and start.",
    professional: "Start tiny — 5 minutes, 1 spoon. Tap one to add and start focus.",
    calm: "Start small — 5 minutes, 1 spoon. Add one when you're ready.",
    default: "Start tiny — 5 minutes, 1 spoon. Tap one to add and start focus.",
  },
  recovery_heading: {
    business: "Capacity",
    professional: "Recovery",
    calm: "Take it lighter",
    default: "Recovery",
  },
  recovery_body: {
    business: "Plan exceeds capacity. Lighten or move items.",
    professional: "Today looks full. Lighten your plan or move items.",
    calm: "Your day looks full. Lighten it when you're ready—no rush.",
    default: "Today looks full. Lighten your plan or move items.",
  },
};

const VALID_TONES = ['business', 'professional', 'calm', 'default'];

/**
 * @param {string} slot - Key in COPY (e.g. empty_need_energy_title, recovery_body)
 * @param {string} tone - business | professional | calm | default
 * @returns {string}
 */
export function getCopyForTone(slot, tone) {
  const t = VALID_TONES.includes(tone) ? tone : 'default';
  const slotCopy = COPY[slot];
  if (!slotCopy) return '';
  return slotCopy[t] ?? slotCopy.default ?? '';
}
