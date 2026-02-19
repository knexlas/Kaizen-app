/**
 * Starter suggestions for guided empty states (ADHD-friendly, 1-tap).
 * Each is 1 spoon / 5 minutes.
 */

const SUGGESTION_TYPES = {
  lifeAdmin: {
    title: 'One tiny life-admin thing',
    spoonCost: 1,
    estimatedMinutes: 5,
    category: 'life-admin',
    key: 'life-admin',
  },
  personal: {
    title: 'One personal goal step',
    spoonCost: 1,
    estimatedMinutes: 5,
    category: 'personal',
    key: 'personal',
  },
  care: {
    title: 'One care task',
    spoonCost: 1,
    estimatedMinutes: 5,
    category: 'care',
    key: 'care',
  },
};

/** type: 'life-admin' | 'personal' | 'care' */
export function buildStarterSuggestion(type) {
  const key = type === 'life-admin' ? 'lifeAdmin' : type === 'personal' ? 'personal' : 'care';
  return { ...SUGGESTION_TYPES[key] };
}

/** All three starter suggestions for the no-tasks empty state. */
export function getStarterSuggestions() {
  return [
    buildStarterSuggestion('life-admin'),
    buildStarterSuggestion('personal'),
    buildStarterSuggestion('care'),
  ];
}
