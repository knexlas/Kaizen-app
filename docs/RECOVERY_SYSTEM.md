# Recovery-Oriented Motivational System

Recovery flows reduce shame, encourage re-entry, and celebrate **restoration** (not consistency). No guilt-based streak messaging.

---

## 1. Recovery states

| State | Purpose | Trigger |
|-------|---------|--------|
| **Missed-day return** | Re-entry after not checking in (1+ days). | App opens with `lastCheckInDate !== today` → full-screen MissedDayModal. |
| **Abandoned focus session** | Recover when user exits focus without completing. | User closes focus modal without completing and without choosing “Reschedule” / “Return to plan”. |
| **Overloaded day replan** | Recover when planned work exceeds capacity. | User switches to Planner tab and `plannerLoad.ratio >= 1`. |
| **Project unsticking (no next step)** | Unblock projects that have no defined next step. | User opens Project Planner and at least one active project is `blocked` (no next step). |
| **Neglected project revival** | Re-engage projects with no recent progress. | User opens Project Planner and at least one active project has no logged progress in 7+ days. |
| **Overdue unscheduled** | (Reserved) Surface overdue tasks that aren’t on the plan. | Not yet triggered in UI; copy exists in `recoveryCopyService`. |

---

## 2. UI moments where they appear

| Recovery state | Where it appears | Format |
|----------------|------------------|--------|
| **Missed-day return** | App root, before dashboard. | Full-screen modal (MissedDayModal): “Welcome back. How’s today?” with 1 / 3 / 0 spoon options. After choice → reward “Today you have N spoons. Go gently.” and, if missed 2+ days, growth line “You’re back. Today starts now.” |
| **Abandoned focus** | Dashboard, after closing focus without completing. | Small card (top-center): “Session stopped” + “View my day” (→ Now tab) or “Later”. |
| **Overloaded day replan** | Dashboard, when opening Planner tab with overload. | Small card (top-center): “Today looks full” + “Lighten today” (→ runs lighten flow, grants LOAD_LIGHTENED + water) or “Later”. |
| **Project unsticking** | Dashboard, when opening Project Planner with blocked projects. | Small card: “Project could use one step” + “Add next step” or “Later”. Project Planner stays open. |
| **Neglected project revival** | Dashboard, when opening Project Planner with neglected projects. | Small card (moss tint): “A project hasn’t had progress in a while” + “Pick one step” or “Later”. |

All recovery cards are **brief**, **one primary action**, and **cooldown-gated** (see `helperInterventionService`).

---

## 3. Connection to planning and next steps

- **Missed-day return**  
  - Choosing spoons runs `completeMorningCheckIn` and `completeCheckInCommand` → day plan and assignments set.  
  - Reward includes `variableBonus: { waterDrops: 1 }` and optional growth line.  
  - User lands on dashboard with a plan; “Plan today” / Compass still available for next step.

- **Abandoned focus**  
  - “View my day” switches to **Now** tab so the user sees timeline and Compass (“one thing”).  
  - Task was already offered “Reschedule” / “Return to plan” inside the focus exit overlay; the card is a follow-up nudge.

- **Overloaded day replan**  
  - “Lighten today” runs `handleLightenTodayPlan` → `suggestLoadLightening`, save plan, then `buildReward(LOAD_LIGHTENED)` + `addWater(1)`.  
  - Progress is visible in garden (water) and overlay.  
  - User can then use “Plan today” or Planner to adjust further.

- **Project unsticking**  
  - Shown with Project Planner **already open**.  
  - “Add next step” dismisses the card; user stays in planner and can add a subtask or next step on the blocked project.  
  - Next-step logic lives in `nextStepService` / Project Planner UI.

- **Neglected project revival**  
  - Same context (Project Planner open).  
  - “Pick one step” dismisses the card; user can choose one neglected project and add or do one small step.  
  - Restoration is framed in copy (“Restoration counts”) and reflected when they log progress (task complete / focus complete rewards).

---

## 4. Files touched

- **`src/services/recoveryCopyService.js`** – Central recovery copy (RECOVERY_COPY, NEGLECTED_PROJECT_COPY, MISSED_DAY_MODAL, getReturnGrowthLine).
- **`src/services/helperInterventionService.js`** – Added `NEGLECTED_PROJECT_REVIVAL`; purpose, priority, cooldown.
- **`src/services/projectSupportService.js`** – `getNeglectedProjects(goals, logs, daysInactive)`.
- **`src/services/dopamineEngine.js`** – `MORNING_CHECKIN_DONE` accepts `missedDays` and sets growth line “You’re back. Today starts now.” when `missedDays > 1`.
- **`src/App.jsx`** – `handleMissedDayChoose` computes `missedDays` (before check-in) and passes to `buildReward(MORNING_CHECKIN_DONE, { spoonCount, missedDays })`.
- **`src/components/Onboarding/MissedDayModal.jsx`** – Subtitle mentions “Your garden is still here”; option labels shortened (no “plan” in 1-spoon, “just capture” for 0).
- **`src/components/Dashboard/GardenDashboard.jsx`** – Imports recovery copy and `getNeglectedProjects`; triggers `NEGLECTED_PROJECT_REVIVAL` when opening project planner with neglected projects; recovery cards use RECOVERY_COPY / NEGLECTED_PROJECT_COPY and **one clear action** (View my day, Lighten today, Add next step, Pick one step); “Lighten today” path uses `buildReward(LOAD_LIGHTENED)` and `addWater(1)`.

---

## 5. Principles

- **Plain, kind language** – No blame; “when you’re ready”, “no guilt”, “Your garden is still here.”
- **Brief interventions** – Short title + one sentence + one primary button (+ “Later”).
- **One clear recovery action** – Each card has a single main CTA that does something concrete (switch tab, lighten plan, stay in planner).
- **Progress in garden** – Water/embers and reward overlay reflect recovery actions (check-in, lighten, reschedule, complete task).
- **No streak punishment** – Missed-day flow never mentions “streak” or “lost”; it only offers “Welcome back” and “You’re back. Today starts now.”
