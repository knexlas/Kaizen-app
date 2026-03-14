# Planning Entry Points Audit

Audit of the app’s planning entry points and overlap, with role-based onboarding and presets in mind. Goals: one clear primary flow per user type, demote or hide overlapping flows, keep advanced tools available without dominating the main UX, and unify logic where multiple flows do similar work.

---

## 1. Entry points identified

| Entry point | Where it lives | What it does | Backing logic |
|-------------|----------------|--------------|---------------|
| **Project Planner** (modal) | Today (projects_strip, needs_attention, blocked_work, projects_if_relevant), Planner tab (header + secondary card), GoalCreator type choice | Opens Projects modal: list view + create flow with “Generate plan” (AI slice) and “Create project”. | `setShowProjectPlanner(true)`. Create flow: `sliceProject` → `handleProjectGoals` (addGoal). |
| **Create project (in Planner)** | Inside Project Planner → Create view | Name + optional deadline/description → “Generate plan” (slice) → edit phases/tasks → “Create project”. | `geminiService.sliceProject`, then build goal + subtasks/milestones and `onCreateGoals`. |
| **GoalCreator “Plan a Project”** | GoalCreator type picker (Plant a Seed / Place a Rock / etc.) | One of the type tiles: opens Project Planner (with optional prefill). | `onOpenProjectPlanner?.(); onClose?.()`. Does not create; just opens Planner. |
| **Slice this project** | Project Planner create view | “Generate plan” button: calls `sliceProject` with name/deadline/description, then user edits and saves. | Same as “Create project” flow; slice is step 1, create is step 2. |
| **Suggest my week** | Planner tab, Week view: primary action row | Rule-based week fill from goals + calendar; shows review modal (Apply / Adjust / Discard). | `handleAutoPlanWeek` → `schedulerService.autoFillWeek` → `setPendingWeekPlan`. |
| **Plan My Week** (AI) | Planner tab, Week view: inside `WeekView` | AI-generated week plan; preview then Apply / Discard. | `handlePlanWeek` → `geminiService.generateWeeklyPlan` → `materializeWeeklyPlan` → `setWeekPreview`. |
| **Suggest day plan** | Planner tab, Day view: action row | Rule-based day plan; saves directly to today. | `handleSuggestTodayPlan` → `schedulerService.generateDailyPlan` → `saveDayPlanForDate(today, plan)`. |
| **Plan My Month / Shape month with AI** | Planner tab, Month view: action row; also `PlanMonthPanel` | AI-generated month tasks; optional review/assign. | `handlePlanMonth` / `handleShapeMonthWithAI` → `generateMonthlyPlanTasks` → `setPendingMonthPlan`. |
| **Plan from Document** | Compost Heap → Ideas tab | Upload PDF/Word/TXT/image → AI extracts and creates one project (phases/tasks) via `planProjectFromDocument`; adds goal in place, does not open Project Planner. | `geminiService.planProjectFromDocument` → build goal + subtasks/milestones → `addGoal(newProject)`. |
| **Quick-add / OmniAdd** | OmniAdd component, Command Palette | Natural language → parse → route to GoalCreator (or compost, etc.). GoalCreator can then open “Plan a Project” (Project Planner). | `taskCaptureService` / `parseOmniAddInput` → `openGoalCreatorFromCapture` or `setIsPlanting(true)`. |
| **GoalEditor “Create project”** | GoalEditor (edit goal) | When AI suggests a project from a kaizen goal: “Create project: [title]” opens Project Planner with prefill. | `onOpenProjectPlanner({ prefillTitle, parentGoalId })` → `setProjectPlannerPrefill` + `setShowProjectPlanner(true)`. |

Additional related entry points:

- **Today “Plan week”** (Employee calendar_deadlines): only navigates to Planner tab (`setActiveTab('planner')`).
- **Planner Coach “Auto-rebalance week”**: same as “Suggest my week” (`handleAutoPlanWeek`).
- **PlanMonthPanel**: uses same `handlePlanMonth`; duplicate surface for month planning.

---

## 2. Duplicated or overlapping flows

| Overlap | Description |
|---------|-------------|
| **Two week-planning flows** | (1) **Suggest my week**: rule-based `autoFillWeek`, review modal. (2) **Plan My Week**: AI `generateWeeklyPlan`, preview in week grid. Same tab (Planner, Week view), different buttons and backends. Users can be confused which to use. |
| **Two “create project” paths** | (A) Open Project Planner → Create → name → Generate plan → Create project. (B) GoalCreator → “Plan a Project” → same Project Planner create flow. (C) Plan from Document creates a project without opening Planner. So: one canonical create flow (Planner), but two entry points (Planner vs GoalCreator), plus document creates in place. |
| **Project creation from document vs Planner** | Compost “Plan from Document” builds goal + subtasks from `planProjectFromDocument` and `addGoal()`. Project Planner create flow uses `sliceProject` then `onCreateGoals`. Same normalized shape (`normalizeSliceProjectParsed`) and similar goal structure; logic is duplicated in CompostHeap (build project from plan) vs ProjectPlanner (build from slice result). |
| **Multiple “Plan a Project” buttons** | Today: projects_strip (“Open Project Planner”), needs_attention (“View in Project Planner”), blocked_work (“Open Project Planner”), projects_if_relevant (“Projects (n)”). Planner tab: header “Plan a Project” and secondary card “Plan a Project”. All open the same modal; no preset-based prioritization. |
| **Month planning in two places** | Planner tab Month view action row “Shape month with AI” and `PlanMonthPanel` both call `handlePlanMonth`; same action, two UI surfaces. |

---

## 3. Recommended primary flow per persona

| Preset | Primary planning flow | Rationale |
|--------|------------------------|-----------|
| **Freelancer** | **Project Planner** (projects + today strip + week capacity). Primary entry: Today “What to work on today” + projects_strip “Open Project Planner”; secondary: Planner tab “Plan a Project”. Week planning: **Suggest my week** (rule-based) as primary; “Plan My Week” (AI) as optional. | Project- and client-centric; one cockpit for projects and hours; quick week fill from existing goals. |
| **Employee** | **Planner tab (Day/Week)** and **Suggest day plan** / **Suggest my week**. Project Planner secondary (for breaking down projects). Today: “Today’s priorities” and “Plan week” (go to Planner). | Day/week planning first; projects are supporting. |
| **Habit-focused** | **GoalCreator** (Place a Rock / Plant a Seed) and **Suggest day plan**; routines expanded. **Project Planner and “Plan a Project”** demoted or hidden from main surfaces (e.g. hide from GoalCreator type picker or show as “Advanced: Plan a project”). | Habits and routines first; project creation is advanced. |
| **Mixed** | **Project Planner** and **Planner tab** balanced; **Suggest my week** or **Plan My Week** (one primary, one secondary). GoalCreator keeps “Plan a Project” as an option. | Balance of projects and planning. |

---

## 4. Flows to merge, hide, or simplify

| Action | Flow / UI | Recommendation |
|--------|-----------|----------------|
| **Merge** | Week planning | Single primary CTA for “plan my week”: e.g. “Suggest my week” (rule-based) as default, with “Use AI instead” or “Plan My Week (AI)” as secondary link/button. Or choose one per preset (e.g. employee: Suggest; freelancer: either). Avoid two equal buttons in the same view. |
| **Unify** | Project creation from plan | Shared helper: given a normalized slice/document result (phases, tasks, estimatedHours), build goal + milestones + subtasks in one place. Use from both ProjectPlanner and CompostHeap (Plan from Document). |
| **Demote** | “Plan a Project” in GoalCreator for habit_focused | For habit_focused preset: hide “Plan a Project” tile or move to “More” / “Advanced”. Keep Project Planner reachable from elsewhere (e.g. Settings or a single “Projects” link). |
| **Demote** | Plan My Month | Keep “Shape month with AI” in Month view and/or PlanMonthPanel as advanced; do not duplicate in multiple prominent places. One entry point (e.g. only in Month view action row) is enough. |
| **Simplify** | “Plan from Document” | Keep in Compost only. After creating project, optionally open Project Planner to that project (e.g. “View in Projects”) instead of creating a second path. |
| **Reduce** | “Plan a Project” buttons on Today | Keep one primary CTA per profile (e.g. projects_strip for freelancer/mixed; “Plan week” for employee). Other sections (needs_attention, blocked_work) can use “View in Project Planner” link instead of repeating “Open Project Planner”. |

---

## 5. Code / service duplication suspects

| Location | Suspect | Recommendation |
|----------|---------|----------------|
| **CompostHeap** (Plan from Document) vs **ProjectPlanner** (Create from slice) | Both turn AI plan (phases, tasks) into goal + milestones + subtasks. CompostHeap has inline construction (uid, milestones, subtasks, _projectGoal, etc.); ProjectPlanner has its own creation from `sliceProject` result. | Extract `buildProjectGoalFromPlan(plan, options)` (or similar) in a shared module (e.g. `projectGoalFromPlan.js` or in `projectSupportService`). Take normalized `{ title, summary, totalWeeks, phases }` and return goal shape. Use in both CompostHeap and ProjectPlanner. |
| **geminiService** | `normalizeSliceProjectParsed` already shared by `sliceProject` and `planProjectFromDocument`. Good. | Keep; ensure all consumers use the same normalized shape so the new `buildProjectGoalFromPlan` can rely on it. |
| **schedulerService.autoFillWeek** vs **plannerEngine.autoFillWeek** | `plannerEngine` exports deprecated `autoFillWeek`; `schedulerService` re-exports. | Already unified at call site (GardenDashboard uses schedulerService). Remove or clearly deprecate plannerEngine export when safe. |
| **generateDailyPlan** | Used by GardenDashboard (Suggest day plan), TimeSlicer (internal), coreCommands. | No duplication; single source. |
| **handlePlanWeek** vs **handleAutoPlanWeek** | Two handlers, two backends (AI vs rule-based). | Keep both backends; unify UX: one primary “Plan my week” that chooses backend by preset or user choice (e.g. “Suggest” vs “AI”), or show one primary and one secondary. |
| **GoalEditor → Project Planner prefill** | GoalEditor passes `{ prefillTitle, parentGoalId }` but GardenDashboard’s `setProjectPlannerPrefill` only reads `prefillParentGoalId`. | **Fixed:** Dashboard now uses `opts?.prefillParentGoalId ?? opts?.parentGoalId ?? ''` so parent link is preserved when opening from GoalEditor. |

---

## 6. Summary

- **Duplicated/overlapping:** Two week-planning flows (Suggest my week vs Plan My Week); multiple “Plan a Project” entry points; project creation from document vs from Planner; month planning in two surfaces.
- **Primary per persona:** Freelancer → Project Planner + Suggest my week. Employee → Planner tab + Suggest day/week. Habit-focused → GoalCreator + Suggest day; Project Planner demoted. Mixed → balanced.
- **Merge/hide/simplify:** Unify week planning under one primary CTA; shared `buildProjectGoalFromPlan`; demote “Plan a Project” for habit_focused; single primary “Plan a Project” per preset on Today; fix GoalEditor prefill (`parentGoalId`).
- **Code duplication:** Extract project-from-plan build logic; fix prefill key; consider one week-planning entry with preset or user choice for rule-based vs AI.

Implementing these will reduce overlap, clarify the main workflow per user type, and keep advanced tools (Plan from Document, Plan My Month, AI week) available without dominating the main UX.

---

## 7. Implementation (done)

- **Prefill fix:** `GardenDashboard` now sets `prefillParentGoalId` from `opts?.prefillParentGoalId ?? opts?.parentGoalId` when opening Project Planner from GoalEditor so the parent goal link is preserved.
- **Planning entry config:** `plannerPresets.js` now has a `planningEntry` object per preset: `showPlanAProjectInGoalCreator` (habit_focused = false), `primaryWeekPlanning` ('suggest' | 'ai'). Exported `getPlanningEntryConfig(userSettings)`.
- **GoalCreator:** The “Plan a Project” type tile is shown only when `planningEntry.showPlanAProjectInGoalCreator` is true (hidden for habit_focused).
- **Week planning UX:** When `primaryWeekPlanning === 'suggest'`, the week view in TimeSlicer shows “Or use AI to plan week” as a small link instead of the prominent “✨ Plan My Week” button; the primary week action remains “Suggest my week” in the Planner tab action row. When `primaryWeekPlanning === 'ai'`, the AI button stays prominent.
