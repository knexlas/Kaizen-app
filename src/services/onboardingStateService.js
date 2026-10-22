const ONBOARDING_COMPLETE_KEY = 'kaizen_onboarding_complete';
const TOUR_SEEN_KEY = 'hasSeenTour';
const TRIGGER_TOUR_KEY = 'triggerTour';

export function getOnboardingCompleted() {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(ONBOARDING_COMPLETE_KEY) === 'true';
  } catch (_) {
    return false;
  }
}

export function setOnboardingCompleted(value = true) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(ONBOARDING_COMPLETE_KEY, value ? 'true' : 'false');
  } catch (_) {
    // Ignore storage write failures; onboarding can still proceed in-session.
  }
}

export function getTourSeen() {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(TOUR_SEEN_KEY) === 'true';
  } catch (_) {
    return false;
  }
}

export function setTourSeen(value = true) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(TOUR_SEEN_KEY, value ? 'true' : 'false');
  } catch (_) {
    // Ignore storage write failures; the tour state will reset next session.
  }
}

// Legacy flag kept for backward compatibility with existing users.
export function consumeTriggerTourFlag() {
  if (typeof localStorage === 'undefined') return false;
  try {
    if (localStorage.getItem(TRIGGER_TOUR_KEY) === 'true') {
      localStorage.removeItem(TRIGGER_TOUR_KEY);
      return true;
    }
  } catch (_) {
    // Ignore storage failures and treat the legacy tour flag as absent.
  }
  return false;
}
