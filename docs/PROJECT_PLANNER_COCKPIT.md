# Project Planner (cockpit)

The Project Planner is a single shared modal that answers project questions quickly. Layout and visible columns/sections are **persona-aware** via onboarding preferences (planner preset). Core cockpit content is always shown; extra sections and card fields vary by preset.

## Planner structure (dashboard view)

1. **What to work on today** — One recommended task from deterministic logic (`getRecommendedTaskForToday`). Always shown. Primary CTA: Start focus; secondary: Reschedule, View today plan. Preset can emphasize (ring/border) or keep minimal.
2. **Summary row** (optional by preset) — Tiles: Active count, At risk, Blocked/Stuck; optionally Planned this week, Completed this week, Billable this week. Hidden for habit-focused.
3. **Projects list** — Always shown. Each row: project name, health badge, health reason, next action, due date, optional fields (client, billable, hours this week, waiting on client, blocked reason). Filter chips (All, Billable, At risk, This week, etc.) shown/hidden by preset. Per-row actions: Start, Plan, Add task, Review, Mark blocked.
4. **Needs attention** (optional by preset) — No next step, overdue unscheduled, deadline risk, not touched recently, overplanned week. Hidden for habit-focused.
5. **Week capacity** (optional by preset) — Available / Planned / Remaining hours; overload warning; optional billable vs non-billable split. Hidden for habit-focused.
6. **Create project** — Button always present.

Create view: same form; Client and Billable fields shown only when preset enables them (freelancer, mixed).

## What changes by preset

| Element | Freelancer | Employee | Habit-focused | Mixed |
|--------|------------|----------|----------------|-------|
| **What to work on today** | ✓ Emphasized | ✓ Emphasized | ✓ Shown, not emphasized | ✓ Emphasized |
| **Summary row** | ✓ Full (Active, At risk, Blocked, Planned, Completed, Billable) | ✓ (no Billable tile) | Hidden | ✓ Full |
| **Project cards: Client** | ✓ | Hidden | Hidden | ✓ |
| **Project cards: Billable** | ✓ | Hidden | Hidden | ✓ |
| **Project cards: Hours this week** | ✓ | ✓ | Hidden | ✓ |
| **Project cards: Waiting on client** | ✓ | Hidden | Hidden | ✓ |
| **Project cards: Blocked reason** | Hidden | ✓ When blocked/stuck | Hidden | Hidden |
| **Filter chips** | All + Billable + Waiting + … | All + At risk + This week + … | All + At risk + … (no billable/waiting) | All |
| **Default filter** | All | **This week** | All | All |
| **Needs attention** | ✓ | ✓ | Hidden | ✓ |
| **Week capacity** | ✓ + billable row | ✓ (no billable row) | Hidden | ✓ + billable row |
| **Create form: Client** | ✓ | Hidden | Hidden | ✓ |
| **Create form: Billable** | ✓ | Hidden | Hidden | ✓ |

- **Freelancer**: Client, billable, planned vs completed this week, waiting on client, week capacity (with billable split). Default filter All.
- **Employee**: Priority on “this week” (default filter), due date in every card, blocked work (reason in card when blocked/stuck). No client/billable. Week capacity without billable row.
- **Habit-focused**: Planner remains available; core only: “What to work on today” + project list (next action, health, deadline). No summary row, no needs attention, no week capacity, no client/billable/waiting in cards. Does not dominate home (dashboard profile already prioritizes routines/check-in).
- **Mixed**: Full cockpit; all optional sections and card fields on.

## Always shown (all presets)

- Active projects list (with next action, health, deadline per row).
- What to work on today strip (habit sees it without extra emphasis).
- Project health and short reason.
- Due date in card when `_projectDeadline` is set.
- Create project button.

## Reused logic

- **Health**: `getProjectHealth`, `getProjectHealthLabel` (projectSupportService). Derived: on_track, at_risk, blocked, unplanned, overdue, stuck.
- **Recommendation**: `getRecommendedTaskForToday` (projectCockpitService). Deterministic priority: planned for today → at-risk → unblocked → high-priority → recovery.
- **Capacity / attention**: `getWeekCapacitySummary`, `getNeedsAttention`, `getPlannedHoursPerProjectThisWeek`, `getLoggedMinutesThisWeekByGoal`, `getWeekDateStrings`, `getWeekCapacityHours`.
- **Next step**: `getNextStepForProject` (projectSupportService, delegates to nextStepService).
- **Preset**: `getProjectPlannerPresetConfig(userSettings)` (plannerPresets.js); preset derived from `plannerPreset` or onboarding role/use case.

## Label and copy (plain, action-first)

- Title: **Projects** (not “Project cockpit” in UI).
- Subtitle: “Active projects, next actions, deadlines.” / “Add a project and break it into steps.”
- Strip heading: **What to work on today** (not “Today needs this”).
- Summary section: plain tile labels (Active, At risk, Blocked, Planned this week, etc.).
- Buttons: Start, Plan, Add task, Review, Mark blocked, Create project, Reschedule, View today plan.

## Remaining gaps (to reach a full cockpit)

- **Priority**: No project-level priority field or column; employee “priority” is only implied by default filter “This week” and health/date ordering. Adding `_priority` (e.g. high/medium/low) and a Priority column for employee would close this.
- **Meeting vs deep work**: No flag or tag on goals for “meeting” vs “deep work”; no filter or column. Would require goal field (e.g. `_workType: 'meeting' | 'deep'`) and preset-driven column/filter.
- **Time “likely this week”**: “Planned this week” is shown (from week plan); “likely to take” could also reflect estimated remaining work from subtasks. Currently we show planned + completed this week; no explicit “estimated remaining this week.”
- **Habit-focused entry**: Planner is available from dashboard “Projects” link and from Plan tab “Plan a Project”; it does not dominate home. No further change required for “unless they use projects actively.”
- **Scan speed**: List is one card per project with clear next action and health; summary row and filters support quick scan. Optional: table view for power users (project | next action | due | health | hours) for even faster scan.
