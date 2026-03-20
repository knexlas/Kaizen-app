import { useMemo } from 'react';
import { localISODate } from '../../../services/dateUtils';
import { inferTaskTimingType, } from '../../../services/energyDictionaryService';
import { getRecommendationForTaskType } from '../../../services/insightsReflectionService';
import { getCurrentSlotKey } from '../../../components/Dashboard/CompassWidget';
import { isAssignmentFixed, useTinyStepSuggestions } from '../../../components/Dashboard/NextTinyStep';
import { HOURS, getAssignmentsForHour } from '../../../components/Dashboard/TimeSlicer';
import { formatHourKey } from '../../../components/CommandCenter/StagingArea';
import { getRitualForToday } from '../../../components/Dashboard/GardenDashboard.shared';

export function useTodayBriefingModel({
  today,
  now,
  goals,
  logs,
  weeklyEvents,
  assignments,
  weather,
  todaySpoonCount,
  dailyEnergy,
  isOverloaded,
  maxSlots,
  needsMorningCheckIn,
  activeSession,
  continuitySummary,
  plannerActionBusy,
  compost,
  userSettings,
  currentHelperIntervention,
  helperInterventionTypes,
  lastGardenImpact,
  recommendedToday,
  needsAttention,
  learnedEnergyProfile,
  learnedFocusRecommendation,
  learnedAdminRecommendation,
  learnedLowEnergyRecommendation,
  handleStartNowStart,
  handleHelpMeStart,
  handleOpenDailyPlanRitual,
  handleOpenStartAssist,
  handleLightenTodayPlan,
  handleSuggestTodayPlan,
  openModal,
  runStartFocus,
  setShowMorningCheckInModal,
}) {
  const todayDayIndex = useMemo(
    () => new Date(today + 'T12:00:00').getDay(),
    [today]
  );

  const todayRitualItems = useMemo(
    () =>
      (goals ?? [])
        .filter((goal) => getRitualForToday(goal, todayDayIndex))
        .map((goal) => ({ goal, ritualTitle: getRitualForToday(goal, todayDayIndex)?.title ?? '' })),
    [goals, todayDayIndex]
  );

  const goalBank = useMemo(
    () => (goals ?? []).filter((goal) => !getRitualForToday(goal, todayDayIndex)),
    [goals, todayDayIndex]
  );

  const todayTaskEntries = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const hour of HOURS) {
      for (const assignment of getAssignmentsForHour(assignments, hour)) {
        const goalId = typeof assignment === 'string' ? assignment : (assignment?.goalId ?? assignment?.parentGoalId);
        if (!goalId || seen.has(goalId)) continue;
        seen.add(goalId);
        const goal = (goals ?? []).find((item) => item.id === goalId);
        if (goal) out.push({ goalId, goal });
      }
    }
    return out;
  }, [assignments, goals]);

  const todayPlanItemsWithHour = useMemo(() => {
    const out = [];
    for (const hour of HOURS) {
      for (const assignment of getAssignmentsForHour(assignments, hour)) {
        const goalId = typeof assignment === 'string' ? assignment : (assignment?.goalId ?? assignment?.parentGoalId);
        const goal = (goals ?? []).find((item) => item.id === goalId);
        if (!goal) continue;
        const ritualTitle = typeof assignment === 'object' && assignment.ritualTitle ? assignment.ritualTitle : null;
        const subtaskId = typeof assignment === 'object' && assignment.subtaskId ? assignment.subtaskId : null;
        out.push({ hour, goalId, goal, ritualTitle, subtaskId });
      }
    }
    return out;
  }, [assignments, goals]);

  const nextUpItems = useMemo(() => {
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const withMinutes = todayPlanItemsWithHour.map((item) => {
      const [hours, minutes] = (item.hour || '06:00').split(':').map(Number);
      return {
        ...item,
        slotMinutes: (hours * 60) + (minutes || 0),
      };
    });
    const sorted = [...withMinutes].sort((a, b) => a.slotMinutes - b.slotMinutes);
    const upcoming = sorted.filter((item) => item.slotMinutes >= nowMinutes);
    const past = sorted.filter((item) => item.slotMinutes < nowMinutes);
    const ordered = upcoming.length > 0 ? [...upcoming, ...past] : sorted;
    return ordered.slice(0, 3).map(({ hour, goalId, goal, ritualTitle, subtaskId }) => ({
      hour,
      goalId,
      goal,
      title: ritualTitle || goal?.title,
      estimatedMinutes: goal?.estimatedMinutes ?? 60,
      spoonCost: goal?.spoonCost ?? 1,
      subtaskId,
    }));
  }, [todayPlanItemsWithHour, now]);

  const todayPlanItemsWithIsFixed = useMemo(
    () => todayPlanItemsWithHour.map((item) => {
      const hourAssignments = getAssignmentsForHour(assignments, item.hour);
      const assignment = hourAssignments.find((value) => (typeof value === 'string' ? value : value?.goalId ?? value?.parentGoalId) === item.goalId);
      return { ...item, isFixed: isAssignmentFixed(assignment) || item.goal?.isFixed === true };
    }),
    [todayPlanItemsWithHour, assignments]
  );

  const nowSuggestions = useTinyStepSuggestions({
    todayPlanItems: todayPlanItemsWithIsFixed,
    compost: compost ?? [],
    logs: logs ?? [],
    goals: goals ?? [],
    snoozedUntil: {},
    lowEnergy: (todaySpoonCount ?? 0) <= 2,
  });

  const currentFocusItem = useMemo(() => {
    const todayStr = localISODate(now);
    const currentHour = `${String(now.getHours()).padStart(2, '0')}:00`;
    const eventsToday = (Array.isArray(weeklyEvents) ? weeklyEvents : []).filter((event) => {
      const date = event.start ? new Date(event.start) : null;
      return date && localISODate(date) === todayStr;
    });
    const fixedEventNow = eventsToday.find((event) => {
      const start = event.start ? new Date(event.start) : null;
      const end = event.end ? new Date(event.end) : null;
      if (!start) return false;
      const fallbackEnd = end && end.getTime() > start.getTime() ? end : new Date(start.getTime() + (60 * 60 * 1000));
      return now.getTime() >= start.getTime() && now.getTime() <= fallbackEnd.getTime();
    });
    if (fixedEventNow) {
      return {
        id: `calendar-${fixedEventNow.id ?? fixedEventNow.start ?? 'now'}`,
        source: 'calendar',
        title: fixedEventNow.title || 'Calendar event',
        event: fixedEventNow,
        isFixed: true,
      };
    }
    const planItemNow = todayPlanItemsWithIsFixed.find((item) => item.hour === currentHour && item.isFixed);
    if (planItemNow) {
      return {
        id: `plan-${planItemNow.goalId}-${planItemNow.hour}`,
        source: 'plan',
        title: planItemNow.ritualTitle || planItemNow.goal?.title || 'Task',
        goalId: planItemNow.goalId,
        goal: planItemNow.goal,
        hour: planItemNow.hour,
        subtaskId: planItemNow.subtaskId,
        isFixed: true,
      };
    }
    return nowSuggestions.length > 0 ? nowSuggestions[0] : null;
  }, [weeklyEvents, todayPlanItemsWithIsFixed, nowSuggestions, now]);

  const nowRecommendation = useMemo(() => {
    const slotKey = getCurrentSlotKey(now);
    const isStorm = weather === 'storm';
    const assignment = slotKey ? getAssignmentsForHour(assignments, slotKey)[0] ?? null : null;
    const goalId = assignment == null ? null : typeof assignment === 'string' ? assignment : assignment?.goalId ?? assignment?.parentGoalId;
    const slotStatus = isStorm ? 'storm' : goalId && (goals ?? []).some((goal) => goal.id === goalId) ? 'assigned' : 'free';

    if (needsMorningCheckIn) {
      return {
        stateLine: 'Set your energy for today',
        recommendedPrimary: { type: 'set_energy', label: "Set today's energy", onClick: () => setShowMorningCheckInModal(true) },
        recommendedFallback: { label: 'View my day', onClick: () => document.getElementById('tour-timeline')?.scrollIntoView({ behavior: 'smooth' }) },
      };
    }
    if (isStorm) {
      return {
        stateLine: `${slotKey ?? 'Now'} · Storm`,
        recommendedPrimary: { type: 'rest', label: 'Rest / Take shelter', onClick: () => {} },
        recommendedFallback: { label: 'View my day', onClick: () => document.getElementById('tour-timeline')?.scrollIntoView({ behavior: 'smooth' }) },
      };
    }
    if (isOverloaded) {
      return {
        stateLine: 'Today looks full',
        recommendedPrimary: { type: 'lighten', label: 'Lighten my plan', onClick: handleLightenTodayPlan },
        recommendedFallback: { label: 'View my day', onClick: () => document.getElementById('tour-timeline')?.scrollIntoView({ behavior: 'smooth' }) },
      };
    }
    const spoons = todaySpoonCount ?? 0;
    const primaryTask = currentFocusItem?.goal
      ? { goal: currentFocusItem.goal, goalId: currentFocusItem.goalId, subtaskId: currentFocusItem.subtaskId }
      : null;
    return {
      stateLine: slotKey
        ? `${spoons} spoon${spoons !== 1 ? 's' : ''} · ${slotKey} ${slotStatus === 'assigned' ? '- scheduled' : slotStatus === 'free' ? 'free' : ''}`.trim()
        : 'No plan yet',
      recommendedPrimary: primaryTask
        ? { type: 'start', label: `Start ${currentFocusItem?.title ?? 'task'}`, task: currentFocusItem, onClick: () => handleStartNowStart(primaryTask, 5) }
        : { type: 'start', label: 'Start now', onClick: handleHelpMeStart },
      recommendedFallback: { label: 'Low energy? Set spoons', onClick: () => setShowMorningCheckInModal(true) },
    };
  }, [
    now,
    weather,
    assignments,
    goals,
    needsMorningCheckIn,
    isOverloaded,
    todaySpoonCount,
    currentFocusItem,
    handleStartNowStart,
    handleHelpMeStart,
    handleLightenTodayPlan,
    setShowMorningCheckInModal,
  ]);

  const currentTaskStrip = useMemo(() => {
    if (needsMorningCheckIn) return null;
    if (activeSession?.title) {
      return {
        label: activeSession.title,
        context: `In focus · ${activeSession.sessionDurationMinutes ?? 25} min`,
      };
    }
    if (currentFocusItem?.title) {
      return {
        label: currentFocusItem.title,
        context: 'Next up',
      };
    }
    return null;
  }, [needsMorningCheckIn, activeSession, currentFocusItem]);

  const currentTaskStripKey = useMemo(
    () => (currentTaskStrip ? `${currentTaskStrip.context}::${currentTaskStrip.label}` : null),
    [currentTaskStrip]
  );

  const todayPathSummary = useMemo(() => {
    if (currentFocusItem?.title) {
      const thenTitles = nextUpItems
        .filter((item) => item.title && item.title !== currentFocusItem.title)
        .slice(0, 2)
        .map((item) => item.title);
      return {
        lead: `Now: ${currentFocusItem.title}`,
        follow: thenTitles.length > 0 ? `Then ${thenTitles.join(' · ')}` : 'Keep the next step small and visible.',
      };
    }
    if (nextUpItems.length > 0) {
      const [first, ...rest] = nextUpItems;
      return {
        lead: `Next: ${first.title}`,
        follow: rest.length > 0 ? `Then ${rest.slice(0, 2).map((item) => item.title).join(' · ')}` : 'Shape the rest only when you need it.',
      };
    }
    return {
      lead: 'No tasks lined up yet.',
      follow: 'Use Plan today to pick a light, realistic path.',
    };
  }, [currentFocusItem, nextUpItems]);

  const todayEnergyStatus = useMemo(() => {
    if (needsMorningCheckIn) {
      return {
        label: 'Check in first',
        detail: 'Set your energy before you shape the rest of the day.',
      };
    }
    const spoons = typeof todaySpoonCount === 'number' ? todaySpoonCount : null;
    let label = 'Medium capacity today';
    if (spoons === 0) label = 'Recovery day';
    else if (spoons != null && spoons <= 2) label = 'Low capacity today';
    else if (spoons != null && spoons <= 4) label = 'Light capacity today';
    else if (spoons != null && spoons >= 8) label = 'High capacity today';

    const detailParts = [];
    if (typeof dailyEnergy === 'number' && Number.isFinite(dailyEnergy)) detailParts.push(`Energy ${dailyEnergy}/10`);
    if (spoons != null) detailParts.push(`${spoons} spoon${spoons === 1 ? '' : 's'}`);
    if (isOverloaded) detailParts.push('The plan is asking for too much');
    else if (typeof maxSlots === 'number') detailParts.push(`Realistic load ${maxSlots}`);
    if (weather === 'storm') detailParts.push('Protect margin');

    return {
      label,
      detail: detailParts.join(' | '),
    };
  }, [needsMorningCheckIn, todaySpoonCount, dailyEnergy, isOverloaded, maxSlots, weather]);

  const todayPrimaryTask = useMemo(() => {
    if (currentFocusItem?.source === 'calendar') {
      return {
        title: currentFocusItem.title,
        detail: 'A calendar block is already live now.',
        context: 'Current block',
        ctaLabel: 'See day map',
        onClick: () => document.getElementById('tour-timeline')?.scrollIntoView({ behavior: 'smooth' }),
      };
    }
    if (currentFocusItem?.goal) {
      return {
        title: currentFocusItem.title ?? currentFocusItem.goal?.title ?? 'First task',
        detail: currentFocusItem.hour ? `Planned for ${formatHourKey(currentFocusItem.hour)}` : 'Best first move right now.',
        context: currentFocusItem.hour ? 'Primary task' : 'Start here',
        ctaLabel: 'Start first task',
        onClick: () => handleStartNowStart(
          { goal: currentFocusItem.goal, goalId: currentFocusItem.goalId, subtaskId: currentFocusItem.subtaskId },
          5
        ),
        goalId: currentFocusItem.goalId,
        subtaskId: currentFocusItem.subtaskId,
        estimatedMinutes: currentFocusItem.goal?.estimatedMinutes ?? 30,
      };
    }
    if (recommendedToday?.goal && recommendedToday?.nextStep) {
      return {
        title: recommendedToday.nextStep.title ?? recommendedToday.goal.title ?? 'First task',
        detail: recommendedToday.reason ?? 'Best first move right now.',
        context: 'Recommended',
        ctaLabel: 'Start first task',
        onClick: () => runStartFocus({
          goal: recommendedToday.goal,
          minutes: recommendedToday.nextStep.suggestedMinutes ?? 15,
          subtaskId: recommendedToday.nextStep.subtaskId ?? null,
        }),
        goalId: recommendedToday.goal.id,
        subtaskId: recommendedToday.nextStep.subtaskId ?? null,
        estimatedMinutes: recommendedToday.nextStep.suggestedMinutes ?? recommendedToday.goal?.estimatedMinutes ?? 30,
      };
    }
    if (nextUpItems[0]?.goal) {
      return {
        title: nextUpItems[0].title ?? nextUpItems[0].goal?.title ?? 'First task',
        detail: nextUpItems[0].hour ? `Planned for ${formatHourKey(nextUpItems[0].hour)}` : 'Best first move right now.',
        context: 'Next up',
        ctaLabel: 'Start first task',
        onClick: () => handleStartNowStart(nextUpItems[0], 5),
        goalId: nextUpItems[0].goalId,
        subtaskId: nextUpItems[0].subtaskId ?? null,
        estimatedMinutes: nextUpItems[0].estimatedMinutes ?? 30,
      };
    }
    return null;
  }, [currentFocusItem, recommendedToday, nextUpItems, handleStartNowStart, runStartFocus]);

  const todayTimingGuidance = useMemo(() => {
    if (needsMorningCheckIn) return null;
    const primaryType = inferTaskTimingType(todayPrimaryTask ?? currentFocusItem ?? {});
    const primaryRecommendation = getRecommendationForTaskType(learnedEnergyProfile, primaryType);
    return {
      primaryLine: primaryRecommendation?.explanation ?? learnedFocusRecommendation?.explanation ?? null,
      avoidLine: learnedEnergyProfile?.weakWindow?.explanation ?? null,
      recoveryLine: (todaySpoonCount ?? 0) <= 3
        ? (learnedLowEnergyRecommendation?.explanation ?? learnedAdminRecommendation?.explanation ?? null)
        : null,
    };
  }, [
    needsMorningCheckIn,
    todayPrimaryTask,
    currentFocusItem,
    learnedEnergyProfile,
    learnedFocusRecommendation,
    learnedAdminRecommendation,
    learnedLowEnergyRecommendation,
    todaySpoonCount,
  ]);

  const todayMustDoLane = useMemo(() => {
    const primary = todayPrimaryTask ? { ...todayPrimaryTask, laneLabel: 'Primary' } : null;
    const usedTitles = new Set(primary?.title ? [primary.title] : []);
    const support = [];

    const addSupportItem = (candidate, laneLabel = 'Support') => {
      const title = candidate?.title ?? candidate?.goal?.title ?? candidate?.ritualTitle ?? null;
      if (!title || usedTitles.has(title) || support.length >= 2) return;
      usedTitles.add(title);
      support.push({
        title,
        detail: candidate?.hour
          ? `Planned for ${formatHourKey(candidate.hour)}`
          : candidate?.detail ?? 'Keep this small and defined.',
        estimatedMinutes: candidate?.estimatedMinutes ?? candidate?.goal?.estimatedMinutes ?? 20,
        laneLabel,
      });
    };

    nextUpItems.forEach((item) => addSupportItem(item));
    todayRitualItems.forEach(({ goal, ritualTitle }) => addSupportItem({ goal, title: ritualTitle || goal?.title, detail: 'Keep this light.' }));

    const quickWinCandidate = [
      ...todayRitualItems.map(({ goal, ritualTitle }) => ({
        goal,
        goalId: goal?.id,
        subtaskId: null,
        title: ritualTitle || goal?.title,
        estimatedMinutes: goal?.estimatedMinutes ?? 15,
      })),
      ...goalBank.map((goal) => ({
        goal,
        goalId: goal?.id,
        subtaskId: null,
        title: goal?.title,
        estimatedMinutes: goal?.estimatedMinutes ?? 15,
      })),
    ].find((item) => item.title && !usedTitles.has(item.title) && (item.estimatedMinutes ?? 15) <= 20);

    const quickWin = quickWinCandidate
      ? {
          ...quickWinCandidate,
          laneLabel: 'Quick win',
          detail: 'Use this if you need an easy reset or a fast win.',
          onClick: () => handleStartNowStart(quickWinCandidate, 5),
        }
      : null;

    return {
      primary,
      support: support.slice(0, 2),
      quickWin,
    };
  }, [todayPrimaryTask, nextUpItems, todayRitualItems, goalBank, handleStartNowStart]);

  const todayMapBlocks = useMemo(() => {
    const personalCandidate = todayRitualItems.find(({ ritualTitle, goal }) => {
      const title = ritualTitle || goal?.title;
      return title && title !== todayMustDoLane.primary?.title;
    });

    const blocks = [
      {
        label: 'Focus block',
        detail: todayMustDoLane.primary?.title ?? 'One defined task before you widen the day.',
      },
      {
        label: 'Admin block',
        detail: todayMustDoLane.support[0]?.title ?? todayMustDoLane.quickWin?.title ?? 'Keep small tasks contained in one short block.',
      },
      {
        label: 'Reset block',
        detail:
          isOverloaded || (todaySpoonCount ?? 0) <= 2 || weather === 'storm'
            ? 'Protect recovery time and leave slack between blocks.'
            : 'Keep one short reset block open so the day stays usable.',
      },
    ];

    if (personalCandidate) {
      blocks.push({
        label: 'Personal block',
        detail: personalCandidate.ritualTitle || personalCandidate.goal?.title,
      });
    }

    return blocks;
  }, [todayMustDoLane, todayRitualItems, isOverloaded, todaySpoonCount, weather]);

  const todayRecoveryItems = useMemo(() => {
    const items = [];

    if (isOverloaded) {
      items.push({
        key: 'overloaded',
        title: 'Today is overloaded',
        body: 'Reduce the plan before you add anything else.',
        actionLabel: plannerActionBusy === 'day' ? 'Lightening...' : 'Lighten today',
        onClick: handleLightenTodayPlan,
        tone: 'amber',
      });
    }

    if (!needsMorningCheckIn && !todayPrimaryTask && nextUpItems.length === 0) {
      items.push({
        key: 'no-next-step',
        title: 'No clear next step',
        body: 'Pick one realistic first move before you try to do more.',
        actionLabel: 'Plan today',
        onClick: handleOpenDailyPlanRitual,
        tone: 'stone',
      });
    }

    if ((needsAttention?.noNextStep?.length ?? 0) > 0) {
      items.push({
        key: 'project-next-step',
        title: 'Some projects still need a next step',
        body: `${needsAttention.noNextStep.length} item${needsAttention.noNextStep.length === 1 ? '' : 's'} in Plan still need to be clarified.`,
        actionLabel: 'Open Plan',
        onClick: () => document.getElementById('planner-overview')?.scrollIntoView({ behavior: 'smooth' }),
        tone: 'stone',
      });
    }

    if (!activeSession && continuitySummary.todaySessions === 0 && now.getHours() >= 11 && (todayPrimaryTask || nextUpItems.length > 0)) {
      items.push({
        key: 'delayed-start',
        title: 'Start smaller than you think',
        body: 'You do not need to catch up. A five minute start counts.',
        actionLabel: todayPrimaryTask?.ctaLabel ?? 'Help me start',
        onClick: todayPrimaryTask?.onClick ?? handleOpenStartAssist,
        tone: 'stone',
      });
    }

    if ((compost?.length ?? 0) >= 6) {
      items.push({
        key: 'uncategorized',
        title: 'Loose capture is piling up',
        body: `${compost.length} captured item${compost.length === 1 ? '' : 's'} still need sorting.`,
        actionLabel: 'Review inbox',
        onClick: () => openModal('compost'),
        tone: 'stone',
      });
    }

    if (currentHelperIntervention?.type === helperInterventionTypes.FOCUS_ABANDONED) {
      items.push({
        key: 'focus-abandoned',
        title: 'Momentum dropped',
        body: 'Restart with a smaller block instead of trying to make up lost time.',
        actionLabel: 'Help me start',
        onClick: handleOpenStartAssist,
        tone: 'stone',
      });
    }

    return items.slice(0, 3);
  }, [
    isOverloaded,
    plannerActionBusy,
    handleLightenTodayPlan,
    needsMorningCheckIn,
    todayPrimaryTask,
    nextUpItems,
    handleOpenDailyPlanRitual,
    needsAttention,
    activeSession,
    continuitySummary.todaySessions,
    now,
    handleOpenStartAssist,
    compost,
    openModal,
    currentHelperIntervention,
    helperInterventionTypes,
  ]);

  const todayHero = useMemo(() => {
    const tasksVisible = [
      todayMustDoLane.primary?.title,
      ...todayMustDoLane.support.map((item) => item.title),
    ].filter(Boolean).length;

    const realisticLine = needsMorningCheckIn
      ? 'Realistic first move: set your energy, then keep the day narrow.'
      : tasksVisible > 0
        ? `Realistic today: ${tasksVisible} clear task${tasksVisible === 1 ? '' : 's'} is enough.`
        : 'Realistic today: start with one task, not a full rebuild of your life.';

    let summary = 'Best move: build a calm day around one clear task.';
    let recommendation = todayPrimaryTask?.title
      ? `Start with ${todayPrimaryTask.title}.`
      : 'Pick one defined task before you add anything else.';
    let primaryAction = todayPrimaryTask
      ? { label: todayPrimaryTask.ctaLabel ?? 'Start first task', onClick: todayPrimaryTask.onClick, disabled: false }
      : { label: 'Plan today', onClick: handleOpenDailyPlanRitual, disabled: false };

    if (needsMorningCheckIn) {
      summary = 'Best move: set your energy before you commit to the day.';
      recommendation = 'Once energy is set, keep the first step small and clear.';
      primaryAction = { label: "Set today's energy", onClick: () => setShowMorningCheckInModal(true), disabled: false };
    } else if (isOverloaded) {
      summary = 'Best move: lighten the day before you try to push through it.';
      recommendation = todayPrimaryTask?.title
        ? `Keep ${todayPrimaryTask.title} as the anchor and reduce the rest.`
        : 'Reduce the plan until one task stands out.';
      primaryAction = {
        label: plannerActionBusy === 'day' ? 'Lightening...' : 'Lighten today',
        onClick: handleLightenTodayPlan,
        disabled: plannerActionBusy === 'day',
      };
    }

    let avoidLine = 'Avoid opening five things at once.';
    if (needsMorningCheckIn) avoidLine = 'Avoid planning from guesswork. Set energy first.';
    else if (isOverloaded) avoidLine = 'Avoid adding more before the plan fits.';
    else if ((todaySpoonCount ?? 0) <= 2) avoidLine = 'Avoid context switching. Keep the day tiny.';
    else if (!todayPrimaryTask) avoidLine = 'Avoid treating every task like a priority.';

    if (!needsMorningCheckIn && todayTimingGuidance?.avoidLine) {
      avoidLine = `${avoidLine} ${todayTimingGuidance.avoidLine}`;
    }

    return {
      statusLabel: todayEnergyStatus.label,
      statusDetail: todayEnergyStatus.detail,
      summary,
      recommendation,
      timingLine: todayTimingGuidance?.primaryLine ?? null,
      realisticLine,
      avoidLine,
      recoveryTimingLine: todayTimingGuidance?.recoveryLine ?? null,
      primaryAction,
      secondaryActions: [
        {
          label: plannerActionBusy === 'day' ? 'Lightening...' : 'Lighten today',
          onClick: handleLightenTodayPlan,
          disabled: plannerActionBusy === 'day',
        },
        {
          label: plannerActionBusy === 'day' ? 'Rebuilding...' : 'Rebuild today with AI',
          onClick: handleSuggestTodayPlan,
          disabled: plannerActionBusy === 'day',
        },
      ],
    };
  }, [
    todayMustDoLane,
    needsMorningCheckIn,
    todayPrimaryTask,
    handleOpenDailyPlanRitual,
    isOverloaded,
    plannerActionBusy,
    handleLightenTodayPlan,
    todaySpoonCount,
    todayEnergyStatus,
    handleSuggestTodayPlan,
    todayTimingGuidance,
    setShowMorningCheckInModal,
  ]);

  const todayProgressFooter = useMemo(() => {
    const progressLine = continuitySummary.todaySessions === 0
      ? 'No focus logged yet today.'
      : `${continuitySummary.todaySessions} focus block${continuitySummary.todaySessions === 1 ? '' : 's'} completed, ${continuitySummary.todayMinutes} minutes logged.`;

    let supportLine = 'One finished task is enough to make today useful.';
    if (needsMorningCheckIn) supportLine = 'Check in, choose one task, and let the rest wait.';
    else if (continuitySummary.todaySessions > 0) supportLine = 'You already have momentum. Protect it by keeping the next step small.';
    else if (isOverloaded) supportLine = 'A lighter plan is still a productive plan.';
    else if (todayPrimaryTask?.title) supportLine = `If you finish ${todayPrimaryTask.title}, today is on track.`;

    return {
      progressLine,
      supportLine,
      gardenLine: lastGardenImpact?.text ? `Garden update: ${lastGardenImpact.text}` : null,
    };
  }, [continuitySummary, needsMorningCheckIn, isOverloaded, todayPrimaryTask, lastGardenImpact]);

  return {
    todayDayIndex,
    todayRitualItems,
    goalBank,
    todayTaskEntries,
    nextUpItems,
    currentFocusItem,
    nowRecommendation,
    currentTaskStrip,
    currentTaskStripKey,
    todayPathSummary,
    todayEnergyStatus,
    todayPrimaryTask,
    todayTimingGuidance,
    todayMustDoLane,
    todayMapBlocks,
    todayRecoveryItems,
    todayHero,
    todayProgressFooter,
  };
}
