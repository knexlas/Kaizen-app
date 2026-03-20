# Domain Architecture

This app is being refactored around product domains instead of central screens.

## Domains

### Assistant
- `src/domains/assistant/services/aiClient.js`
- `src/domains/assistant/services/spiritAssistantService.js`

Owns:
- AI transport and model fallback
- spirit chat
- morning briefing generation
- assistant insight generation
- small proactive assistant helpers

### Planning
- `src/domains/planning/hooks/usePlanningSnapshot.js`
- `src/domains/planning/services/planningAiService.js`

Owns:
- week-level planning summaries
- recommendation inputs for Today and Plan
- task decomposition / note-to-plan AI helpers

### Today
- `src/domains/today/hooks/useTodayBriefingModel.js`

Owns:
- assistant-briefing view model
- must-do lane derivation
- recovery strip derivation
- Today-specific composition logic

### Vitality
- `src/domains/vitality/hooks/useLearnedEnergyProfile.js`

Owns:
- learned timing profile
- focus/admin/low-energy recommendation derivation

### Garden
- stays primarily in existing garden components and `GardenContext` for now
- next pass should separate progression/rewards from world rendering/state

### Capture / Recovery
- still partially mixed into central files
- next pass should extract routing, staging, and recovery selectors into domain modules

## State Ownership Map

- `GardenContext`
  - persisted goals, plans, routines, rewards, garden state
- `EnergyContext`
  - self-reported energy and learned behavior history
- `GardenDashboard`
  - view orchestration and modal control
- domain hooks
  - derived read models for Today, Planning, and Vitality
- domain services
  - AI and pure transformation logic

## First Extraction Pass

Completed:
- extracted planning snapshot derivation from `GardenDashboard`
- extracted learned energy derivation from `GardenDashboard`
- extracted assistant AI client and spirit-oriented AI helpers
- extracted planning AI helpers for task decomposition and draft-plan generation
- added shared dashboard helper file to start removing local utility duplication

Next recommended pass:
- fully wire `useTodayBriefingModel` into `GardenDashboard`
- split `geminiService` into compatibility exports plus domain implementations
- extract `StagingArea` scheduling selectors into planning/capture domains
- split `GardenContext` into garden/progression state vs planning state adapters
