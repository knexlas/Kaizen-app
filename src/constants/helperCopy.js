/**
 * Helper copy by tone (getHelperTone): business | professional | calm | default.
 * Used in empty states, recovery prompts, and supportive lines.
 */

const COPY = {
  empty_need_energy_title: {
    business: 'Set your capacity',
    professional: "How's your energy today?",
    calm: "Let's start gently. How's your energy?",
    default: "Let's start gently. How's your energy today?",
  },
  empty_need_energy_cta: {
    business: 'Set capacity',
    professional: "Set today's energy",
    calm: "Set today's energy",
    default: "Set today's energy",
  },
  empty_next_step_title: {
    business: 'Next action',
    professional: 'Next step',
    calm: 'Next step',
    default: 'Next step',
  },
  empty_next_step_subtitle: {
    business: 'Pick one small step and begin.',
    professional: 'Pick one 5-minute step and start.',
    calm: 'Pick one small step and start when you are ready.',
    default: 'Pick one 5-minute step and start.',
  },
  recovery_heading: {
    business: 'Capacity',
    professional: 'Recovery',
    calm: 'Take it lighter',
    default: 'Recovery',
  },
  recovery_body: {
    business: 'Plan exceeds capacity. Move or reduce a few items.',
    professional: 'Today looks full. Move or reduce a few items.',
    calm: 'Today looks full. Lighten it a little if you need to.',
    default: 'Today looks full. Move or reduce a few items.',
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
