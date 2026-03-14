# Planner presets

Planner behavior is tailored by **preset**: employee, freelancer, habit-focused, or mixed. One shared planner architecture; the preset changes defaults, visible fields, and emphasis.

## How the active preset is chosen

- **Explicit**: If the user has set **Planner preset** in **Settings → Personalization**, that value is used.
- **Auto**: If not set, the preset is derived from onboarding:
  - Role **Freelancer** or use case **Freelance / client work** → **Freelancer**
  - Role **Employee** or use case **Work projects** → **Employee**
  - Use case **Habits and routines** → **Habit-focused**
  - Role **Multi-project creative** or use case **A mix of these** → **Mixed**
  - Otherwise → **Mixed**

## Preset rules (emphasis)

| Preset | Emphasis |
|--------|----------|
| **Freelancer** | Active projects, client field, billable vs non-billable, hours planned/completed this week, waiting on client, “what to work on today”. Planner tab: week view, projects expanded. |
| **Employee** | Today’s priorities, due dates, deep work vs meetings, blocked work, weekly plan. Portfolio and needs attention; no client/billable in cards. Default filter: This week. |
| **Habit-focused** | Routines, consistency, lightweight daily check-in, focus and recovery. Project cockpit minimal. Planner tab: day view, routines expanded. |
| **Mixed** | Balance of projects, planning, and routines. All cockpit sections and card fields visible; week view with projects and routines expanded. |

## Project planner fields shown or hidden by default

| Field / section | Freelancer | Employee | Habit-focused | Mixed |
|-----------------|------------|----------|----------------|-------|
| Today needs this | ✓ (emphasized) | ✓ (emphasized) | Hidden | ✓ (emphasized) |
| Portfolio summary (Active, At risk, Blocked) | ✓ | ✓ | Hidden | ✓ |
| Planned / Completed / Billable tiles | ✓ | ✓ | Hidden | ✓ |
| Client in project cards | ✓ | Hidden | Hidden | ✓ |
| Billable in project cards | ✓ | Hidden | Hidden | ✓ |
| Hours planned · completed in cards | ✓ | ✓ | Hidden | ✓ |
| Waiting on client badge | ✓ | Hidden | Hidden | ✓ |
| Needs attention panel | ✓ | ✓ | Hidden | ✓ |
| Week capacity panel | ✓ | ✓ | Hidden | ✓ |
| Billable row in week capacity | ✓ | Hidden | — | ✓ |
| Create project: Client field | ✓ | Hidden | Hidden | ✓ |
| Create project: Billable checkbox | ✓ | Hidden | Hidden | ✓ |
| Filter chips: Billable / Non-billable / Waiting on client | ✓ | Hidden | Hidden | ✓ |
| Default project list filter | All | This week | All | All |

## Planner tab defaults (Day / Week / Month)

| Setting | Freelancer | Employee | Habit-focused | Mixed |
|---------|------------|----------|----------------|-------|
| Default view | Week | Week | Day | Week |
| Show planner details by default | Yes | Yes | No | Yes |
| Projects & milestones expanded by default | Yes | No | No | Yes |
| Routines expanded by default | No | No | Yes | Yes |

Defaults are applied once when the dashboard loads (after hydration). Changing the preset in Settings takes effect on the next load or refresh.

## How users switch presets

1. Open **Settings** (dashboard Settings tab).
2. In **Personalization**, find **Planner preset**.
3. Choose **Auto (from role & use case)** to derive from onboarding, or pick **Employee**, **Freelancer**, **Habit-focused**, or **Mixed**.
4. Click **Save preferences**.

Implementation: `src/constants/plannerPresets.js` (config and derivation), `ProjectPlanner.jsx` (cockpit visibility), `GardenDashboard.jsx` (planner tab defaults), `SettingsView.jsx` (preset selector).
