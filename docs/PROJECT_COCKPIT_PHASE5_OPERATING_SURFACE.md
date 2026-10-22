# Phase 5: Premium Operating Surface

Goal: Stop presenting Kaizen as a dashboard of features and start presenting it as a calm operating system with one main canvas, one assistant recommendation, and one universal input point.

Follow-up note: the shell redesign exposed a second pass of usability and language work across Planner, Seed Bag, Month planning, and external capture entry. That follow-up is tracked in `docs/PROJECT_COCKPIT_PHASE5F_USABILITY_LANGUAGE_CAPTURE.md` and should be treated as the active companion plan for finishing the premium operating surface.

---

## 1. Product decision

The redesign target is:

- Sunsama calm
- Structured visual clarity
- Motion decisiveness
- RISE-style quiet energy awareness

The core rule for the next shell is:

- one canvas
- one recommendation
- one input point
- everything advanced behind intent

This phase is not about adding new planning engines. The scheduling, AI planning, project decomposition, routines, and recovery systems already exist in the repo. The work is to reorganize the shell so those capabilities stop competing for attention.

---

## 2. Current diagnosis in the codebase

### Today

`src/components/Dashboard/GardenDashboard.jsx` currently renders too many default-visible surfaces inside `activeTab === 'today'`:

- daily briefing / hero
- assistant operator chip rail
- task start help
- maintenance suggestions
- social upkeep
- routine support suggestions
- must-do lane
- day map summary cards
- full `TimeSlicer` timeline
- recovery and risks
- progress footer

The app already has the right primitives, but they are all visible at once.

### Plan

`src/components/Dashboard/GardenDashboard.jsx` currently makes Planner feel like a control center instead of a studio:

- top copy + "planning context" toggle
- week/month segmented control only
- primary and AI action row
- hours summary
- week capacity
- planner coach
- domain helper card
- main workspace
- projects drawer
- maintenance drawer
- routines drawer

`src/components/Dashboard/PlanWeekPanel.jsx`, `src/components/Dashboard/PlanMonthPanel.jsx`, and `src/components/CommandCenter/StagingArea.jsx` already contain the core planning canvases, but too much secondary context surrounds them by default.

### Capture

`src/components/Dashboard/OmniAdd.jsx` already has the right mental model:

- universal capture
- parse first
- confirm once
- route intelligently

But it still presents as a floating "+" entry point and a fairly detailed modal instead of a premium persistent capture surface.

---

## 3. Target information architecture

### Today becomes: decide -> start -> adjust

Default-visible shell:

1. Slim header
2. Date
3. Quiet energy chip
4. Centered persistent capture pill
5. One assistant card only: "Best next move"
6. One central day timeline
7. Collapsed context rail with counters only

Hidden behind tap, drawer, or sheet:

- routines
- projects
- inbox
- waiting
- recovery details
- task start scaffolding
- long briefings
- multi-chip AI actions
- helper paragraphs

### Plan becomes: shape -> place -> protect

Default-visible shell:

1. Segmented switch: Day / Week / Month
2. One sentence of mode guidance
3. One primary action
4. One canvas only

Canvas by mode:

- Day -> timeline canvas
- Week -> weekly map / staging canvas
- Month -> light distribution view

Hidden behind drawers:

- Projects
- Routines
- Review

### Capture becomes: dump -> parse -> confirm

Default-visible shell:

1. Persistent top capture pill across Today and Plan
2. Keyboard shortcut remains global
3. Paste/share entry remains supported
4. One smart guess in a bottom sheet
5. Confirm or tweak, then done

Avoid on the default path:

- branching menus
- multiple competing destination choices
- advanced fields before parse

---

## 4. Execution plan by phase

### Phase 5A. Build the shared premium shell

Primary objective:

- Introduce a shared operating-surface shell for Today and Plan in `src/components/Dashboard/GardenDashboard.jsx`.

Implementation:

- Replace the floating OmniAdd trigger with a persistent header capture pill.
- Keep `CommandPalette` as the shortcut layer, but route quick capture into the same shell entry.
- Add a compact top bar that can host:
  - current date
  - energy chip
  - capture pill
  - optional mode action
- Define a shared desktop/mobile pattern:
  - desktop: center canvas + collapsible right context rail
  - mobile: center canvas + bottom sheet / swipe-up drawer

Files most affected:

- `src/components/Dashboard/GardenDashboard.jsx`
- `src/components/Dashboard/OmniAdd.jsx`
- `src/components/Dashboard/CommandPalette.jsx`
- `src/components/Dashboard/PremiumPlannerPrimitives.jsx`

Acceptance:

- Today and Plan share the same top capture affordance and shell rhythm.
- No floating "+" button remains on core screens.

### Phase 5B. Simplify Today into one operating lane

Primary objective:

- Turn Today into a briefing + one-card recommendation + one timeline.

Implementation:

- Keep one hero card only.
- Merge the current "daily briefing", "assistant operator", and "must-do lane" into a single recommendation surface.
- Use existing recommendation logic to feed it:
  - `todayChiefStart`
  - `todayMustDoLane`
  - `recommendedToday`
  - `buildTodayAssistantActions()`
- Reduce the default action set to:
  - primary: Start this
  - secondary: Make today lighter
- Keep the full `TimeSlicer` timeline as the main canvas, but remove summary-card competition above it.
- Convert task details and helper actions into sheets:
  - easier version
  - defer
  - protect
  - notes
  - start support

Default-hidden surfaces:

- task start help
- maintenance suggestions
- social upkeep
- support structure suggestions
- recovery cards
- progress footer details

Files most affected:

- `src/components/Dashboard/GardenDashboard.jsx`
- `src/components/Dashboard/TimeSlicer.jsx`
- `src/domains/assistant/services/todayAssistantActions.js`
- `src/domains/assistant/services/taskInitiationSupportService.js`

Acceptance:

- The Today screen has one obvious first action within 3 seconds.
- The timeline is the dominant visual object.
- All advanced help remains reachable without staying default-visible.

### Phase 5C. Turn Plan into a true planning studio

Primary objective:

- Make Planner feel like one canvas per mode instead of stacked planning tools.

Implementation:

- Promote Day back to a first-class planner mode.
- Rework `plannerViewMode` from `'week' | 'month'` to `'day' | 'week' | 'month'`.
- Reuse the existing `PlanDayDrawer` logic as the basis for a proper day canvas instead of only a drawer target.
- Keep one sentence under the mode switch:
  - Day: Build today
  - Week: Shape this week
  - Month: Place priorities
- Keep one primary action per mode:
  - Day: Shape today / lighten today
  - Week: Suggest my week
  - Month: Shape month
- Move the current secondary context into drawers, not inline sections.

Canvases:

- Day: timeline-first planner view using existing day-plan primitives
- Week: `PlanWeekPanel` + `StagingArea` as the main canvas
- Month: `PlanMonthPanel` with lighter monthly distribution emphasis

Files most affected:

- `src/components/Dashboard/GardenDashboard.jsx`
- `src/components/Dashboard/PlanDayPanel.jsx`
- `src/components/Dashboard/PlanWeekPanel.jsx`
- `src/components/Dashboard/PlanMonthPanel.jsx`
- `src/components/CommandCenter/StagingArea.jsx`

Acceptance:

- Planner shows exactly one main canvas per mode.
- Project, routine, review, and coach surfaces are no longer inline by default.

### Phase 5D. Move advanced capability into drawers and sheets

Primary objective:

- Preserve power without visual weight.

Implementation:

- Convert current Planner secondary sections into drawers:
  - Projects -> `HorizonsGantt` / `ProjectPlanner`
  - Routines -> `RoutinesManager`
  - Review -> deadlines, confidence, overload, waiting, maintenance
- Convert Today support sections into bottom sheets / side sheets.
- Create a compact context rail with tiny counters for:
  - Inbox
  - Waiting
  - Routines
  - Projects

Existing components to preserve behind intent:

- `src/components/Projects/ProjectPlanner.jsx`
- `src/components/Horizons/HorizonsGantt.jsx`
- `src/components/Dashboard/RoutinesManager.jsx`
- planner support and recovery cards in `GardenDashboard.jsx`

Acceptance:

- Advanced planning tools remain one tap away.
- The default shell does not look like a dashboard.

### Phase 5E. Premium interaction polish

Primary objective:

- Make the redesign feel expensive because it is decisive and quiet.

Implementation:

- Reduce default copy to one or two lines.
- Prefer sheets over extra cards.
- Use motion only for:
  - capture confirm
  - drawer open/close
  - task detail reveal
  - plan adjustment confirmation
- Tighten typography hierarchy and remove helper-paragraph clutter.
- Lower border density and let whitespace do more of the grouping.

Files likely affected:

- `src/components/Dashboard/PremiumPlannerPrimitives.jsx`
- `src/components/Dashboard/GardenDashboard.jsx`
- `src/components/Dashboard/OmniAdd.jsx`
- any shared shell CSS / utility classes already used by premium surfaces

Acceptance:

- Assistant copy is rarely longer than 2 lines.
- Core screens feel calm at first glance on desktop and mobile.

---

## 5. Concrete component mapping

| Current component / state | Current role | New role in Phase 5 |
|---|---|---|
| `GardenDashboard.jsx` | Assembles many Today and Plan surfaces inline | Owns the new operating shell and visibility model |
| `OmniAdd.jsx` | Floating capture entry + modal | Persistent capture pill + parse/confirm sheet |
| `CommandPalette.jsx` | Shortcut and action launcher | Secondary power layer; not the primary visual entry point |
| `TimeSlicer.jsx` | Timeline plus extra planning affordances | Main Today day-canvas, visually dominant |
| `PlanWeekPanel.jsx` | Week panel plus summary strip | Primary Week canvas |
| `PlanMonthPanel.jsx` | Month panel plus extra lists | Primary Month canvas, simplified |
| `PlanDayDrawer` in `StagingArea.jsx` | Drawer-only day planning flow | Basis for first-class Day mode |
| `buildTodayAssistantActions()` | Multi-chip operator action list | Feeds one recommendation card and overflow sheet |
| `ProjectPlanner.jsx` | Large inline cockpit modal | Advanced drawer / planner mode destination |
| `RoutinesManager.jsx` | Inline management section | Drawer behind context rail |

---

## 6. State and service changes

### Visibility state

Add or refactor local UI state in `GardenDashboard.jsx` for:

- open/closed context rail
- active drawer: inbox / waiting / routines / projects / review
- active bottom sheet: task detail / capture confirm / plan adjust
- planner mode: day / week / month

### Recommendation model

Introduce a small view model for Today:

- headline
- recommendation
- primary action
- secondary action
- overflow actions

This should be composed from existing signals rather than inventing a new planner engine.

Candidate inputs:

- `recommendedToday`
- `todayMustDoLane`
- overload state
- energy state
- protected time risk
- current focus item

### Capture flow

Keep the current parsing services:

- `src/domains/capture/services/captureAiService.js`
- `src/services/taskCaptureService.js`

But simplify the UI sequence:

1. input
2. parse
3. one smart guess
4. confirm

Advanced fields should stay collapsed until needed.

---

## 7. Rollout order

Recommended implementation order:

1. Shell and persistent capture
2. Today simplification
3. Planner Day/Week/Month studio
4. Drawers / context rail
5. Motion and premium polish

This order matters because the shell should be stable before moving sections behind new drawers and sheets.

---

## 8. Risks and guardrails

### Risk: losing discoverability

Guardrail:

- use tiny counters and clear drawer labels
- keep first-run tooltip guidance minimal

### Risk: too much logic still packed into one component

Guardrail:

- extract shell-specific view models and section controllers from `GardenDashboard.jsx`
- avoid making the file even larger during the redesign

### Risk: adding a new Day planner duplicates Today

Guardrail:

- Today is for deciding and starting
- Plan Day is for shaping and placing
- reuse timeline primitives, but keep intent and surrounding chrome different

### Risk: capture regresses for power users

Guardrail:

- preserve keyboard shortcut
- preserve paste/share support
- preserve structured fallback routes

---

## 9. Definition of done

The redesign is successful when:

- Today shows one recommendation card and one main timeline canvas.
- Plan shows one canvas per mode and only one primary action.
- Capture is persistent, parse-first, and confirmation-light.
- Projects, routines, review, and recovery still exist but are hidden behind intent.
- The first decision on Today takes less effort than the current build.
- The app feels calmer without feeling weaker.

---

## 10. Suggested first implementation slice

If we want the highest-value first slice with the least architectural churn:

1. Add the persistent top capture pill.
2. Collapse Today into:
   - slim header
   - one recommendation card
   - one timeline
3. Move assistant chips, start help, and recovery cards into a single overflow sheet.
4. Keep Planner mostly intact for that first slice, but add the new Day / Week / Month segmented control and begin hiding secondary context by default.

That gives the product a noticeably more premium feel before the deeper planner drawer work lands.
