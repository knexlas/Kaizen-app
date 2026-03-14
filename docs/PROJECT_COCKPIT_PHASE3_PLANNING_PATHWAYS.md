# Phase 3: Planning Pathway Consolidation and Primary-Flow Cleanup

Goal: One decisive premium planning product—one primary planning path per persona, overlapping pathways reduced or demoted, shared logic unified, cockpit as main command center.

---

## 1. Full inventory of planning entry points

| Entry point | Where it appears | User intent | Underlying logic | Overlaps with | Role (primary / secondary / contextual / hidden) |
|--------------|-------------------|-------------|------------------|---------------|--------------------------------------------------|
| **Project Planner (cockpit)** | Today (projects_strip, needs_attention, blocked_work, projects_if_relevant), Planner tab header, GoalCreator “Plan a Project” (if preset allows) | View/manage projects, next actions, capacity, add project | setShowProjectPlanner(true); cockpit + create flow | GoalCreator “Plan a Project”; “View in planner” / “Open planner” in many places | **Primary** for freelancer/mixed; **secondary** for employee (after day/week); **secondary** for habit (routines first) |
| **Create project (inside cockpit)** | Project Planner → Create view | Add project from scratch; name → Generate plan (slice) → edit → Create | sliceProject → buildProjectGoalFromPlan → onCreateGoals | Plan from Document (different entry, same goal shape) | **Primary** when adding project; slice is step 1 of create |
| **GoalCreator “Plan a Project”** | GoalCreator type picker | Start a big project; opens cockpit create flow | onOpenProjectPlanner(); onClose() | Project Planner create | **Secondary** (freelancer/mixed); **hidden** for habit_focused (planningEntry.showPlanAProjectInGoalCreator) |
| **Slice / Generate plan** | Project Planner create view | AI breakdown of project into phases/tasks | geminiService.sliceProject → normalizeSliceProjectParsed | planProjectFromDocument uses same normalized shape | **Contextual** (inside create flow only) |
| **Suggest my week** | Planner tab, Week view: main action row | Rule-based week fill from goals + calendar | schedulerService.autoFillWeek → review modal | Plan My Week (AI) in TimeSlicer | **Primary** week planning when primaryWeekPlanning === 'suggest' |
| **Plan My Week (AI)** | TimeSlicer WeekView | AI-generated week plan | generateWeeklyPlan → week preview → Apply | Suggest my week | **Secondary** when primaryWeekPlanning === 'suggest' (link “Or use AI to plan week”); **primary** when 'ai' |
| **Suggest day plan** | Planner tab, Day view | Rule-based today fill | schedulerService.generateDailyPlan → saveDayPlanForDate | — | **Primary** for “plan today” on Planner tab |
| **Plan today** | Today tab, TimeSlicer day view | Gentle priorities for today | Navigate / suggest day | Suggest day plan (Planner tab) | **Primary** in today context (label “Plan today”) |
| **Shape month (AI)** | Planner tab, Month view only | AI distribute tasks across month | generateMonthlyPlanTasks → pendingMonthPlan | — | **Secondary** (demoted: outline button, “Shape month (AI)”) |
| **Plan from Document** | Compost Heap → Ideas: upload doc | Create one project from PDF/Word/text | planProjectFromDocument → buildProjectGoalFromPlan → addGoal | Project Planner create (same goal builder) | **Contextual** (Compost only); does not open cockpit |
| **View in planner / Open planner** | Today sections (needs_attention, blocked_work, projects_if_relevant), Planner tab (header + Projects card) | Open project cockpit | setShowProjectPlanner(true) | Multiple identical CTAs | **Primary** once per surface (e.g. header “Open planner” on Planner tab); others **demoted** to “View in planner” link or “View projects” link |
| **GoalEditor “Create project”** | GoalEditor when Mochi suggests a project from a goal | Create child project from goal | onOpenProjectPlanner({ prefillTitle, parentGoalId }) | Project Planner create | **Contextual** |
| **Planner Coach / Auto-rebalance week** | Planner tab, Planner Coach card (when overloaded) | Rebalance week | handleAutoPlanWeek (same as Suggest my week) | Suggest my week | **Contextual** (same backend) |

---

## 2. Primary planning flow per persona

| Persona | Primary path | Rationale |
|----------|--------------|-----------|
| **Freelancer** | Dashboard → **cockpit** (what to work on today, projects strip, week capacity) → next action / schedule / weekly capacity. Week planning: **Suggest my week** (primary); “Or use AI to plan week” (secondary). | Project- and client-centric; cockpit is command center; rule-based week fill from goals. |
| **Employee** | Dashboard → **today priorities / deadlines** → Planner tab (day/week) → **Suggest day plan** / **Suggest my week**. Cockpit **secondary** (structured planning layer when needed). | Day/week planning first; projects support; cockpit for breakdown when needed. |
| **Habit-focused** | Dashboard → **routines / focus / recovery** first; **cockpit secondary** when projects exist (minimal cockpit strip + “See all projects”). GoalCreator: “Plan a Project” **hidden** (planningEntry.showPlanAProjectInGoalCreator = false). | Light and consistent; project creation is advanced, not foreground. |
| **Mixed** | Dashboard → **what to do now** → cockpit or week plan depending on priorities. **Suggest my week** or **Plan My Week** per primaryWeekPlanning. GoalCreator keeps “Plan a Project”. | Balanced; one primary CTA per surface, cockpit and week plan both reachable. |

---

## 3. Entry points demoted, merged, renamed, or removed

| Change | Before | After |
|--------|--------|--------|
| **Month planning** | “Shape month with AI” as full primary-style button | Demoted: outline button, label “Shape month (AI)”, title “Advanced: distribute tasks across the month with AI”. |
| **Planner tab Projects card** | Button “View in planner” (same visual weight as header) | Demoted: text link “View projects”; header “Open planner” is the single primary cockpit CTA on that tab. |
| **Project creation from plan** | CompostHeap and ProjectPlanner each built goal from plan inline | **Merged**: shared `buildProjectGoalFromPlan(plan, options)` in `utils/projectGoalFromPlan.js`; used by both. |
| **GoalCreator “Plan a Project”** | Already hidden for habit_focused (Phase 1/2) | No further change. |
| **Week planning** | Already one primary (“Suggest my week”) and one secondary (“Or use AI to plan week”) when primaryWeekPlanning === 'suggest' (Phase 1). | No further change. |

---

## 4. Shared logic consolidated

| Area | Consolidation |
|------|----------------|
| **Project from plan** | **buildProjectGoalFromPlan(plan, options)** in `src/utils/projectGoalFromPlan.js`. Accepts normalized plan (phases, tasks), options (titleOverride, deadline, parentGoalId, _client, _billable, shouldIncludeTask). Used by: (1) **CompostHeap** (plan from document) with titleOverride + deadline; (2) **ProjectPlanner** (create from slice) with full options and shouldIncludeTask for selectedTasks/linkedGoals. |
| **Normalized plan shape** | **normalizeSliceProjectParsed** in geminiService already shared by sliceProject and planProjectFromDocument. No change. |
| **Week planning** | Two backends (autoFillWeek vs generateWeeklyPlan) kept; one primary CTA per preset (primaryWeekPlanning) and one secondary link in TimeSlicer. No new engine. |
| **Recommendation / next step / health** | projectCockpitService + projectSupportService remain single source of truth; no parallel engines. |

---

## 5. Duplicated services/helpers/components still left

| Item | Status |
|------|--------|
| **Planner Coach “Auto-rebalance week”** | Same handler as “Suggest my week”; not duplicated, just another entry point (contextual when overloaded). |
| **PlanMonthPanel** | May still call same handlePlanMonth; if it has its own “Shape month” button, consider removing or making it a single entry (Month view action row only). **Resolved (Phase 3 final):** MonthPlanView gets onPlanMonth={undefined}; single month-planning entry is action row only. |
| **Recovery copy “Open planner”** | recoveryCopyService actionLabel; single string, no duplication. |
| **HorizonsGantt “Use Plan a Project”** | One mention in empty state; could point to cockpit; not changed. |

---

## 6. Phase 3 final cleanup (premium polish)

1. **Month-planning duplication** — Resolved. PlanMonthPanel’s MonthPlanView no longer shows a "Shape with Mochi" button. Only entry: Planner tab Month view action row "Shape month (AI)".
2. **Today-tab CTA hierarchy** — Tightened. Primary cockpit CTA: projects_strip "Open planner" (aria-label). needs_attention / blocked_work: link-style "View in planner". projects_if_relevant: text-xs + aria-label "View projects in planner".
3. **Document-to-plan handoff** — Implemented. Compost Heap success state: "View in planner" (primary) opens cockpit and focuses new project (scroll + ring); "Got it, I'll go later" (secondary). ProjectPlanner accepts focusGoalId.

## 7. Remaining gaps (optional future)

- **PlanMonthPanel (resolved)** — If it duplicates “Shape month” UI, consider one entry only (e.g. only in Planner Month view action row).
2. **Today tab** — Multiple sections (projects_strip, needs_attention, blocked_work, projects_if_relevant) each have a CTA to cockpit; we already use “Open planner” vs “View in planner” by context. Could add preset-based “primary CTA” label (e.g. employee: “Plan week” as primary on dashboard, “View in planner” for project context) if desired.
3. **Document-to-plan** — After creating project from document, optionally offer “View in planner” to open cockpit to that project (not implemented).
4. **Slice vs Plan from Document** — Both use same normalized shape and now same buildProjectGoalFromPlan; slice is inside cockpit, document is in Compost; no further merge required.

---

## 8. Files changed (Phase 3)

| File | Change |
|------|--------|
| **src/utils/projectGoalFromPlan.js** | **New.** buildProjectGoalFromPlan(plan, options) for shared project creation from normalized plan. |
| **src/components/Dashboard/CompostHeap.jsx** | buildProjectGoalFromPlan. **Final:** onViewInPlanner; createdProjectFromDoc; success "View in planner" + "Got it, I'll go later". |
| **src/components/Projects/ProjectPlanner.jsx** | buildProjectGoalFromPlan. **Final:** focusGoalId; focusRowRef + scroll + ring for focused project. |
| **src/components/Dashboard/GardenDashboard.jsx** | **Final:** projectPlannerFocusGoalId; onViewInPlanner; focusGoalId; projects_strip aria-label; projects_if_relevant text-xs. Month view: “Shape month with AI” → outline button “Shape month (AI)” with title “Advanced: …”. Planner tab Projects card: button “View in planner” → link “View projects”. |
| **src/components/Dashboard/PlanMonthPanel.jsx** | **Final:** MonthPlanView onPlanMonth={undefined}; single month-planning entry. |
| **docs/PROJECT_COCKPIT_PHASE3_PLANNING_PATHWAYS.md** | This document: inventory, primary flows, demotions, shared logic, remaining gaps. |

Acceptance: One primary planning path per persona; cockpit remains main command center; overlapping entry points reduced/demoted; project-from-plan logic unified; advanced tools (month, AI week, document) still available but not competing as primary.
