# Project Cockpit — Audit Checklist

Audit of the current Project Cockpit implementation against the specified checklist.

---

## Passed items

- **Default view is action-first rather than setup-first.**  
  The cockpit opens in `view === 'dashboard'` (list view). "Add project" is a secondary header button and a "+ Add project" link at the bottom. Create/slice flow is only entered when the user clicks Add project or when opened with a prefill (e.g. from GoalEditor). No setup wizard or "describe your project" on first open.

- **Project health states are derived correctly and visible where needed.**  
  Health is derived in `projectSupportService.getProjectHealth` (overdue → blocked → stuck → at_risk → unplanned → on_track). Every project card shows a health badge (`getProjectHealthLabel(healthState)`) and the reason line. Portfolio summary shows At risk, Blocked, Overdue counts. Needs attention lists no next step, overdue unscheduled, deadline risk, not touched recently, overplanned. No manual health state; all from goals + context.

- **Every active project shows a real next step or a clear stuck state.**  
  Each card shows either `Next: {title}` (and optional `~N min`) or `No next step` with `· Stuck` in rose when stuck. Health badge is always present (On track, At risk, Blocked, Stuck, Unplanned, Overdue). So each project has either a concrete next action or an explicit "No next step" + Stuck.

- **Week capacity and deadline risk are obvious (for presets that show them).**  
  Week capacity panel shows Available, Planned, Remaining, Done this week; when overloaded the panel uses an amber border/background and the copy "Week is overplanned. Planned time exceeds available hours — consider moving work or reducing scope." Planned vs done trend line is shown. Deadline risk appears in: portfolio summary "At risk" and "Overdue" tiles; per-card deadline line with "X days left" or "overdue"; Needs attention "Deadline risk" / "Overdue unscheduled". For employee/freelancer/mixed this is clear. For habit_focused, see Failed / Ambiguities.

- **Freelancer-specific fields are present without overwhelming employees.**  
  Preset config controls: `showClientInCards`, `showBillableInCards`, `showWaitingOnClientInCards`, `showPortfolioHours` (including Billable tile), and in create form Client/Billable. Freelancer preset has these true; employee has them false. Filter chips (Billable, Non-billable, Waiting on client) are only rendered when the corresponding `show*` is true. So freelancer sees client, billable, waiting; employee does not.

- **No browser prompt/confirm in planner-related interactions.**  
  There are no `confirm()`, `alert()`, or `prompt()` calls inside `ProjectPlanner.jsx` or in the cockpit open/close/start/reschedule/view-today flows. The only `window.confirm` / `window.alert` in the dashboard are for disconnecting Google/Outlook calendar and for calendar connection errors—not planner/cockpit flows.

- **Screen is professional and relatively calm.**  
  Copy is plain ("Active work, next actions, deadlines.", "What to work on now", "Start focus", "Reschedule", "View today plan"). No mascot or decorative interruptions inside the cockpit modal. Palette is stone/moss/amber/rose for state. Layout is ordered: top strip → portfolio summary → project list → needs attention → week capacity. No gamification inside the cockpit itself.

---

## Failed items

- **Habit-focused preset: 5 questions in under 10 seconds is not fully met.**  
  For `habit_focused`, `showPortfolioSummary`, `showPortfolioHours`, `showNeedsAttention`, and `showWeekCapacity` are all false. So habit users do **not** see: portfolio summary row (active/at-risk/blocked/overdue/hours), needs attention panel, or week capacity panel. They also have `showHoursPlannedCompletedInCards: false`, so per-project "this week: Xh planned · Yh completed" is hidden. As a result:
  - Q3 (Which deadlines are at risk?) — no at-a-glance count; only by scanning each card’s deadline line.
  - Q4 (How much time is this project likely to take this week?) — no summary and no per-card hours for habit preset.
  - So for habit_focused, the cockpit does not meet "answer in under 10 seconds" for Q3 and Q4.

- **Redundant "Planned Xh · Done Yh" in week capacity.**  
  The week capacity panel has both a 4-cell grid (Available, Planned, Remaining, Done this week) and a duplicate trend line below: "Planned Xh · Done Xh". The trend line repeats the same numbers and adds visual noise. Fix: remove the duplicate line or keep only the line and drop one of the cells if desired.

---

## Ambiguities

- **Whether "competing" entry points are acceptable.**  
  There are still several ways to open the same cockpit: Today tab (projects_strip "Open Project Planner", needs_attention "View in Project Planner", blocked_work "Open Project Planner", projects_if_relevant "Projects (n)"); Planner tab (header "Plan a Project", secondary card "Plan a Project"); GoalCreator "Plan a Project" (when not habit_focused). All open the same modal, so they are not competing UIs. The ambiguity is whether so many entry points is "competing" (clutter) or "discoverable" (multiple paths). Recommendation: treat as passed but consider reducing to one primary entry per surface (e.g. one "Projects" or "Open Project Planner" per tab) with the rest as links.

- **Habit-focused: intentional reduction vs. oversight.**  
  The preset intentionally hides portfolio summary, needs attention, and week capacity for habit users. If the design intent is "habit users rarely need project cockpit; when they do, minimal view is fine," then the failure above is by design. If the intent is "every user can answer the 5 questions in under 10 seconds when they open the cockpit," then habit_focused should either show at least a minimal summary (e.g. at-risk count, week capacity one-liner) or the checklist should state that the 10-second bar applies only to presets where the full cockpit is shown.

- **"Premium" is subjective.**  
  The checklist asks if the screen "feels premium, calm, and professional." The implementation uses consistent typography, spacing, and semantic structure; no browser dialogs in the flow; no mascot in the cockpit. What might still be tuned: density (more compact vs. more breathable), prominence of the primary CTA, or a dedicated "compact" list variant for power users. Marked as passed with the note that further polish is possible.

---

## Exact UI or logic fixes still needed

1. **Habit_focused: optional minimal summary so Q3/Q4 are answerable quickly**  
   - If product wants habit users to also meet the 5-questions bar: either show a single compact summary row for habit_focused (e.g. "X active · Y at risk · Zh planned" and one line for capacity), or show at least "At risk" and "Planned this week" in a reduced portfolio row.  
   - If product accepts that habit users get a reduced cockpit: document that the "under 10 seconds" criterion applies only when portfolio summary and week capacity are shown (i.e. not habit_focused).

2. **Remove duplicate trend line in week capacity**  
   - In `ProjectPlanner.jsx`, week capacity section: remove the line  
     `Planned {weekCapacity.plannedHours.toFixed(1)}h · Done {weekCapacity.completedThisWeek.toFixed(1)}h`  
     below the grid, since the grid already has Planned and "Done this week" cells.  
   - Or remove the "Done this week" cell and keep only the trend line; either way, avoid showing the same two numbers twice.

3. **Add task vs Review vs Mark blocked (optional)**  
   - All three currently open the same goal editor. For a "premium" feel, consider: "Add task" opening editor with subtasks focused; "Mark blocked" as a one-click toggle or small inline flow; "Review" as full editor. Not strictly required for this audit but listed as a UX improvement.

---

## Duplicated logic or component overlap

1. **daysUntil vs daysUntilDeadline**  
   - `ProjectPlanner.jsx` defines a local `daysUntil(dateStr)` for deadline display in cards.  
   - `projectCockpitService.js` has an internal `daysUntilDeadline(goal)` used for recommendation ordering.  
   - Same concept (days until/after deadline), different signatures. Not harmful but could be unified: e.g. export a small `dateUtils` helper `daysUntilDeadline(dateStr)` and use it in both the component (for display) and the service (for sorting), or have the component call a service helper that takes `goal._projectDeadline`.

2. **Single cockpit, multiple entry points**  
   - No component duplication: one `ProjectPlanner` modal. Overlap is only in how many places call `setShowProjectPlanner(true)` (dashboard sections, Planner tab, GoalCreator). That is intentional routing to the same cockpit, not duplicated logic.

3. **Health and recommendation**  
   - Health derivation lives only in `projectSupportService.getProjectHealth`.  
   - Recommendation logic lives only in `projectCockpitService.getRecommendedTaskForToday`.  
   - No duplicate health or recommendation logic in the UI layer.

---

## Summary table

| Criterion | Status | Note |
|-----------|--------|------|
| 5 questions in under 10 seconds | **Fail** for habit_focused | Q3/Q4 not at-a-glance when portfolio + week capacity hidden. |
| Default view action-first | **Pass** | Dashboard list is default; Add project is secondary. |
| Health states derived and visible | **Pass** | Single source of truth; badges + reason everywhere needed. |
| Every project: next step or stuck | **Pass** | Cards show "Next: …" or "No next step · Stuck" + health. |
| Week capacity and deadline risk obvious | **Pass** (non-habit) | Clear panels and summary tiles; **Fail** for habit (hidden). |
| Freelancer fields without overwhelming employee | **Pass** | Preset-controlled; employee has no client/billable/waiting. |
| Overlapping entry points competing with cockpit | **Ambiguous** | Many entry points, same cockpit; consider one primary per surface. |
| No browser prompt/confirm in planner flows | **Pass** | No confirm/alert/prompt in cockpit or planner-related actions. |
| Premium, calm, professional | **Pass** | Plain language, no mascot in cockpit; optional polish possible. |
