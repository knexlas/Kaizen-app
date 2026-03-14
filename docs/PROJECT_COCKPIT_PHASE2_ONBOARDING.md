# Phase 2: Role-Based Onboarding and Personalization

Goal: Make the app feel immediately relevant for different user types (freelancer, employee, habit-focused, mixed) without splitting the product into separate apps or duplicated flows. Use onboarding to set **smart defaults, not hard restrictions**.

---

## 1. Files changed

| File | Changes |
|------|--------|
| **src/constants/onboardingPreferences.js** | Added `ONBOARDING_STYLE_OPTIONS` (Minimal, Balanced, Playful) for style preference; use-case label "Freelance/client work" (spec-aligned). |
| **src/components/Onboarding/PreferenceOnboarding.jsx** | Step 3: added "How do you like your app to feel?" with Minimal / Balanced / Playful; state `stylePreference` (default `balanced`); on finish, save `gamificationIntensity` from style choice and `onboardingPreferencesCompleted: true`. |
| **src/constants/plannerPresets.js** | Preset derivation: `useCase === 'personal'`, `role === 'student'`, `role === 'other'` → MIXED. Added `helperTone` per preset (business / professional / calm / default). Exported `getHelperTone(userSettings)` for future helper/empty-state copy. |
| **src/constants/dashboardProfile.js** | No code change; already defines section order and primary heading per profile. |
| **src/constants/gamificationIntensity.js** | No code change; already used for minimal/balanced/playful behavior. |
| **src/components/Dashboard/SettingsView.jsx** | No code change; already has App profile (use case, role, priorities, planner preset, app tone) and Save profile. |
| **src/App.jsx** | No code change; already shows PreferenceOnboarding when `!preferencesCompleted`, then FirstRunFlow when `!hasOnboarded`. |

### Phase 2 finalization (personalization felt)

| File | Changes |
|------|--------|
| **src/constants/dashboardProfile.js** | `PRIORITY_TO_SECTIONS`, `getDashboardSectionOrderWithPriorities(profile, priorities)`, `getEmphasizedSectionIds(priorities)`. |
| **src/constants/helperCopy.js** | New: `getCopyForTone(slot, tone)` for empty-state and recovery copy by tone. |
| **src/constants/plannerPresets.js** | `getPersonaWelcomeLine(presetId)` for first-run persona line. |
| **src/components/Dashboard/GardenDashboard.jsx** | Uses `getDashboardSectionOrderWithPriorities` and `helperTone`; passes `helperTone` to GuidedEmptyState; recovery section uses helper copy. |
| **src/components/EmptyStates/GuidedEmptyState.jsx** | `helperTone` prop; uses `getCopyForTone` for needEnergy and noTasks. |
| **src/components/Onboarding/FirstRunFlow.jsx** | Persona welcome line under "Welcome to the garden" from `getPersonaWelcomeLine(getPlannerPreset(userSettings))`. |

---

## 2. Preference / profile structure added

Stored in **userSettings** (persisted with garden data):

| Key | Description |
|-----|-------------|
| **onboardingUseCase** | Step 1: `work_projects` \| `freelance` \| `personal` \| `habits` \| `mix` |
| **onboardingRole** | Step 2: `employee` \| `freelancer` \| `student` \| `creative` \| `other` |
| **onboardingPriorities** | Step 3: array of up to 3 of `plan_week`, `break_projects`, `stay_focused`, `build_habits`, `calendar_deadlines`, `recover` |
| **gamificationIntensity** | Step 3 style: `minimal` \| `balanced` \| `playful` (drives helper frequency, spirit presence, celebrations) |
| **onboardingPreferencesCompleted** | `true` when user completes the 3-step onboarding |
| **plannerPreset** | Optional override: `employee` \| `freelancer` \| `habit_focused` \| `mixed`; if empty, derived from use case + role |

**Derivation (getPlannerPreset):**

- Explicit `plannerPreset` wins.
- Else: `freelancer` or `freelance` → FREELANCER; `employee` or `work_projects` → EMPLOYEE; `habits` → HABIT_FOCUSED; `creative` / `mix` / `personal` / `student` / `other` → MIXED.

---

## 3. Dashboard changes by persona

Single dashboard component; **section order and visibility** come from `dashboardProfile` (= planner preset).

| Persona | Primary emphasis (section order) |
|---------|----------------------------------|
| **Freelancer** | What to work on today → Active projects strip → Week capacity → Billable strip → Needs attention → Briefing → Your day |
| **Employee** | Today's priorities → Calendar & deadlines → Blocked work → Deep work suggestion → Weekly plan link → Briefing → Your day |
| **Habit-focused** | (check_in_prompt hidden) → Routines today → Focus suggestion → Recovery → Projects if relevant → Briefing → Your day |
| **Mixed** | What to do now → Projects strip → Week capacity → Routines today → Needs attention → Briefing → Your day |

Primary heading per profile: Freelancer = "What to work on today"; Employee = "Today's priorities"; Habit = "Focus suggestion"; Mixed = "What to do now".

---

## 4. Planner changes by persona

Planner preset drives **project planner (cockpit)** and **planner tab** via existing `getProjectPlannerPresetConfig` and `getPlannerTabPresetConfig`.

| Persona | Cockpit | Planner tab |
|---------|---------|-------------|
| **Freelancer** | Today strip emphasized; portfolio summary + hours; client, billable, waiting-on-client in cards; needs attention; week capacity; "Plan a project" in GoalCreator. | Week view; secondary sections shown; projects expanded. |
| **Employee** | Today strip emphasized; portfolio + hours; no client/billable in cards; blocked reason in cards; needs attention; week capacity; default filter This week. | Week view; routines not expanded by default. |
| **Habit-focused** | Minimal cockpit by default (compact summary: active count, at risk, planned this week, one suggestion + "See all projects"); full cockpit still available. | Day view; secondary sections hidden; routines expanded. "Plan a project" hidden in GoalCreator. |
| **Mixed** | Full cockpit; all card fields and sections. | Week view; projects and routines expanded. |

---

## 5. Helper / gamification changes by persona

- **Gamification intensity** (from style preference): `minimal` = reduced particles, reduced helper chatter, minimal spirit, no auto spirit dialogue; `balanced` = current default; `playful` = richer celebrations, prominent garden. Implemented in `gamificationIntensity.js` and consumed by RewardOverlay, Spirit, particles, etc.
- **Helper tone** (from preset): `helperTone` added to each preset — `business` (freelancer), `professional` (employee), `calm` (habit-focused), `default` (mixed). Exported `getHelperTone(userSettings)` for use in empty states, spirit copy, or labels; no UI change in this pass beyond the API.

---

## 6. Phase 2 finalization (personalization felt)

### 6.1 Onboarding priorities operational

- **dashboardProfile.js**: `PRIORITY_TO_SECTIONS` maps each priority to dashboard section ids. `getDashboardSectionOrderWithPriorities(profile, priorities)` reorders the profile’s section list so sections matching the user’s priorities appear earlier. `getEmphasizedSectionIds(priorities)` returns section ids that match any priority (for optional visual emphasis).
- **GardenDashboard**: Uses `getDashboardSectionOrderWithPriorities(dashboardProfile, userSettings?.onboardingPriorities ?? [])` instead of `getDashboardSectionOrder(dashboardProfile)`. Changing priorities in Settings updates order on next load/view.

### 6.2 Helper tone applied in visible copy

- **helperCopy.js**: New module with `getCopyForTone(slot, tone)` for slots: `empty_need_energy_title`, `empty_need_energy_cta`, `empty_next_step_title`, `empty_next_step_subtitle`, `recovery_heading`, `recovery_body`. Tones: business (concise, work-oriented), professional (direct, calm), calm (gentle, low-pressure), default (balanced).
- **GuidedEmptyState**: Accepts `helperTone`; uses helper copy for variants `needEnergy` and `noTasks`.
- **GardenDashboard**: Passes `helperTone={getHelperTone(userSettings)}` to GuidedEmptyState; recovery section uses `getCopyForTone('recovery_heading', helperTone)` and `getCopyForTone('recovery_body', helperTone)`.

### 6.3 Persona-based first-run confirmation

- **plannerPresets.js**: `getPersonaWelcomeLine(presetId)` returns one short line per preset (freelancer, employee, habit_focused, mixed).
- **FirstRunFlow**: Reads `userSettings`, derives `preset` and `personaLine`, and shows the persona line under “Welcome to the garden” on the welcome step. No extra step or modal.

### 6.4 Settings round-trip

- All onboarding-derived values (onboardingUseCase, onboardingRole, onboardingPriorities, plannerPreset, gamificationIntensity) are saved via `updateUserSettings` in Settings. Dashboard, planner, helper tone, and gamification all read from `userSettings` (no separate cache), so changes apply immediately on next render without data loss.

---

## 7. Remaining gaps before Phase 2 is fully premium

1. **Missed-day modal** — Copy is still generic; could use `getCopyForTone` for welcome-back title/subtitle if we pass `helperTone` from App.
2. **Spirit / helper interventions** — RECOVERY_COPY in recoveryCopyService is not yet tone-aware; could take `helperTone` and branch titles/messages.
3. **Visual emphasis for priorities** — `getEmphasizedSectionIds` is exported but not yet used to add a visual cue (e.g. ring or label) on priority-matched sections; reorder alone is in place.
4. **Student / Other** — Still map to MIXED; no dedicated section order.

Acceptance criteria met: priorities affect dashboard order; helper/empty-state and recovery copy adapt by tone; first-run shows a tailored persona line; changing profile in Settings updates emphasis cleanly; one shared product with smart defaults.
