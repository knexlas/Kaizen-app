# App profile settings

Users can change their onboarding-derived app profile later in **Settings → App profile**. No data is reset or deleted; only defaults and UI emphasis change.

## Settings in the App profile section

| Setting | What it does | Stored as |
|--------|----------------|-----------|
| **Primary use case** | What you mainly use the app for (work projects, freelance, personal, habits, or mix). | `userSettings.onboardingUseCase` |
| **Role type** | Which best describes you (Employee, Freelancer, Student, Multi-project creative, Other). | `userSettings.onboardingRole` |
| **Top goals** | What you want the app to help with most—pick up to 3 (plan week, break projects into steps, stay focused, build habits, calendar/deadlines, recover). | `userSettings.onboardingPriorities` (array) |
| **Planner & dashboard preset** | How the home screen and Projects view are arranged (Auto from use case/role, Employee, Freelancer, Habit-focused, Mixed). | `userSettings.plannerPreset` |
| **App tone** | How much celebration and guidance you see (Minimal, Balanced, Playful). | `userSettings.gamificationIntensity` |

All values are optional. Empty or missing values fall back to defaults (e.g. Mixed preset, Balanced tone). **Save profile** writes these into `userSettings` via `updateUserSettings`; they are persisted with the rest of settings (e.g. localStorage). No migration or data wipe is run.

## Migration behavior for existing users

- **No migration step**: Changing profile does not run any migration, version bump, or schema change. Existing goals, logs, week assignments, and all other data are untouched.
- **Additive only**: New keys (`onboardingUseCase`, `onboardingRole`, `onboardingPriorities`, `plannerPreset`, `gamificationIntensity`) are merged into `userSettings`. Existing keys (e.g. `dayStart`, `hasOnboarded`) are not removed or reset.
- **Existing users who never set profile**: If they never completed onboarding preferences, these fields may be missing. The app derives behavior from missing values (e.g. preset = Mixed, tone = Balanced). Once they open Settings and save profile, their choices are stored and used from then on.
- **Switching profile later**: User can change any option and tap **Save profile**. New values take effect for layout and defaults (home order, planner visibility, gamification) on next load or when they navigate; no reload required for most behavior. Projects and tasks are unchanged.

## How profile changes propagate through the app

- **Dashboard (home / Today tab)**  
  `getDashboardProfile(userSettings)` (same as planner preset) and `getDashboardSectionOrder(profile)` control which sections appear and in what order (e.g. freelancer: what to work on today, projects strip, week capacity; employee: today’s priorities, calendar/deadlines, blocked work; habit: routines, focus suggestion). Only the **order and visibility** of sections change; no content is deleted.

- **Project Planner (Projects modal)**  
  `getProjectPlannerPresetConfig(userSettings)` controls which blocks and card fields are shown (today strip, summary row, client, billable, hours this week, waiting on client, needs attention, week capacity, blocked reason). Default project filter (e.g. “This week” for employee) comes from preset. **Existing projects and tasks are not modified**; only which columns/sections are visible and the default filter change.

- **Planner tab (Day / Week / Month)**  
  `getPlannerTabPresetConfig(userSettings)` sets default view (day vs week), whether “planner details” are open by default, and whether Projects and Routines are expanded. Applied once when the dashboard loads (after hydration). **No data change.**

- **Gamification (app tone)**  
  `getGamificationIntensity(userSettings)` / `getGamificationConfig(userSettings)` drive: particles on/off, confetti on/off, reward toast duration, helper frequency (minimal = only critical interventions), spirit presence and auto-dialogue, metaphor-heavy wording, garden comment banner. **Purely presentational and frequency; no data change.**

- **New-project defaults**  
  When creating a new project, “Billable” can be pre-checked for freelancer (from `onboardingRole` or `onboardingUseCase`). **Only affects the create form default**; existing projects are not updated.

Summary: profile settings **only influence defaults, layout, and emphasis**. They do not delete, reset, or alter existing projects, tasks, logs, or assignments. Terminology in the UI is kept simple (e.g. “App profile”, “Primary use case”, “Role type”, “Top goals”, “Planner & dashboard preset”, “App tone”, “Save profile”).
