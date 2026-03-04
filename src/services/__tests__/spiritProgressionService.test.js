import { describe, it, expect } from 'vitest';
import {
  SPIRIT_TIERS,
  getSpiritLevelIndex,
  getSpiritProgression,
} from '../spiritProgressionService';

describe('SPIRIT_TIERS', () => {
  it('has 6 tiers in ascending order', () => {
    expect(SPIRIT_TIERS.length).toBe(6);
    for (let i = 1; i < SPIRIT_TIERS.length; i++) {
      expect(SPIRIT_TIERS[i].minPoints).toBeGreaterThan(SPIRIT_TIERS[i - 1].minPoints);
    }
  });

  it('starts at 0 and ends at 1000', () => {
    expect(SPIRIT_TIERS[0].minPoints).toBe(0);
    expect(SPIRIT_TIERS[5].minPoints).toBe(1000);
  });
});

describe('getSpiritLevelIndex', () => {
  it('returns 0 for zero points', () => {
    expect(getSpiritLevelIndex(0)).toBe(0);
  });

  it('returns correct tier at boundaries', () => {
    expect(getSpiritLevelIndex(29)).toBe(0);  // Seed
    expect(getSpiritLevelIndex(30)).toBe(1);  // Sprout
    expect(getSpiritLevelIndex(99)).toBe(1);  // still Sprout
    expect(getSpiritLevelIndex(100)).toBe(2); // Sapling
    expect(getSpiritLevelIndex(250)).toBe(3); // Grove
    expect(getSpiritLevelIndex(500)).toBe(4); // Elder
    expect(getSpiritLevelIndex(1000)).toBe(5); // Spirit Keeper
  });

  it('returns max tier for very high points', () => {
    expect(getSpiritLevelIndex(99999)).toBe(5);
  });

  it('handles negative and invalid input', () => {
    expect(getSpiritLevelIndex(-10)).toBe(0);
    expect(getSpiritLevelIndex(null)).toBe(0);
    expect(getSpiritLevelIndex(undefined)).toBe(0);
    expect(getSpiritLevelIndex('abc')).toBe(0);
  });
});

describe('getSpiritProgression', () => {
  it('returns correct structure', () => {
    const prog = getSpiritProgression(50);
    expect(prog).toHaveProperty('levelIndex');
    expect(prog).toHaveProperty('tier');
    expect(prog).toHaveProperty('nextTier');
    expect(prog).toHaveProperty('pointsInLevel');
    expect(prog).toHaveProperty('pointsNeededForNext');
    expect(prog).toHaveProperty('progressFraction');
    expect(prog).toHaveProperty('totalPoints');
  });

  it('calculates progress fraction correctly', () => {
    // Sprout: 30-99 (70 point range)
    const prog = getSpiritProgression(65);
    expect(prog.levelIndex).toBe(1);
    expect(prog.tier.name).toBe('Sprout');
    expect(prog.nextTier.name).toBe('Sapling');
    expect(prog.pointsInLevel).toBe(35); // 65 - 30
    expect(prog.pointsNeededForNext).toBe(70); // 100 - 30
    expect(prog.progressFraction).toBeCloseTo(0.5, 1);
  });

  it('returns 100% progress at max tier', () => {
    const prog = getSpiritProgression(2000);
    expect(prog.levelIndex).toBe(5);
    expect(prog.tier.name).toBe('Spirit Keeper');
    expect(prog.nextTier).toBeNull();
    expect(prog.progressFraction).toBe(1);
  });

  it('handles zero points', () => {
    const prog = getSpiritProgression(0);
    expect(prog.levelIndex).toBe(0);
    expect(prog.tier.name).toBe('Seed');
    expect(prog.pointsInLevel).toBe(0);
    expect(prog.progressFraction).toBe(0);
  });
});
