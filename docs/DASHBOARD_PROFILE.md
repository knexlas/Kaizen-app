# Dashboard profile (home / Today tab)

The main dashboard (Today tab) shares a common structure but adapts **content priority** and **visible sections** based on the user’s **stored onboarding preferences** (role and primary use case). No separate codebases; one layout with profile-driven section order and reuse of existing widgets.

## How profile is chosen

- **Source**: Same as planner preset: `userSettings.plannerPreset` (explicit) or derived from `onboardingRole` / `onboardingUseCase`.
- **Profiles**: `freelancer`, `employee`, `habit_focused`, `mixed`.
- **Derivation**: Freelancer role or freelance use case → freelancer; Employee or work_projects → employee; Habits use case → habit_focused; Creative role or mix use case → mixed (default).

## Shared dashboard structure

- **When `needsMorningCheckIn`**: Full-screen daily check-in (energy/spoons) first; same for all profiles.
- **After check-in**: Two-column layout (on large screens):
  - **Left column (lg:col-span-5)**: Ordered list of sections. Section set and order come from `getDashboardSectionOrder(profile)`. Each section id maps to one block (hero, compact card, or list). Sections not in the order are hidden; sections that render no content (e.g. empty list) return `null`.
  - **Right column (lg:col-span-7)**: Fixed “Your day” — timeline (TimeSlicer), optional continuity summary (sessions, week tending, garden impact), and SpiritProgression when “Show details” is on.

## What changes by profile

### Freelancer

1. **What to work on today** — Hero: cockpit “today” recommendation (`getRecommendedTaskForToday`) with “Start focus” and “View today plan”.
2. **Active client projects** — Compact strip: active project count, one-line today task, “Open Project Planner”.
3. **Week capacity** — Available / planned / remaining hours; overplanned warning.
4. **Billable vs non-billable** — Planned hours split.
5. **Needs attention** — Short list (no next step, overdue, deadline risk, overplanned) + “View in Project Planner”.
6. Briefing (if any), then Your day.

### Employee

1. **Today’s priorities** — Hero: `nowRecommendation` (state line + primary CTA + fallback).
2. **Calendar & deadlines** — Upcoming goal deadlines + next events; “Plan week”.
3. **Blocked work** — Count of stuck/blocked projects; “Open Project Planner”.
4. **Deep work suggestion** — Small block with same `nowRecommendation` CTA.
5. **Weekly plan** — “Plan my week” → Planner tab.
6. Briefing (if any), then Your day.

### Habit-focused

1. **Check-in prompt** — Placeholder (no extra card after check-in).
2. **Routines today** — List of today’s rituals (from `todayRitualItems`).
3. **Focus suggestion** — Hero: `nowRecommendation` with “Focus suggestion” heading.
4. **Recovery** — Only when overloaded: “Lighten my plan” CTA.
5. **Projects if relevant** — If any active projects, link “Projects (N)” → Project Planner.
6. Briefing (if any), then Your day.

### Mixed

1. **What to do now** — Hero: `nowRecommendation` with profile heading.
2. **Active projects** — Same strip as freelancer.
3. **Week capacity** — Same as freelancer.
4. **Routines today** — Same as habit.
5. **Needs attention** — Same as freelancer.
6. Briefing (if any), then Your day.

## Code: reuse vs new

- **Reused**
  - **Planner preset**: `getPlannerPreset` (from `plannerPresets.js`) is used as dashboard profile; no second “dashboard role” model.
  - **Project cockpit service**: `getRecommendedTaskForToday`, `getWeekCapacitySummary`, `getNeedsAttention`, `getWeekCapacityHours`, `getLoggedMinutesThisWeekByGoal`, `getWeekDateStrings` — all used on the dashboard for freelancer/employee/mixed strips.
  - **Existing widgets**: “What to do now” hero (nowRecommendation), morning briefing, continuity summary, TimeSlicer (Your day) — same components; only order and visibility change by profile.
  - **Data**: `todayRitualItems`, `goalBank`, `events` (weeklyEvents), `continuitySummary`, `nowRecommendation`, `runStartFocus`, `setShowProjectPlanner`, `setActiveTab` — all existing.

- **New**
  - **`src/constants/dashboardProfile.js`**: `getDashboardProfile`, `getDashboardSectionOrder`, `getDashboardPrimaryHeading`, and the section-order arrays per profile.
  - **Dashboard cockpit data in GardenDashboard**: `recommendedToday`, `weekCapacity`, `needsAttention`, `activeProjects`, `blockedProjectsCount`, `upcomingDeadlines` (useMemos calling projectCockpitService / projectSupportService / goals).
  - **Section blocks in the Today tab**: Single left-column loop over `dashboardSectionOrder`; for each `sectionId`, one conditional block that renders the corresponding card (projects strip, week capacity, billable strip, needs attention, calendar_deadlines, blocked_work, deep_work_suggestion, weekly_plan_link, routines_today, recovery, projects_if_relevant) or the shared hero (with profile-specific heading and, for freelancer, cockpit “what to work on today” when `recommendedToday` exists). No new components; only inline sections keyed by `sectionId`.

Planning screens (Planner tab, Project Planner modal) are unchanged and stay clear and professional; adaptation is limited to the Today (home) tab.
