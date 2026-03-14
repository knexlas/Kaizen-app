# Garden / World / Progression — Project & Planning State

The garden visually reflects **real project and planning behavior** rather than generic activity. It avoids fake positivity: when the project system is messy, the garden does not show everything as thriving. Representation is **motivating and gentle**, not punitive.

---

## 1. What project states affect the garden

| Project / planning state | Garden state | How it's shown |
|--------------------------|--------------|----------------|
| **Active, recent progress** | `nurtured` | Normal plant: full color soil, no droop, scale 1. Progress % drives growth size. |
| **No logged activity in 7+ days** | `neglected` | **Dormant**: grey soil (`#a8a29e`), slight droop (0.25, 0, 0.2), scale 0.85. Plant is "resting," not dead. |
| **Was neglected, then activity in last 3 days** | `restored` | **Back to life**: normal soil, no droop, scale 1.02. Slight emphasis. |
| **Project has no next step (blocked)** | `stuck` | **Gentle wilt**: darker soil (`#57534e`), small droop (0.12, 0, 0.08). No grey—still clearly present. |
| **Planning rhythm** | (summary only) | `getGardenSummary` exposes `planningRhythmHealthy` (check-in today + plan this week). Not yet used for global garden visuals; available for future (e.g. sky or overall tone). |

**Data sources**

- **Activity:** `logs` (taskId, date). Last activity per goal = latest log entry for that goal.
- **Stuck:** `getProjectHealth(goal) === 'blocked'` (from projectSupportService: no next step).
- **Neglected:** No log for that goal in the last 7 days.
- **Restored:** Was neglected (no activity 7+ days) and has activity in the last 3 days.

Routines and non-project goals use the same activity rule (last log); only projects use the "stuck" (blocked) state.

---

## 2. What user actions drive visible growth

| User action | Effect on garden / progression |
|-------------|--------------------------------|
| **Log focus time (complete a session)** | Goal gets a new log entry → last activity updates → if was neglected, state can become `restored` or `nurtured`. Progress % can increase → plant growth scale increases (existing `getGoalProgressPercent`). |
| **Water a goal (in garden)** | `lastWatered` updated; existing "thirsty" logic in ProceduralFlora (48h) is overridden by garden state when we use `gardenState` (neglected/restored/stuck). Watering still gives embers and refreshes the plant. |
| **Add / complete a next step (project)** | Project health can move from `blocked` to `on_track` → garden state from `stuck` to `nurtured` (on next render). Progress % can increase. |
| **Check in (set energy for the day)** | `lastCheckInDate` updates → `getGardenSummary(...).planningRhythmHealthy` can become true when there is also plan data. |
| **Plan the week / add to day plan** | `weekAssignments` (or equivalent) updates → planning rhythm in summary can reflect "healthy" when combined with recent check-in. |
| **No activity for 7+ days on a goal** | Next time garden state is computed, that goal becomes `neglected` → plant shows dormant (grey soil, droop, smaller). |
| **Return after neglect (log time again)** | Goal moves to `restored` (if within 3 days) or `nurtured` → plant back to normal or slightly emphasized. |

So: **meaningful sessions** (logged focus), **defining/doing next steps**, and **planning/check-in** are what move the garden toward "nurtured" and "restored"; **no activity** and **stuck projects** are reflected as dormant or gentle wilt, not as fake bloom.

---

## 3. How neglected or stuck work is represented (gently)

- **Neglected (no recent activity)**  
  - **Visual:** Dormant plant: grey soil, slight forward/side droop, 85% scale. Reads as "resting" or "paused," not dead or broken.  
  - **Copy (goal detail panel):** "No recent activity — it's still here when you're ready."  
  - **Summary line (when any neglected):** "X haven't had recent activity — still here when you're ready."

- **Stuck (no next step)**  
  - **Visual:** Gentle wilt: darker stone-like soil, small droop. Still clearly a plant.  
  - **Copy (goal detail panel):** "No next step — add one in Project Planner when you're ready."  
  - **Summary line (when any stuck):** "X could use a next step when you're ready."

- **Restored (just picked up again)**  
  - **Visual:** Normal or slightly larger (1.02 scale), no droop.  
  - **Copy (goal detail panel):** "Recently picked up again."

We avoid:

- Harsh or guilt-heavy wording (no "you failed," "behind," or "lost").
- Making plants disappear or look "dead."
- Streak or punishment logic.

The relationship is: **work and planning state drive garden state; garden state is visible and understandable; the tone is supportive and re-entry focused.**

---

## 4. Files touched

- **`src/services/gardenStateService.js`** (new) — `getLastActivityForGoal`, `getGoalGardenState`, `getGardenSummary`, `getGardenStateLabel`, `GOAL_GARDEN_STATE`.
- **`src/components/Garden/ProceduralFlora.jsx`** — Accepts `gardenState`; applies dormant / gentle wilt / restored visuals from state (plus existing thirsty from lastWatered).
- **`src/components/Garden/Garden3D.jsx`** — Reads `logs` from context; computes `gardenStateByGoalId` with `getGoalGardenState(goal, logs, getProjectHealth)`; passes `gardenState` into `GoalNode` → `ProceduralFlora`; `Scene` receives `gardenStateByGoalId`.
- **`src/components/Garden/GardenWalk.jsx`** — Uses `getGardenSummary` for a one-line summary when there are neglected or stuck goals; uses `getGoalGardenState` and `getGardenStateLabel` in the goal detail panel to show gentle copy for non-nurtured states.

---

## 5. Summary table

| Garden state | Trigger | Visual | Message tone |
|--------------|---------|--------|--------------|
| **Nurtured** | Recent activity (log in 7 days), not stuck | Normal | — |
| **Neglected** | No log for goal in 7+ days | Dormant (grey, droop, 0.85) | "Still here when you're ready." |
| **Restored** | Was neglected, then activity in last 3 days | Normal / slight emphasis (1.02) | "Recently picked up again." |
| **Stuck** | Project with no next step (blocked) | Gentle wilt (dark soil, small droop) | "Add one in Project Planner when you're ready." |
