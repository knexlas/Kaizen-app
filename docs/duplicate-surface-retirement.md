# Duplicate Surface Retirement Inventory

This file records duplicate surfaces retired during the consolidation pass and the canonical replacements.

## Retired Files

- `src/components/Dashboard/CalendarView.jsx`
  - Replaced by planner surfaces in `src/components/Dashboard/PlanDayPanel.jsx`, `PlanWeekPanel.jsx`, and `PlanMonthPanel.jsx`, all mounted via `src/components/Dashboard/GardenDashboard.jsx`.
- `src/components/CommandCenter/CommandCenterLayout.jsx`
  - Replaced by `src/components/Dashboard/GardenDashboard.jsx` as the active app shell.
- `src/components/Rituals/SundayRitual.jsx`
  - Replaced by `src/components/Rituals/SundayRitualController.jsx` (active route in `src/App.jsx`).
- `src/components/SundayRitual/SundayRitual.jsx`
  - Replaced by `src/components/Rituals/SundayRitualController.jsx`.
- `src/components/Rituals/GardenDashboard.jsx`
  - Placeholder duplicate replaced by `src/components/Dashboard/GardenDashboard.jsx`.

## Canonical Surfaces

- Planner shell: `src/components/Dashboard/GardenDashboard.jsx` with `PlanDayPanel`, `PlanWeekPanel`, `PlanMonthPanel`.
- Ritual flow: `src/components/Rituals/SundayRitualController.jsx`.
- Goal/task capture:
  - Shared payload normalization: `src/services/taskCaptureService.js`.
  - UI entry points: `src/components/Dashboard/OmniAdd.jsx` and dashboard Quick Add now route through a shared capture contract.
- Scheduling engine entry point: `src/services/schedulerService.js` (now exports `autoFillWeek` wrapper for migration).
