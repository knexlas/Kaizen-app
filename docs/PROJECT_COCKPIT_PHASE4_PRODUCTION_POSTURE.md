# Phase 4: Production Posture and Premium Polish

Goal: Make the app feel release-grade and premium in its shell, interaction quality, and product presentation—without new features, planning engines, or gamification.

---

## 1. App-shell and release assets

| Change | Before | After |
|--------|--------|--------|
| **Document title** | `kaizen-app` | `Kaizen Garden` |
| **Favicon** | `/vite.svg` | `/favicon.svg` (leaf/brand icon) |
| **Manifest** | None | `public/manifest.json` with name, short_name, description, theme_color, icons |
| **Meta** | — | `theme-color`, `description`, `apple-touch-icon`, `manifest` link |
| **Loading state** | "Loading…" | "Loading your garden…" with 🌱 and role="status" |
| **Error boundary** | "Oops! A vine got tangled" + visible error/stack | "Something went wrong" + reassurance; diagnostic block in collapsible "Technical details (for support)" |

---

## 2. Browser-native interactions replaced

All `window.confirm`, `window.prompt`, and `window.alert` in the product UI were replaced with in-app modals.

| Location | Before | After |
|----------|--------|--------|
| **HorizonsMetrics** | `window.confirm('Drain this pond?')` | `showConfirm({ message, confirmLabel: 'Drain', destructive: true, onConfirm })` |
| **TimeSlicer (GoalMenu)** | `window.confirm('Return this energy...')` | `showConfirm({ message, confirmLabel: 'Compost', destructive: true, onConfirm })` |
| **TimeSlicer (SeedChip)** | `window.prompt('Project name?')` | `showPrompt({ title, message, submitLabel: 'Add', onSubmit })` |
| **GoalEditor** | `window.prompt('New metric name...')` | `showPrompt({ title: 'New metric', message, placeholder, submitLabel: 'Add', onSubmit })` |
| **HorizonsNarrativeBoard** | `window.confirm('Delete this goal?')` | `showConfirm({ message, confirmLabel: 'Delete', destructive: true, onConfirm })` |
| **GardenDashboard** | `window.confirm('Disconnect Google/Outlook?')` | `showConfirm({ message, confirmLabel: 'Disconnect', destructive: true, onConfirm })` |
| **GardenDashboard (Outlook error)** | `window.alert(err + hint)` | `kaizen:toast` with user-safe message |
| **HorizonsGantt** | 3× confirm (delete project, delete phase, delete task), 4× prompt (phase title, week range, task title, new task) | All use `showConfirm` / `showPrompt` |
| **GardenWalk** | `window.prompt('Extend deadline to (YYYY-MM-DD)')` | `showPrompt({ title: 'Extend deadline', message, defaultValue, placeholder, submitLabel: 'Save', onSubmit })` |
| **RoutinesManager** | `window.confirm('Remove this routine?')` | `showConfirm({ message, confirmLabel: 'Remove', destructive: true, onConfirm })` |
| **SettingsView** | `window.confirm` (import backup, delete all data) | `showConfirm` for both |
| **EventPruner** | `alert('Please connect Calendar...')` | `kaizen:toast` with "Connect your calendar in Dashboard first, then try again." |

**New shared pieces:** `DialogContext` (`useDialog()`), `ConfirmModal`, `PromptModal`; modals rendered inside `DialogProvider` in `main.jsx`.

---

## 3. User-facing copy and error-state improvements

| Area | Change |
|------|--------|
| **Calendar disconnect** | Confirm messages: "Disconnect Google Calendar? Your events will no longer sync here." (same for Outlook). |
| **Outlook connect failure** | No longer show redirect URI / env hint; toast: "Couldn't connect to Outlook. Check your calendar settings or try again later." |
| **Outlook setup hint (menu)** | "Outlook requires one-time setup. Ask your admin if you don't see events." |
| **AI/API errors** | All user-visible messages that mentioned `VITE_GEMINI_API_KEY` or `.env` replaced with "Check Settings or try again later." (GardenDashboard, ProjectPlanner, HorizonsNarrativeBoard). |
| **Settings Mochi** | "Mochi needs an API key to work. Add your key in your environment or config, then use Test connection below." |
| **Error boundary** | Headline "Something went wrong"; body "We hit a snag. Refreshing the app usually fixes it. Your data is saved locally."; diagnostics in collapsible "Technical details (for support)". |

Recovery, missed-day, and helper copy were already using `recoveryCopyService` and `helperCopy` (tone-aware); no change required for Phase 4.

---

## 4. CTA and modal consistency

- **ConfirmModal / PromptModal:** Primary action (Confirm / Submit) uses filled button (moss or destructive rose); Cancel uses outline. Escape closes; overlay click closes.
- **DialogProvider** wraps the app so any screen can call `useDialog().showConfirm` / `showPrompt` without prop drilling.
- Primary/secondary hierarchy on dashboard and planner was already established in Phase 3 (e.g. "Open planner" primary, "View in planner" links secondary). No structural CTA changes in Phase 4.

---

## 5. Production posture (diagnostics out of user layer)

- Error boundary: Raw error and component stack moved into a collapsible "Technical details (for support)" section.
- Calendar and AI errors: No redirect URIs, env var names, or ".env" in toasts or alerts.
- Settings: Mochi section describes key setup in user terms; Outlook setup hint in calendar menu is one short line.

---

## 6. Files changed

| File | Change |
|------|--------|
| **index.html** | Title "Kaizen Garden"; favicon + apple-touch-icon + manifest link; theme-color; description meta. |
| **public/favicon.svg** | New: minimal leaf/brand icon. |
| **public/manifest.json** | New: name, short_name, description, start_url, display, theme_color, icons. |
| **src/main.jsx** | Wrap app in `DialogProvider`. |
| **src/context/DialogContext.jsx** | New: `DialogProvider`, `useDialog`, confirm/prompt state, render `ConfirmModal` and `PromptModal`. |
| **src/components/ConfirmModal.jsx** | New: in-app confirm dialog (title, message, confirm/cancel, destructive style, Escape/overlay close). |
| **src/components/PromptModal.jsx** | New: in-app prompt dialog (title, message, input, submit/cancel). |
| **src/App.jsx** | Loading state: "Loading your garden…" + icon; role/aria. |
| **src/components/ErrorBoundary.jsx** | Friendly headline/body; error/stack in collapsible "Technical details (for support)". |
| **src/components/Dashboard/GardenDashboard.jsx** | `useDialog`; calendar disconnect + Outlook error use `showConfirm` and toast; Outlook setup hint shortened; AI error toasts user-safe. |
| **src/components/Dashboard/SettingsView.jsx** | `useDialog`; import and delete-all use `showConfirm`; Mochi copy user-safe. |
| **src/components/Dashboard/TimeSlicer.jsx** | `useDialog` in GoalMenu and SeedChip; compost confirm and project-name prompt. |
| **src/components/Dashboard/RoutinesManager.jsx** | `useDialog`; remove routine uses `showConfirm`. |
| **src/components/Goals/GoalEditor.jsx** | `useDialog`; new metric uses `showPrompt`. |
| **src/components/Horizons/HorizonsMetrics.jsx** | `useDialog`; drain pond uses `showConfirm`. |
| **src/components/Horizons/HorizonsNarrativeBoard.jsx** | `useDialog` in NarrativeCard; delete goal uses `showConfirm`; error message user-safe. |
| **src/components/Horizons/HorizonsGantt.jsx** | `useDialog`; all delete/rename prompts use `showConfirm` / `showPrompt`. |
| **src/components/Garden/GardenWalk.jsx** | `useDialog`; extend-deadline uses `showPrompt`. |
| **src/components/Rituals/EventPruner.jsx** | Calendar-not-connected: `kaizen:toast` instead of `alert`. |
| **src/components/Projects/ProjectPlanner.jsx** | Slice error message user-safe. |

---

## 7. Remaining issues (optional later)

- **CTA hierarchy audit:** Could formalize primary/secondary/tertiary button classes in a shared component or design token set.
- **Feedback button:** Still labeled "Beta Feedback" when `VITE_FEEDBACK_EMAIL` is set; could be renamed to "Feedback" or "Send feedback" for release.
- **Gemini test connection:** `testMochiConnection` in geminiService still returns a message that may mention API key; that is only shown in Settings when testing—acceptable for now.
- **Horizons / Gantt:** No further UX changes; all native dialogs removed.

Acceptance: App shell and branding intentional; no browser-native prompt/confirm/alert in product UI; user-facing errors and empty states polished; diagnostics relegated to support section; CTA hierarchy consistent with Phase 3.
