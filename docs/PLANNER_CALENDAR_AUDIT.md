# Project Planner, Day Planner & Calendar — Language & UI Audit

Audit focused on making the **Project Planner**, **Day Planner** (Staging Area / week view), and **Calendar** (WeeklyMap, Plan month) screens **professional, fast, and clear**. Metaphor-heavy or game-heavy language was reduced or moved; key information is easier to scan.

---

## What stays instantly visible

- **Active projects** — Project Planner dashboard list with client, health, deadline, hours done/planned, billable
- **Next action** — “Next: [title]” per project; “Today from this project” section with one task per project
- **Deadline risk** — “At risk” / “On track” / “No next step” badges; “Deadlines at risk” section; due date + days left
- **Hours planned / completed this week** — “Hours: X / Y done · Zh planned this week” per project; “Hours planned this week” list
- **Billable vs non-billable** — “· Billable” on project card when `_billable`
- **Stuck projects** — “No next step” badge and “No next step” section listing blocked projects
- **What to work on today** — Day Focus panel (planned blocks, “Shape your day”, backlog); week view day columns with planned hours and “Over capacity” when over

---

## 1. UI elements simplified

| Location | Before | After |
|----------|--------|--------|
| **StagingArea – day column** | Two indicators: CapacityBar (Sparks X/Y + “Pretty full”) and DayCapacityLabel (Xh / Yh) | Single **DayHoursBar**: bar + “Xh / Yh” and “· Over capacity” when over. Sparks removed from UI. |
| **StagingArea – task card** | ✦✦✦ (spark count) + optional “Kaizen” badge | “~N min” (estimated duration). Kaizen badge removed from card. |
| **StagingArea – backlog tabs** | “This Week” and “Someday / Vault” | “This Week” and **“Someday”** (Vault removed from label). |
| **WeeklyMap** | “Weekly Terrain” heading; “✨” + “Auto-Plan Week” button | **“This week”** heading; **“Distribute across week”** button (no sparkle). |
| **Project Planner – create** | “✨ Slice this project” / “Mochi is planning…” / “✨ Refine”; quoted “Mochi feedback” | **“Generate plan”** / **“Generating…”** / **“Refine”**; plan note shown as plain text, no quote styling. |
| **Plan month** | “Shaping your month...” loading text | **“Generating month plan…”** |

---

## 2. Labels changed to plain language

| Screen | Old label / copy | New label / copy |
|--------|-------------------|------------------|
| **Project Planner** | “Describe your project and Mochi will slice it into manageable goals.” | “Describe your project and we'll break it into manageable steps.” |
| **Project Planner** | “Mochi's plan didn't come through. Try again or…” | “The plan didn't generate. Try again or…” |
| **Project Planner** | “Mochi couldn't connect. Check your API key…” | “Connection failed. Check your API key…” |
| **Project Planner** | “Mochi will size subtasks to match. Experts get…” | “Subtasks will be sized to match. Experts get…” |
| **Project Planner** | “Missing something? Ask Mochi to adjust:” | “Need changes? Describe what to add or change:” |
| **Project Planner** | Task type “Kaizen” in create view | **“Task”** (Routine unchanged) |
| **StagingArea** | “Pretty full” (capacity) | **“Over capacity”** (in DayHoursBar and DayCapacityLabel) |
| **StagingArea** | “This day is looking pretty full!” (tooltip) | “Over capacity” / “Planned hours / capacity” |
| **StagingArea** | “Someday / Vault” tab | **“Someday”** |
| **StagingArea** | “Someday vault is empty. Ideas will land here by default.” | “Nothing scheduled for later. Add tasks from goals to get started.” |
| **StagingArea** | “Spawned this week” | **“Added this week”** |
| **WeeklyMap** | “Weekly Terrain” | **“This week”** |
| **WeeklyMap** | “Auto-Plan Week” | **“Distribute across week”** |
| **PlanMonthPanel** | “Shaping your month...” | “Generating month plan…” |
| **PlanMonthPanel** | “Promote from Vault or add goals.” | “Move items from Someday or add goals.” |
| **PlanMonthPanel** | “Back to Vault” | **“Back to Someday”** |

---

## 3. Game / metaphor elements moved out or reduced

| Element | Where it was | Change |
|---------|----------------|--------|
| **Sparks** | StagingArea day column (capacity bar and “X/Y Sparks”, “Pretty full”) | **Removed from UI.** Capacity is shown only as **hours** (Xh / Yh) and “Over capacity”. Internal `estimatedSparks` / `totalSparks` still used for drag-over-capacity logic where needed. |
| **Vault** | StagingArea “Someday / Vault” tab; PlanMonthPanel “Back to Vault”, “Promote from Vault” | **Renamed to “Someday” / “Back to Someday” / “Move items from Someday”** so the planner uses neutral task language. |
| **Mochi / slice** | Project Planner create flow (subtitle, errors, button, refine, feedback) | **Replaced with neutral copy**: “we'll break it into steps”, “Generate plan”, “Generating…”, “Connection failed”, “The plan didn't generate”, “Need changes? Describe…”, “Refine”. No character name in planner. |
| **✨ (sparkle)** | Project Planner “Slice this project” / “Refine”; WeeklyMap “Auto-Plan Week” | **Removed** from these planner/calendar actions. |
| **“Weekly Terrain”** | WeeklyMap heading | **Replaced with “This week”.** Weather icons (storm / leaf / sun) kept as **subtle visual** for day density; no change to bar logic. |
| **Quoted “Mochi feedback”** | Project Planner plan summary (italic quote) | Shown as **plain plan note** (no quote marks or character). |
| **Kaizen badge on task card** | StagingArea draggable task | **Removed** from card; task type “Task” in create view. Kaizen remains elsewhere in product (e.g. goal types). |

---

## Files touched

- **`src/components/Projects/ProjectPlanner.jsx`** — Subtitle, errors, skill helper, refine label, button text, task type “Task”, mochiFeedback as plain note.
- **`src/components/CommandCenter/StagingArea.jsx`** — CapacityBar replaced by DayHoursBar (hours + “Over capacity”); DayCapacityLabel updated; DroppableDayColumn uses DayHoursBar only; over-capacity uses hours when available; “Someday / Vault” → “Someday”; empty Someday copy; task card ✦ and Kaizen → “~N min”; “Spawned this week” → “Added this week”.
- **`src/components/Dashboard/WeeklyMap.jsx`** — “Weekly Terrain” → “This week”; “Auto-Plan Week” → “Distribute across week”; removed ✨ from button.
- **`src/components/Dashboard/PlanMonthPanel.jsx`** — “Shaping your month...” → “Generating month plan…”; “Vault” → “Someday” in empty state and “Back to” action.

---

## Preserved

- **Garden / world layer** — Unchanged in Now tab, Garden tab, spirit, rewards, and other surfaces.
- **Brand tone** — Moss/green accents, serif for headings, and progress summaries kept; only planner/calendar copy and capacity UI were de-metaphored for clarity.
- **Phase / milestone** — Standard PM terms left as-is in Project Planner.
- **Routine vs Task** — Routine still labeled “Routine”; non-routine tasks shown as “Task” in the create view only.
