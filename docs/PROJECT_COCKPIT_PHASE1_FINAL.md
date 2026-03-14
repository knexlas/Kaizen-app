# Project Cockpit — Phase 1 Final (Premium Polish)

Phase 1 cleanup pass: habit-focused minimal cockpit, differentiated row actions, unified days-until logic, and entry-point clarity. No new planner variants, no new planning engines, no extra gamification.

---

## 1. Files changed

| File | Changes |
|------|--------|
| **src/services/dateUtils.js** | Added `daysUntilDeadline(dateStr)` — single source for “days until deadline” (positive = future, negative = overdue, null if missing/invalid). |
| **src/services/projectSupportService.js** | `hasProjectDeadlinePassed` and `isDeadlineAtRisk` now use `daysUntilDeadline` from dateUtils (imported as `daysUntilDeadlineDate`). Removed local date math. |
| **src/services/projectCockpitService.js** | Removed internal `daysUntilDeadline(goal)`; import and use `daysUntilDeadline(dateStr)` from dateUtils with `goal?._projectDeadline`. |
| **src/components/Projects/ProjectPlanner.jsx** | Removed local `daysUntil()`; use `daysUntilDeadline` from dateUtils. **Habit-focused:** when preset is habit_focused and not expanded, show minimal cockpit (compact summary: active count, at-risk count, planned this week, one suggested task + Start, “See all projects”). **Row actions:** Add task → quick-add sheet (title + Add); Review → full editor; Mark blocked → inline sheet (blocked checkbox + optional reason, Save via `editGoal`); Plan → “Schedule” (unchanged, still `onReschedule`). Added state and overlays for quick-add and mark-blocked sheets. |
| **src/components/Dashboard/GardenDashboard.jsx** | Replaced local `daysUntil` in `plannerUpcomingDeadlines` with `daysUntilDeadline` from dateUtils. **Entry points:** Primary CTA label “Open planner” (projects_strip, header CTA); contextual links “View in planner” (needs_attention, blocked_work, projects_if_relevant, Projects card). Removed “Open Project Planner” / “View in Project Planner” / “Plan a Project” in favor of these. |

---

## 2. Action behavior changes

| Action | Before | After |
|--------|--------|--------|
| **Add task** | Opened full goal editor. | Opens quick-add sheet: project name, single “Task title” input, Add. Calls `addSubtask(goalId, { title, estimatedHours: 0.5 })`. No full editor. |
| **Review** | Opened full goal editor. | Unchanged: opens full project detail/editor via `onEditGoal(g)` and closes planner. |
| **Mark blocked** | Opened full goal editor. | Opens compact sheet: “Mark as blocked” checkbox (pre-filled from `g._blocked`), optional “Reason” input, Save. Calls `editGoal(goalId, { _blocked, _blockedReason })`. No full editor. |
| **Plan** | Label “Plan”; same `onReschedule`. | Label “Schedule”; same behavior (planning/scheduling, not generic edit). |

---

## 3. Habit-focused summary behavior

- **When:** Preset is `habit_focused` and user has not clicked “See all projects”.
- **What’s shown:** One compact section:
  - Line 1: “**X** projects · **Y** at risk” (or “none at risk”) · “**Z**h planned this week”.
  - If there’s a recommendation: next step title, reason, and primary “Start focus” button.
  - If none: “No suggested task. Add a next step or plan time.”
  - Link: “See all projects”.
- **What’s not shown:** Full portfolio summary, needs-attention panel, week-capacity panel, and full project list. No dense cockpit.
- **After “See all projects”:** Full cockpit is shown (same as other presets). State resets when the planner modal closes.

---

## 4. Duplicated helpers removed or consolidated

| Before | After |
|--------|--------|
| `ProjectPlanner.jsx`: local `daysUntil(dateStr)`. | Removed. All call sites use `daysUntilDeadline(dateStr)` from dateUtils. |
| `GardenDashboard.jsx`: local `daysUntil` inside `plannerUpcomingDeadlines`. | Removed. Uses `daysUntilDeadline` from dateUtils. |
| `projectCockpitService.js`: internal `daysUntilDeadline(goal)`. | Removed. Uses `daysUntilDeadline(goal?._projectDeadline)` from dateUtils. |
| `projectSupportService.js`: inline date math in `hasProjectDeadlinePassed` and `isDeadlineAtRisk`. | Replaced with `daysUntilDeadlineDate(goal?._projectDeadline)` from dateUtils. |

**Single shared helper:** `dateUtils.daysUntilDeadline(dateStr)` — used in cockpit UI, projectCockpitService, projectSupportService, and GardenDashboard.

---

## 5. Remaining issues before Phase 1 is fully complete

- **None critical.** Optional follow-ups:
  - **Quick-add:** Optional “estimated hours” field in the quick-add sheet (currently fixed 0.5h) for power users.
  - **Habit-focused “See all” persistence:** “See all projects” resets on modal close; could be persisted per session if desired.
  - **Calendar/deadlines “Plan week” vs “Plan today”:** “Plan week” and “Plan my week” on the dashboard are week-planning CTAs (TimeSlicer); “Plan today” as a single primary label for today-specific planning could be clarified in copy if needed.

Phase 1 acceptance criteria are met: habit_focused users get quick project/risk/time/suggestion awareness without full cockpit overload; row actions are distinct and intentional; one shared days-until helper; planner entry points are clearer with one primary “Open planner” and demoted “View in planner” links; cockpit remains calm and premium.
