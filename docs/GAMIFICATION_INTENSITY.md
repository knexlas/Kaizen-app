# Gamification intensity

User-facing preference with three levels: **minimal**, **balanced**, **playful**. Core functionality (planning, tasks, focus) is unchanged; planning screens stay clear and professional in all modes.

- **Storage**: `userSettings.gamificationIntensity`. Omitted or empty = balanced.
- **Where to change**: Settings → Personalization → Gamification intensity.

---

## UI behaviors by level

### Minimal

| Area | Behavior |
|------|----------|
| **Decorative visuals** | Season particles (snow, petals, fireflies, leaves) hidden. |
| **Celebration** | No confetti on harvest (TimeSlicer). Reward toasts use shorter duration (1.8s). |
| **Helper / spirit frequency** | Only critical interventions: overloaded, no_next_step, overdue_unscheduled, focus_abandoned, missed_day_recovery. No support_suggestion, habit_stack_handoff, next_step, neglected_project_revival. |
| **Spirit presence** | Smaller avatar (w-8 h-8). No auto-open spirit dialogue on load. Chat button title: "Chat" (not "Talk to Mochi"). |
| **Metaphor wording** | Plain labels: "Briefing" instead of "Mochi left a note"; reward/chat not framed as companion. |
| **Garden / world visibility** | Garden tab comment banner (Mochi note on Garden tab) hidden. |

### Balanced (default)

| Area | Behavior |
|------|----------|
| **Decorative visuals** | Season particles shown (when not low-stim). |
| **Celebration** | Confetti on harvest. Reward toasts 2.8s. |
| **Helper / spirit frequency** | All intervention types allowed (normal cooldowns). |
| **Spirit presence** | Standard avatar (w-10 h-10). Spirit dialogue auto-opens once on load. "Talk to Mochi". |
| **Metaphor wording** | "Mochi left a note", companion framing. |
| **Garden / world visibility** | Garden comment banner shown when present. |

### Playful

| Area | Behavior |
|------|----------|
| **Decorative visuals** | Same as balanced (particles shown). |
| **Celebration** | Confetti on harvest. Reward toasts 3.5s. |
| **Helper / spirit frequency** | Same as balanced. |
| **Spirit presence** | Same as balanced (standard avatar, auto-open dialogue). |
| **Metaphor wording** | Same as balanced. |
| **Garden / world visibility** | Same as balanced. |

*(Playful currently shares most behavior with balanced; reward duration is longer. Future: richer celebration, more visible companion, stronger garden presence.)*

---

## Components that read this setting

| Component / file | What it reads | How it uses it |
|------------------|---------------|----------------|
| **App.jsx** | `getGamificationConfig(userSettings).showParticles` | Renders `SeasonParticles` only when `showParticles` is true. |
| **RewardOverlay.jsx** | `getGamificationConfig(userSettings).rewardDurationMs` | Toast display duration (minimal 1800, balanced 2800, playful 3500). |
| **TimeSlicer.jsx** | `getGamificationIntensity(userSettings)` | Sets `disableConfetti` when intensity is minimal (no confetti on harvest). |
| **GardenDashboard.jsx** | `getGamificationIntensity`, `getGamificationConfig`, `shouldShowHelperForIntensity` | 1) Adds helper interventions only when `shouldShowHelperForIntensity(type, intensity)` is true. 2) Auto-shows spirit dialogue only when `gamificationConfig.autoShowSpiritDialogue` is true. 3) Spirit button size and title from `spiritPresence` and `metaphorWording`. 4) "Mochi left a note" vs "Briefing" from `metaphorWording`. 5) Garden tab comment banner visibility from `gardenWorldVisibility` and `metaphorWording`. |
| **SettingsView.jsx** | `userSettings.gamificationIntensity`, `getGamificationIntensity`, `GAMIFICATION_INTENSITY_OPTIONS` | Dropdown to view/set level; saves via `updateUserSettings({ gamificationIntensity })`. |

**Constants / services**

- **gamificationIntensity.js** – Defines levels, `getGamificationIntensity(userSettings)`, `getGamificationConfig(userSettings)`, `shouldShowHelperForIntensity(type, intensity)`. No direct DOM; consumed by the components above.

---

## Summary

- **minimal**: Plain productivity UI, subtle progress feedback, reduced helper chatter, minimal decorative animation (no particles, no confetti, short toasts, only critical helpers, smaller spirit avatar, no auto-dialogue, plain wording, no garden comment banner).
- **balanced**: Current default; calm motivational elements (particles, confetti, all helpers, standard spirit, auto-dialogue, metaphor wording, garden banner).
- **playful**: Same as balanced with longer reward toasts (3.5s); room to add stronger garden presence and richer celebration later.
