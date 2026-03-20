# Gamification Layer Audit

**Scope:** All reward systems, progress displays, spirit/garden metaphor, celebrations, streaks, helper language, and motivational overlays.  
**Core utility:** capture → plan → start → focus → recover → review progress.  
**Priorities:** Freelancer/employee usability over novelty; calm, confidence-building over noisy rewards.

---

## 1. Table of gamification mechanics

| # | Mechanic | Bucket | Behavior reinforced | Where it appears | Helps or delays action | Recommendation |
|---|----------|--------|---------------------|------------------|------------------------|----------------|
| 1 | **Reward overlay (pushReward)** | 1 | Confirms actions (task done, focus complete, compost added). | RewardOverlay (bottom center); triggered from GardenDashboard, TimeSlicer, CompostHeap, OmniAdd, FocusSession completion, etc. | **Helps** – single, consistent feedback; reinforces completion. | **Keep** – core feedback channel. |
| 2 | **FOCUS_COMPLETE / water + embers** | 1 | Finishing a focus session; ties to “water the garden” and optional embers. | After Tea Ceremony / in-session rating; dopamineEngine + RewardOverlay. | **Helps** – clear “session done” signal; water/embers are secondary. | **Keep** – simplify copy to “Session complete” + 1 line; de-emphasize “+N Water” / “+N Embers” in overlay. |
| 3 | **TASK_COMPLETE (mark done from plan)** | 1 | Completing a planned task from timeline/anytime. | TimeSlicer complete-from-plan flow; buildReward(TASK_COMPLETE) + pushReward. | **Helps** – reinforces “done” and supports review. | **Keep** – ensure message is short (“Task completed” / “Nice — [goal] done.”). |
| 4 | **Vibe buttons (Energized / Drained)** | 1 | Quick post-task energy log for recovery/insights. | RewardOverlay when task completed from plan (vibePayload + onVibe). | **Helps** – lightweight recovery signal without leaving flow. | **Keep** – optional, non-blocking; consider shortening label to “Energized / Drained” only. |
| 5 | **Spoon battery (WoodenSpoon + daily capacity)** | 1 | Planning within energy; prevents overplanning. | TimeSlicer header (spoon icons), capacity from dailySpoonCount / check-in. | **Helps** – core plan/recover utility. | **Strengthen** – keep visible; ensure “planned vs capacity” is obvious in Plan today flow. |
| 6 | **Continuity summary (today/week sessions, tending days)** | 1 | Gentle “you showed up” without streak pressure. | Now tab (Today / This week session counts, “tended the garden N days”). | **Helps** – review progress; “rhythm not streak” is good. | **Keep** – already calm; avoid adding streak penalties. |
| 7 | **Morning check-in + plan reaction** | 1 | Set energy for the day; optional auto-plan. | MorningCheckIn modal; getPlanReaction (spirit message after check-in). | **Helps** – plan + recover entry point. | **Keep** – reaction copy can be shortened (see Mochi language). |
| 8 | **Daily Plan Ritual (Plan today / Shape your day)** | 1 | Choose what fits, see capacity, get “Do this first.” | Header “Plan today” button; PlanDayPanel “Shape your day”; DailyPlanRitual modal. | **Helps** – plan + start. | **Strengthen** – make it the default “shape the day” path; keep copy non-judgmental. |
| 9 | **Helper interventions (no next step, overload, focus abandoned)** | 1 | Unblock, clarify, recover. | NextStepPrompt, HabitStackHandoff, SupportSuggestionCard, FOCUS_ABANDONED, OVERLOADED, NO_NEXT_STEP cards. | **Helps** – decision support. | **Keep** – already gated by cooldown; keep copy short. |
| 10 | **Compost + “Compost paid off” bonus** | 2 | Capture thoughts; optional ember bonus when completing focus after using compost. | CompostHeap; GardenDashboard on focus complete (soilNutrients, consumeSoilNutrients, pushReward). | **Neutral** – delight for compost users; small delay (one toast). | **Simplify** – keep “Added to compost” / “Compost paid off”; drop or shorten “♻️✨” and extra ember line if lowStim. |
| 11 | **Tea Ceremony (post-session reflection + “X min logged”)** | 1 | Close focus loop; log time; optional rating. | FocusSession completion → TeaCeremony (rating, note, “X min logged”, Sip & Finish). | **Helps** – focus + review. | **Keep** – “Session complete” + “X min logged” is strong; ember gathering is delight. |
| 12 | **Tea Ceremony “You gathered X Embers”** | 2 | Reward for time spent; ties to Spirit Shop. | TeaCeremony success screen (embers earned, particles). | **Delight** – can feel like required step before closing. | **Simplify** – show “Session complete” + “X min logged” first; Embers as one short line or move to Settings/Shop only. |
| 13 | **Spirit Points + Spirit Progression (Seed → Spirit Keeper)** | 3 | Long-term “growth” from focus minutes. | SpiritProgression in Now tab sidebar; Settings; spiritProgressionService tiers. | **Neutral** – progress feel; not needed for core actions. | **Move** – show in Settings or Garden only; remove from main Now tab to reduce noise. |
| 14 | **Embers currency + Spirit Shop** | 3 | Spend focus “earnings” on decorations, seeds, animals. | SpiritShop (Garden); earnEmbers in TeaCeremony, focus complete, compost bonus, WanderingCreature pet. | **Delight** – optional; can distract from “what’s next.” | **Tone down** – keep earn/spend in backend; don’t push “+N Embers” front-and-center after every focus. |
| 15 | **WanderingCreature “pet for +1 Ember”** | 4 | Pet creature in 3D garden for ember. | GardenWalk → WanderingCreature; toast “You pet the Spirit! ❤️ +1 Ember”. | **Delays** – encourages playing in garden instead of planning/focus. | **Remove or hide** – remove ember reward for petting; keep pet as delight only (no currency). |
| 16 | **Harvest confetti (task card “Harvested”)** | 3 | Marking a slot as “done” / harvested; celebration. | TimeSlicer task cards (confetti on “Harvested” / Over-water); canvas-confetti; disabled when lowStim. | **Mixed** – reinforces “done” but can be loud. | **Simplify** – keep “Harvested” state and button; confetti off by default or only in “celebrate” mode in settings. |
| 17 | **First-run / Welcome confetti** | 2 | First micro-win in onboarding. | WelcomeGarden, FirstRunFlow (canvas-confetti). | **Delight** – one-time. | **Keep** – harmless; respect lowStim (already in accessibility). |
| 18 | **Vibrate on celebration** | 2 | Haptic on focus complete, harvest, etc. | FocusSession, GardenContext (milestone complete); vibration.js. | **Helps** – tactile confirmation. | **Keep** – ensure it’s optional (accessibility). |
| 19 | **Growth line / second line on rewards** | 2 | “Your [goal] has grown a little,” “Short sessions count,” “You came back.” | RewardOverlay (growthLine); dopamineEngine; GardenDashboard (growthParts). | **Helps** – confidence without pressure. | **Keep** – keep one short line; avoid stacking multiple growth lines. |
| 20 | **Mochi/Spirit speech bubble (contextual)** | 2 | Weather, overload, post-session advice. | MochiSpiritWithDialogue; getSpiritGreeting, getSpiritAdvice; Now tab. | **Helps** – contextual nudge (overload, rest). | **Keep** – keep copy short (“One step at a time,” overload/rest hints). |
| 21 | **Spirit dialogue (post check-in / post focus)** | 3 | Full-screen spirit message after check-in or focus. | showSpiritDialogue + displaySpiritMessage (check-in reaction, load lightened, auto plan, garden comment). | **Delays** – blocks view for several seconds. | **Tone down** – show as small toast or inline message instead of full overlay; or shorten to 2–3s. |
| 22 | **lastGardenImpact (“Garden: +1 Water” etc.)** | 3 | Shows last water/growth impact in Now tab. | GardenDashboard Now tab compact line “Garden: {lastGardenImpact.text}”. | **Neutral** – reminder of “garden” effect; metaphor-heavy. | **Simplify** – optional or remove; if kept, use plain language (“Recent: task completed”). |
| 23 | **Spirit Builder / Spirit Origins** | 2 | Choose spirit identity (name, type); first-run. | SpiritOrigins, SpiritBuilder; first-run and Mirror (settings). | **Delight** – identity; one-time or rare. | **Keep** – harmless; skip option already exists. |
| 24 | **Spirit Guide Tour (steps)** | 1 | Learn Compass, Day, Plant seed, Mochi chat. | SpiritGuideTour, FeatureTooltip; GUIDE_STEPS, SHORT_TOUR_STEPS. | **Helps** – onboarding. | **Keep** – ensure steps are skippable and short. |
| 25 | **App Guide (Day 1 Guide tooltips)** | 1 | Post-tour tips (Plan, horizons, etc.). | FeatureTooltip + appGuideStep; GardenDashboard. | **Helps** – plan/capture. | **Keep** – low frequency. |
| 26 | **ACTIVATION_* rewards (You showed up, Short sessions count, You came back)** | 1 | Start and resume; reduce shame. | dopamineEngine; FocusSession start, short session, resume. | **Helps** – start + recover. | **Keep** – confidence-building; keep messages short. |
| 27 | **FOCUS_PERSEVERANCE (“Wow, this seed had deep roots!”)** | 4 | Logging more time than estimated. | buildReward(FOCUS_PERSEVERANCE); GardenDashboard when subtask completed over estimate. | **Delays** – long, metaphor-heavy message; draws attention to “extra” reward. | **Remove or simplify** – remove or replace with one line: “You put in more time than planned.” No ember call-out. |
| 28 | **MILESTONE_COMPLETE + “Fertilizer applied. +15 min growth”** | 3 | Completing a goal milestone. | GardenContext toggleMilestone; buildReward(MILESTONE_COMPLETE). | **Mixed** – celebrates milestone but “fertilizer” is metaphor noise. | **Simplify** – “Milestone: [title]”; drop growthLine or make it “Progress saved.” |
| 29 | **Synergy suggestion modal (“Optional: pair with a habit”)** | 2 | After goal create; suggest habit pairing. | GardenDashboard synergySuggestion state; AI generateHabitSynergy. | **Neutral** – optional; can interrupt flow. | **Keep** – already optional and downgraded; ensure one per goal and dismissible. |
| 30 | **Evening Wind Down (gratitude, defer, rest)** | 1 | Recover; defer unfinished; optional gratitude. | EveningWindDown modal; addSmallJoy. | **Helps** – recover + review. | **Keep** – calm fork; avoid adding rewards. |
| 31 | **Garden / 3D world (progress, flora, creatures)** | 2 | Visual progress of goals; optional exploration. | GardenWalk, Garden3D, ProceduralFlora, getGoalProgressPercent. | **Delight** – review progress in a different lens. | **Keep** – optional tab; don’t gate core actions behind garden. |
| 32 | **Compass “one thing” + next step** | 1 | Single “what to do first” from plan. | CompassWidget, NextTinyStep; Now tab. | **Helps** – start. | **Strengthen** – align with “Do this first” from Plan today ritual. |
| 33 | **Load lightened / suggestLoadLightening** | 1 | Reduce overplanning; move items off today. | handleLightenTodayPlan; suggestLoadLightening; reward “Lightened by N items.” | **Helps** – plan + recover. | **Keep** – message already calm. |
| 34 | **MORNING_CHECKIN_DONE reward** | 1 | Confirm energy set. | App handleMissedDayChoose; buildReward(MORNING_CHECKIN_DONE). | **Helps** – plan. | **Keep** – “Today you have N spoons. Go gently.” is good. |
| 35 | **getPlanReaction (heavy stones, path clear, etc.)** | 3 | Post–check-in spirit message. | MochiSpirit getPlanReaction; MorningCheckIn onComplete. | **Mixed** – contextual but metaphor-heavy. | **Tone down** – shorten to one line; e.g. “Light day” / “Full day” / “Path is clear.” |

---

## 2. Top 5 to strengthen

1. **Reward overlay (pushReward)** – Keep as the single feedback channel; ensure every core action (capture, plan, start, focus, recover, review) has one clear, short confirmation. Prefer “Task completed” / “Session complete” over long or metaphor-heavy lines.
2. **Spoon battery + capacity** – Keep visible in Now/Plan; reinforce in Daily Plan Ritual (step 4–5) so “planned vs capacity” is obvious and overplanning is discouraged.
3. **Daily Plan Ritual** – Make “Plan today” / “Shape your day” the default way to shape the day; keep “Do this first” as the single outcome; avoid adding extra steps or rewards inside the ritual.
4. **Compass + “Do this first”** – Align the Compass “one thing” with the first task from the Plan today ritual so the user always has one clear next action without opening multiple surfaces.
5. **Helper interventions** – Keep no-next-step, overload, focus-abandoned, and support suggestions; ensure copy stays one line where possible and cooldowns prevent repetition.

---

## 3. Top 5 to tone down

1. **Spirit dialogue (post check-in / post focus)** – Replace full-screen or long-duration spirit message with a small toast or inline line (2–3 seconds max). Avoid blocking the view after focus or check-in.
2. **Embers + “+N Embers” / “+N Water” in overlay** – Still grant embers/water in the backend for Shop/progression, but don’t emphasize “+N Embers” / “+N Water” in every reward toast. Show a single “Session complete” or “Task completed” line; optional “+1 Water” in settings or Shop.
3. **Tea Ceremony “You gathered X Embers”** – Lead with “Session complete” and “X min logged”; show Embers as a short secondary line or only in Spirit Shop / progression views.
4. **Spirit Progression (Seed → Spirit Keeper)** – Move from Now tab sidebar to Settings or Garden tab so the main work surface stays about tasks and time, not level.
5. **getPlanReaction / plan reaction message** – Shorten to one neutral line (e.g. “Light day” / “Full day” / “Path is clear”) and avoid long metaphorical copy (“I have moved the biggest stones…”).

---

## 4. Top 3 to remove or hide

1. **WanderingCreature “pet for +1 Ember”** – Remove the ember reward and toast for petting the creature. Keep petting as a harmless animation only (no currency). Stops encouraging garden play instead of planning/focus.
2. **FOCUS_PERSEVERANCE (“Wow, this seed had deep roots!”)** – Remove this reward type or replace with one short line (“You put in more time than planned”) and no extra embers call-out. Reduces noise and metaphor load after focus.
3. **Harvest confetti** – Make confetti off by default; keep “Harvested” state and button. Allow confetti only via an optional “Celebrations” or “Confetti” setting so default experience is calm and low-stim.

---

## Summary

- **Strengthen:** Single reward channel, spoon/capacity visibility, Plan today ritual, Compass “Do this first,” helper interventions.
- **Tone down:** Spirit dialogue duration/placement, ember/water prominence in toasts, Tea Ceremony ember screen, Spirit Progression placement, plan reaction length.
- **Remove or hide:** Pet-for-ember reward, FOCUS_PERSEVERANCE message, confetti-on-harvest by default.

No new features recommended until these changes are in place. All recommendations prioritize freelancer/employee usability and calm, confidence-building motivation over novelty and noisy rewards.

---

## Phase 5 implementation notes

The current default direction now follows a calmer utility-surface rule:

- `Today`, `Planner`, and focus-complete flows lead with plain completion copy.
- Reward overlays still confirm meaningful actions, but currency and progression details stay hidden by default outside playful mode.
- `TeaCeremony` now leads with `Session complete` and `X min logged`; ember celebration is secondary and only foregrounded in playful mode.
- `SpiritProgression` remains available, but is framed as background progress rather than foreground status.
- Spirit planning reactions and helper lines on work surfaces now prefer direct language over metaphor-heavy copy.

This keeps the Garden identity intact while making work surfaces feel calmer and more premium by default.
