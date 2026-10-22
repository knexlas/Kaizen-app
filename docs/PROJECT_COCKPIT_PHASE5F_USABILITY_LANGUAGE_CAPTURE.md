# Phase 5F: Usability, Language, and Capture Follow-up

Goal: finish the premium-shell follow-up work that became visible after the Phase 5 shell redesign. This phase tightens readability, removes duplicated routine surfaces, improves month-planning convenience, and documents the current external capture path without overreaching into inbox integrations.

---

## Problem list

### 1. Planner support surfaces are still harder to read than they should be

- The tour tooltip can render off-screen on smaller laptop and tablet layouts.
- `Review`, `Projects`, and `Systems` exist, but their purpose is not clear enough before the user opens them.
- `Systems` currently defaults to a full management surface when it should first read as a calm support layer.
- The current routine management surface gives one action too much visual weight, which makes the rest of the row harder to scan.

### 2. Seed Bag still duplicates routine rows

- Routine templates and mirrored routine goals both reach Seed Bag.
- This causes the same routine to appear twice with different labels such as `Micro-habit` and `Routine`.
- The default Seed Bag experience should show each routine once, from one canonical source.

### 3. Month planning needs a lighter support lane

- `Unscheduled this month` and `Someday` are useful and should stay.
- Month planning still lacks a light-touch way to keep recurring supports in view.
- Routines should be visible as optional support structure, not elevated to the same status as projects or user-entered tasks.

### 4. Copy quality is uneven across the shell

- Some surfaces over-explain the same idea in multiple places.
- Other planner surfaces do not explain themselves enough.
- Terminology is inconsistent between routines, systems, support, and review.

### 5. External capture is partially implemented but not formally defined

- OmniAdd already supports pasted and shared text once it reaches the app.
- The code already accepts `share_text` and `sharedText` URL params.
- The code already accepts a `kaizen:share-text` browser event.
- Parsed event-like text already routes into the schedule-event flow.
- What does not exist yet is a real WhatsApp or email app integration, inbox sync, or a formal Web Share Target flow.

---

## Implementation order

1. Tour responsiveness and planner-systems readability
2. Seed Bag routine deduping
3. Month planner convenience upgrade
4. App-wide language pass
5. External capture integration track

---

## Copy inventory

Priority surfaces for the copy pass:

- `src/components/Dashboard/GardenDashboard.jsx`
- `src/components/Onboarding/SpiritGuideTour.jsx`
- `src/components/Dashboard/PlanMonthPanel.jsx`
- `src/components/Dashboard/TimeSlicer.jsx`
- `src/components/Dashboard/RoutinesManager.jsx`
- `src/components/Dashboard/PlannerRoutineSupportList.jsx`

Copy rules for this phase:

- one headline
- one support sentence
- action labels start with a verb
- do not repeat the same explanation in body copy and button labels
- drawer headers should stay within two lines total

Terminology defaults:

- `Review` = load, confidence, deadlines, weekly risk
- `Projects` = project structure, milestones, decomposition
- `Systems` = routines, maintenance, recurring support
- `Routine` = recurring support item
- `Someday` = deferred backlog that is not committed yet

---

## Acceptance criteria

### Tour and planner readability

- The tour card stays visible on small laptop, tablet, and mobile widths.
- On mobile, the tour card always renders as a bottom sheet with safe-area padding.
- Planner shows a compact explainer strip for `Review`, `Projects`, and `Systems`.
- `Systems` opens to a curated support surface first, not the full routine manager.
- Full routine management is still available intentionally from the systems drawer.
- Routine action rows remain readable at narrow widths.

### Seed Bag deduping

- Each routine appears once in Seed Bag.
- Routine duplicates are matched by routine identity first, then normalized title if needed.
- Seed Bag standardizes routine rows to the label `Routine`.
- Non-routine backlog items keep their current behavior.

### Month convenience

- `Unscheduled this month` and `Someday` remain in place.
- Users can still move items between `Someday` and `Unscheduled this month`.
- Users can still hand work into Week when it needs actual placement.
- Month planning adds a lighter `Routine supports` section.
- The month routine section stays visually secondary to monthly tasks and projects.

### Language

- Touched planner surfaces use shorter, non-duplicated copy.
- Drawer actions start with verbs and stay concise.
- `Review`, `Projects`, `Systems`, `Routine`, and `Someday` are used consistently.

### Capture baseline

- URL-based shared text still works through `share_text` and `sharedText`.
- `kaizen:share-text` still opens OmniAdd with the provided text.
- Event-like text still routes into the schedule-event flow.
- No behavior-breaking changes are introduced to capture parsing.

---

## External capture track

Current supported share-entry contract:

- URL params:
  - `share_text`
  - `sharedText`
- Custom event:
  - `window.dispatchEvent(new CustomEvent('kaizen:share-text', { detail: { text } }))`
- Expected normalized input:
  - raw shared text string
  - optional parsed date
  - optional parsed time
  - optional parsed participants
  - optional parsed location
- Current output path:
  - OmniAdd parses the text
  - task-like captures route into goal or inbox flows
  - event-like captures route into the schedule-event flow

Recommended next integration order after this phase:

1. Finalize and document the deep-link share-entry contract
2. Add optional Web Share Target or installed-PWA share handling if product direction still supports installation
3. Build a copied-message test matrix using WhatsApp and email-style text samples

Explicitly out of scope for Phase 5F:

- direct WhatsApp API integration
- direct Gmail inbox sync
- direct Outlook inbox sync for message capture

---

## Deferred items

- Native inbox integrations remain a separate product decision.
- Larger planner coach refactors are not part of this follow-up unless they directly unblock readability.
- Full platform-level share targets should only be implemented after the deep-link contract is stable.
