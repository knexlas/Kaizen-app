import { useMemo } from 'react';
import { buildDerivedEnergyProfile, getRecommendationForTaskType } from '../../../services/insightsReflectionService';

export function useLearnedEnergyProfile({
  logs,
  goals,
  weekAssignments,
  behaviorHistory,
  userSettings,
}) {
  const learnedEnergyProfile = useMemo(
    () => buildDerivedEnergyProfile({
      logs: logs ?? [],
      goals: goals ?? [],
      weekAssignments: weekAssignments ?? {},
      behaviorHistory: behaviorHistory ?? [],
      userSettings,
    }),
    [logs, goals, weekAssignments, behaviorHistory, userSettings]
  );

  const learnedFocusRecommendation = useMemo(
    () => getRecommendationForTaskType(learnedEnergyProfile, 'deep_work'),
    [learnedEnergyProfile]
  );

  const learnedAdminRecommendation = useMemo(
    () => getRecommendationForTaskType(learnedEnergyProfile, 'admin'),
    [learnedEnergyProfile]
  );

  const learnedLowEnergyRecommendation = useMemo(
    () => getRecommendationForTaskType(learnedEnergyProfile, 'low_energy'),
    [learnedEnergyProfile]
  );

  return {
    learnedEnergyProfile,
    learnedFocusRecommendation,
    learnedAdminRecommendation,
    learnedLowEnergyRecommendation,
  };
}
