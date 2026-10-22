# Phase 6 Domain Architecture (First Pass)

This pass keeps behavior stable while extracting domain boundaries from mega files.

## Domain map

- `assistant`: operator actions, briefing signals, chat orchestration.
- `planning`: day/week/month planning, schedule generation, plan mutation.
- `capture`: OmniAdd parsing/routing, inbox/triage intake.
- `recovery`: missed day, overload, no-next-step, restart helpers.
- `vitality`: energy, focus behavior, learned timing recommendations.
- `garden`: rewards, progression, shop, identity and 3D world.

## New modules introduced

- `src/domains/assistant/services/todayAssistantActions.js`
  - `buildTodayAssistantActions()`
  - Extracted from `GardenDashboard` to isolate assistant operator action definitions.

- `src/domains/planning/services/stagingPlanningService.js`
  - `buildBacklogTasks()`
  - `buildBacklogTree()`
  - `timeSlotToInput()`
  - `inputToTimeSlot()`
  - `getTaskDurationMinutes()`
  - `normalizeEventDurationInput()`
  - `getPlannedMinutesFromPlan()`
  - Extracted from `StagingArea` to isolate planning/backlog logic.

- `src/domains/planning/services/planningGenerationService.js`
  - `generateWeeklyPlan()`
  - `generateMonthlyPlan()`
  - `generateMonthlyPlanTasks()`
  - `rebalanceMonthQuota()`
  - Domain facade over `geminiService` planning exports.

- `src/domains/capture/services/captureAiService.js`
  - `parseOmniAddInput()`
  - `processIncomingCompost()`
  - `draftPlanFromNote()`
  - Domain facade over `geminiService` capture exports.

- `src/domains/assistant/services/spiritAssistantService.js`
  - `chatWithSpirit()`
  - `generateSpiritInsight()`
  - `generateMorningBriefing()`
  - `generateHabitSynergy()`
  - Domain facade over `geminiService` assistant exports.

## First-pass callsite updates

- `GardenDashboard` now imports planning/capture/assistant AI behaviors through domain modules.
- `GardenDashboard` now uses `buildTodayAssistantActions()` from assistant domain service.
- `StagingArea` now imports backlog/time-slot/day-plan helper logic from planning domain service.

## Why this pass is low risk

- No product behavior rewrite.
- Existing service behavior stays intact; facades wrap current implementations.
- Extractions are mostly pure logic moved from component bodies into domain modules.

## Next pass (recommended)

1. Extract `GardenDashboard` planning action handlers into `usePlanningActions` hook.
2. Extract assistant operator dispatcher into `useAssistantOperator` hook.
3. Split `TimeSlicer` scheduling selectors into `src/domains/planning/selectors`.
4. Document state ownership boundaries across `GardenContext` vs domain hooks.
