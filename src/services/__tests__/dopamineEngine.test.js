import { describe, it, expect } from 'vitest';
import { buildReward } from '../dopamineEngine';

describe('buildReward', () => {
  it('returns null for missing input', () => {
    expect(buildReward(null)).toBeNull();
    expect(buildReward({})).toBeNull();
    expect(buildReward({ type: '' })).toBeNull();
  });

  it('returns null for unknown type', () => {
    expect(buildReward({ type: 'UNKNOWN_EVENT' })).toBeNull();
  });

  // ---- MORNING_CHECKIN_DONE ----
  describe('MORNING_CHECKIN_DONE', () => {
    it('includes spoon count in message', () => {
      const reward = buildReward({ type: 'MORNING_CHECKIN_DONE', payload: { spoonCount: 7 } });
      expect(reward).not.toBeNull();
      expect(reward.message).toContain('7 spoons');
      expect(reward.tone).toBe('moss');
    });

    it('uses fallback message when no spoon count', () => {
      const reward = buildReward({ type: 'MORNING_CHECKIN_DONE', payload: {} });
      expect(reward.message).toContain('Energy set');
    });
  });

  // ---- FOCUS_COMPLETE ----
  describe('FOCUS_COMPLETE', () => {
    it('includes goal title', () => {
      const reward = buildReward({ type: 'FOCUS_COMPLETE', payload: { goalTitle: 'Learn Guitar', minutes: 25 } });
      expect(reward.message).toContain('Learn Guitar');
      expect(reward.variableBonus.waterDrops).toBe(1);
    });

    it('awards bonus embers on low spoon days', () => {
      const reward = buildReward({ type: 'FOCUS_COMPLETE', payload: { goalTitle: 'Walk', minutes: 25, spoonCount: 3 } });
      expect(reward.variableBonus.embers).toBe(2);
    });

    it('awards 1 ember for 25+ min focus on normal days', () => {
      const reward = buildReward({ type: 'FOCUS_COMPLETE', payload: { goalTitle: 'Code', minutes: 25, spoonCount: 8 } });
      expect(reward.variableBonus.embers).toBe(1);
    });

    it('no embers for short focus on normal days', () => {
      const reward = buildReward({ type: 'FOCUS_COMPLETE', payload: { goalTitle: 'Code', minutes: 10, spoonCount: 8 } });
      expect(reward.variableBonus.embers).toBeUndefined();
    });
  });

  // ---- TASK_COMPLETE ----
  describe('TASK_COMPLETE', () => {
    it('includes goal title and water drop', () => {
      const reward = buildReward({ type: 'TASK_COMPLETE', payload: { goalTitle: 'Dishes' } });
      expect(reward.message).toContain('Dishes');
      expect(reward.variableBonus.waterDrops).toBe(1);
      expect(reward.growthLine).toBeTruthy();
    });

    it('uses fallback when no goal title', () => {
      const reward = buildReward({ type: 'TASK_COMPLETE', payload: {} });
      expect(reward.message).toContain('Task completed');
    });
  });

  // ---- COMPOST_ADDED ----
  describe('COMPOST_ADDED', () => {
    it('returns shame-free message', () => {
      const reward = buildReward({ type: 'COMPOST_ADDED' });
      expect(reward.message).toContain('No guilt');
      expect(reward.tone).toBe('moss');
    });
  });

  // ---- MILESTONE_COMPLETE ----
  describe('MILESTONE_COMPLETE', () => {
    it('includes milestone title', () => {
      const reward = buildReward({ type: 'MILESTONE_COMPLETE', payload: { milestoneTitle: 'First week done' } });
      expect(reward.message).toContain('First week done');
      expect(reward.growthLine).toContain('+15 min');
    });
  });

  // ---- Activation rewards ----
  describe('activation rewards', () => {
    it('ACTIVATION_START returns encouraging message', () => {
      const reward = buildReward({ type: 'ACTIVATION_START' });
      expect(reward.message).toContain('showed up');
    });

    it('ACTIVATION_SHORT_SESSION acknowledges short work', () => {
      const reward = buildReward({ type: 'ACTIVATION_SHORT_SESSION' });
      expect(reward.message).toContain('Short sessions count');
    });

    it('ACTIVATION_RESUME acknowledges return', () => {
      const reward = buildReward({ type: 'ACTIVATION_RESUME' });
      expect(reward.message).toContain('came back');
    });

    it('ACTIVATION_TINY_STEP acknowledges tiny step', () => {
      const reward = buildReward({ type: 'ACTIVATION_TINY_STEP' });
      expect(reward.message).toContain('tiny step');
    });
  });

  // ---- SUPPORT_ACCEPTED ----
  describe('SUPPORT_ACCEPTED', () => {
    it('returns water drop bonus', () => {
      const reward = buildReward({ type: 'SUPPORT_ACCEPTED' });
      expect(reward.variableBonus.waterDrops).toBe(1);
    });
  });

  // ---- LOAD_LIGHTENED ----
  describe('LOAD_LIGHTENED', () => {
    it('includes removed count', () => {
      const reward = buildReward({ type: 'LOAD_LIGHTENED', payload: { removedCount: 3 } });
      expect(reward.message).toContain('3 items');
    });

    it('uses fallback for no count', () => {
      const reward = buildReward({ type: 'LOAD_LIGHTENED', payload: {} });
      expect(reward.message).toContain('garden will wait');
    });
  });

  // ---- Structure checks ----
  describe('reward structure', () => {
    const types = [
      'MORNING_CHECKIN_DONE',
      'FOCUS_COMPLETE',
      'TASK_COMPLETE',
      'COMPOST_ADDED',
      'MILESTONE_COMPLETE',
      'ACTIVATION_START',
      'LOAD_LIGHTENED',
      'SUPPORT_ACCEPTED',
    ];

    types.forEach((type) => {
      it(`${type} has required fields`, () => {
        const reward = buildReward({ type });
        expect(reward).not.toBeNull();
        expect(typeof reward.message).toBe('string');
        expect(reward.message.length).toBeGreaterThan(0);
        expect(typeof reward.tone).toBe('string');
        expect(typeof reward.icon).toBe('string');
        expect(typeof reward.durationMs).toBe('number');
        expect(reward.durationMs).toBeGreaterThan(0);
      });
    });
  });
});
