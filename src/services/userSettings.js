const SETTINGS_KEY = 'kaizen_settings';

const DEFAULTS = {
  gentleMode: true,
  textSize: 'md',
  highContrast: false,
  motionPref: 'auto',
  sounds: false,
  lowStim: true,
};

/**
 * Read user settings from localStorage.
 * @returns {{ gentleMode: boolean, textSize: string, highContrast: boolean, motionPref: string, sounds: boolean, lowStim: boolean }}
 */
export function getSettings() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(SETTINGS_KEY) : null;
    if (!raw) return { ...DEFAULTS };
    const data = JSON.parse(raw);
    return {
      ...DEFAULTS,
      ...data,
      gentleMode: data.gentleMode !== false,
      textSize: ['sm', 'md', 'lg'].includes(data.textSize) ? data.textSize : DEFAULTS.textSize,
      highContrast: !!data.highContrast,
      motionPref: ['auto', 'reduce', 'full'].includes(data.motionPref) ? data.motionPref : DEFAULTS.motionPref,
      sounds: !!data.sounds,
      lowStim: data.lowStim !== false,
    };
  } catch (_) {
    return { ...DEFAULTS };
  }
}

/**
 * Write user settings to localStorage. Notify listeners so App can re-apply classes.
 * @param {Partial<typeof DEFAULTS>} settings
 */
export function setSettings(settings) {
  try {
    const prev = getSettings();
    const next = { ...prev, ...settings };
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent('accessibility-settings-changed'));
    }
    return next;
  } catch (_) {}
}
