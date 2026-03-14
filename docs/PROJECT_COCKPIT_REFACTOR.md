# Project Cockpit Refactor — Summary

The Project Planner was refactored into a **project cockpit** that answers five questions in under 10 seconds: active projects, next action per project, deadlines at risk, time likely this week, and what to work on today. No second planner was built; existing scheduling and next-step logic was reused and extended.

---

## 1. Files changed

| File | Changes |
|------|--------|
| **src/services/projectSupportService.js** | Exported `getPlannedMinutesThisWeekForGoal(goalId, weekAssignments, goals)` for use as selector; fixed `isProjectUnplanned` to use `goal?.id`. |
| **src/services/projectCockpitService.js** | Added `getCompletedMinutesThisWeekForGoal(goalId, logs, weekDateStrings)`; added `isOverplanned(weekCapacityHours, plannedTotalMinutes)`; extended `getWeekCapacitySummary` to compute `billableCompleted` from `loggedMinutesByGoal` and goals, and to return `completedTotalMinutes` for trend display. |
| **src/components/Projects/ProjectPlanner.jsx** | **Header:** Subtitle set to "Active work, next actions, deadlines." when on dashboard; added "Add project" button in header (secondary). **Top strip:** Renamed to "What to work on now"; one recommended task with next step title, reason, project + duration; primary "Start focus" CTA; Reschedule and View today plan. **Portfolio summary:** Added Overdue tile (from `needsAttention.overdueUnscheduled`); split Blocked vs Stuck into Blocked count only; labels "Planned" / "Done" / "Billable"; Overdue tile styled for visibility. **Week capacity:** Overload warning made prominent (amber panel + copy); added "Done this week" and "Planned Xh · Done Yh" trend; billable completed and planned split when preset shows billable. **Create flow:** "Add project" in header and "+ Add project" link at bottom; create/slice remains secondary, dashboard is default. |

---

## 2. Selectors / helpers added

| Selector / helper | Location | Purpose |
|-------------------|----------|--------|
| **getPlannedMinutesThisWeekForGoal** | projectSupportService | Planned minutes this week for one goal (from week plan). Exported for cockpit and other callers. |
| **getCompletedMinutesThisWeekForGoal** | projectCockpitService | Completed (logged) minutes this week for one goal. |
| **isOverplanned** | projectCockpitService | True when planned hours exceed week capacity. |

**Existing selectors reused (no new names):**

- **recommendedTodayTask** → `getRecommendedTaskForToday` (projectCockpitService)
- **projectHealth** → `getProjectHealth` / `getProjectHealthState` (projectSupportService)
- **deadlineRisk** → `getDeadlinesAtRisk` (projectSupportService)
- **plannedMinutesThisWeek** → `getPlannedHoursPerProjectThisWeek` (array by goal) and `getPlannedMinutesThisWeekForGoal` (single goal)
- **completedMinutesThisWeek** → `getLoggedMinutesThisWeekByGoal` (by goal) and `getCompletedMinutesThisWeekForGoal` (single goal)
- **isStuck** → `isProjectStuck` (projectSupportService)

---

## 3. Reused logic

- **Next step / recommendation:** `getNextStepForProject`, `getBestNextStepForGoal` (nextStepService), `getRecommendedTaskForToday` (projectCockpitService) with existing priority order: planned today → at-risk with next step → deadline-near → newly unblocked (starter) → high-priority active → small recovery when behind.
- **Health states:** `getProjectHealth` in projectSupportService (on_track, at_risk, blocked, unplanned, overdue, stuck) with existing rules; no parallel engine.
- **Planned hours:** `getPlannedHoursByScope` (plannedHoursAggregation) and `getPlannedHoursPerProjectThisWeek`; week capacity from `getWeekCapacityHours` and `getWeekCapacitySummary`.
- **Needs attention:** `getNeedsAttention` (no next step, overdue unscheduled, deadline risk, not touched recently, overplanned week).
- **Focus / reschedule:** Existing `onStartFocus`, `onReschedule`, `onViewTodayPlan` from parent; no new scheduling engine.

---

## 4. Overlapping flows found and how they were consolidated

| Overlap | Resolution |
|--------|-------------|
| **"What to work on today" vs "What to work on now"** | Single top strip: "What to work on now" with one recommendation from `getRecommendedTaskForToday`; same backing logic, no duplicate UI. |
| **Portfolio counts (blocked vs stuck)** | Summary shows Active, At risk, Blocked, Overdue; "Blocked / Stuck" merged into Blocked count only in the summary; project cards still show full health (including Stuck). |
| **Planned vs completed this week** | Single source: `getPlannedHoursByScope` + `getLoggedMinutesThisWeekByGoal`; displayed in portfolio row (Planned, Done, Billable) and in week capacity (Planned Xh · Done Yh, plus Done this week cell). |
| **Create project entry** | Two entry points (header "Add project", bottom "+ Add project") both call `goToCreate`; single create/slice flow, dashboard remains default view. |

---

## 5. Remaining gaps before the cockpit is truly premium

1. **One-click "Mark blocked"**  
   Today "Mark blocked" opens the full goal editor. A one-click toggle (e.g. set `_blocked` and optional `_blockedReason` without opening the editor) would require an `onMarkBlocked(goal, value)` callback and possibly a small inline input for reason.

2. **Priority / meeting–deep-work (employee preset)**  
   Spec called for employee default: "priority, meeting/deep-work relevance, dependency/blocker". Goal model has no `priority` or `workType`; only `_blocked` / `_blockedReason`. Adding priority or work-type would need schema and UI support.

3. **"Add task" vs "Review"**  
   Both open the same editor. Opening the editor with a focused tab (e.g. "Add task" → subtasks, "Review" → full form) would require `onEditGoal(goal, { tab: 'subtasks' })` or similar contract.

4. **Shared `buildProjectGoalFromPlan`**  
   Plan-from-document (CompostHeap) and create-from-slice (ProjectPlanner) both build goal + milestones + subtasks from AI output. Logic is duplicated; a shared helper would reduce drift and ease maintenance.

5. **No browser confirm in cockpit**  
   No `confirm()` or `alert()` was added in cockpit flows. Any existing dialogs in parent (e.g. reschedule) are unchanged.

6. **Scannability in 3–5 seconds**  
   Layout and hierarchy (top strip → portfolio → list → needs attention → week capacity) support quick scanning; further tuning (e.g. compact list variant, stronger visual hierarchy for at-risk/overdue) could improve time-to-answer further.

---

## Acceptance criteria (met)

- User can open the planner and quickly see active work, risk, hours, and what to do next.
- Every active project has either a concrete next action or a visible stuck state (via health badge and "No next step" in card and needs attention).
- At-risk and overdue projects are visually distinct (badges, overdue tile, week capacity overload).
- Planned vs completed this week is visible in portfolio summary and week capacity without opening project detail.
- The planner no longer feels setup-first: dashboard is default, "Add project" is secondary.
- Quick actions (Start, Plan, Add task, Mark blocked, Review) work; Mark blocked and Add task currently open the editor (no one-click block yet).
