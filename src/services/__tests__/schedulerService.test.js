import { describe, it, expect } from 'vitest';
import {
  hourFromTimeStr,
  timeToMinutes,
  minutesToTime,
  findAvailableSlots,
  getStormImpactForDay,
  getSpoonCost,
  generateDailyPlan,
} from '../schedulerService';

// ---- Utility functions ----

describe('hourFromTimeStr', () => {
  it('parses valid time strings', () => {
    expect(hourFromTimeStr('08:00')).toBe(8);
    expect(hourFromTimeStr('22:30')).toBe(22);
    expect(hourFromTimeStr('0:00')).toBe(0);
  });

  it('returns default for null/undefined', () => {
    expect(hourFromTimeStr(null)).toBe(8);
    expect(hourFromTimeStr(undefined, 9)).toBe(9);
  });

  it('clamps to 0-23', () => {
    expect(hourFromTimeStr('25:00')).toBe(23);
    // '-1' parses to -1 via parseInt, then clamped to 0
    expect(hourFromTimeStr('-1:00')).toBe(0);
  });

  it('returns default for non-string input', () => {
    expect(hourFromTimeStr(42)).toBe(8);
    expect(hourFromTimeStr({})).toBe(8);
  });
});

describe('timeToMinutes', () => {
  it('converts HH:mm to minutes', () => {
    expect(timeToMinutes('00:00')).toBe(0);
    expect(timeToMinutes('01:30')).toBe(90);
    expect(timeToMinutes('12:00')).toBe(720);
    expect(timeToMinutes('23:59')).toBe(1439);
  });

  it('returns 0 for invalid input', () => {
    expect(timeToMinutes(null)).toBe(0);
    expect(timeToMinutes('')).toBe(0);
    expect(timeToMinutes(undefined)).toBe(0);
  });
});

describe('minutesToTime', () => {
  it('converts minutes to HH:mm', () => {
    expect(minutesToTime(0)).toBe('00:00');
    expect(minutesToTime(90)).toBe('01:30');
    expect(minutesToTime(720)).toBe('12:00');
    expect(minutesToTime(1439)).toBe('23:59');
  });
});

// ---- getSpoonCost ----

describe('getSpoonCost', () => {
  it('returns default of 1 for no cost set', () => {
    expect(getSpoonCost({})).toBe(1);
    expect(getSpoonCost({ title: 'Walk' })).toBe(1);
  });

  it('returns 0 for zero-spark tasks', () => {
    expect(getSpoonCost({ energyCost: 0 })).toBe(0);
    expect(getSpoonCost({ spoonCost: 0 })).toBe(0);
  });

  it('clamps between 1 and 4', () => {
    expect(getSpoonCost({ energyCost: 5 })).toBe(4);
    expect(getSpoonCost({ energyCost: -1 })).toBe(1);
    expect(getSpoonCost({ energyCost: 3 })).toBe(3);
  });

  it('prefers energyCost over spoonCost', () => {
    expect(getSpoonCost({ energyCost: 2, spoonCost: 4 })).toBe(2);
  });
});

// ---- findAvailableSlots ----

describe('findAvailableSlots', () => {
  const monday = new Date('2025-01-06T00:00:00');

  it('returns full day when no events', () => {
    const slots = findAvailableSlots([], [], {
      weekStartDate: monday,
      startHour: 8,
      endHour: 18,
    });
    // Should have 7 days, each with an open window 08:00-18:00
    expect(slots.length).toBe(7);
    expect(slots[0].start).toBe('08:00');
    expect(slots[0].end).toBe('18:00');
  });

  it('blocks time around storm events using ISO dates', () => {
    // Monday 2025-01-06 storm from 12:00-13:00
    const stormEvent = {
      start: '2025-01-06T12:00:00',
      end: '2025-01-06T13:00:00',
      type: 'storm',
    };
    const slots = findAvailableSlots([stormEvent], [], {
      weekStartDate: monday,
      startHour: 8,
      endHour: 18,
      stormBufferMinutes: 30,
    });
    // Monday (dayIndex=1) should be split around storm + 30min buffer
    const day1Slots = slots.filter((s) => s.dayIndex === 1);
    expect(day1Slots.length).toBe(2);
    expect(day1Slots[0].end).toBe('11:30');
    expect(day1Slots[1].start).toBe('13:30');
  });

  it('handles empty events array', () => {
    const slots = findAvailableSlots(null, [], { weekStartDate: monday });
    expect(slots.length).toBe(7);
  });
});

// ---- getStormImpactForDay ----

describe('getStormImpactForDay', () => {
  const monday = new Date('2025-01-06T00:00:00');

  it('returns zero impact for no events', () => {
    const impact = getStormImpactForDay([], 1, { weekStartDate: monday });
    expect(impact.stormCount).toBe(0);
    expect(impact.capacityReduction).toBe(0);
  });

  it('counts storm events correctly', () => {
    const events = [
      { start: '2025-01-06T10:00:00', end: '2025-01-06T11:00:00', type: 'storm' },
      { start: '2025-01-06T14:00:00', end: '2025-01-06T15:00:00', type: 'storm' },
    ];
    // Monday = dayIndex 1
    const impact = getStormImpactForDay(events, 1, { weekStartDate: monday });
    expect(impact.stormCount).toBe(2);
    expect(impact.capacityReduction).toBe(2);
  });

  it('ignores non-storm events', () => {
    const events = [
      { start: '2025-01-06T10:00:00', end: '2025-01-06T11:00:00', type: 'leaf' },
    ];
    const impact = getStormImpactForDay(events, 1, { weekStartDate: monday });
    expect(impact.stormCount).toBe(0);
  });

  it('caps capacity reduction at 6', () => {
    const events = Array.from({ length: 10 }, (_, i) => ({
      start: `2025-01-06T${String(8 + i).padStart(2, '0')}:00:00`,
      end: `2025-01-06T${String(9 + i).padStart(2, '0')}:00:00`,
      type: 'storm',
    }));
    const impact = getStormImpactForDay(events, 1, { weekStartDate: monday });
    expect(impact.capacityReduction).toBe(6);
  });
});

// ---- generateDailyPlan ----

describe('generateDailyPlan', () => {
  it('returns empty plan for no goals', () => {
    expect(generateDailyPlan([], 5)).toEqual({});
  });

  it('returns empty plan for zero spoons', () => {
    const goals = [{ id: 'g1', type: 'routine', title: 'Walk' }];
    expect(generateDailyPlan(goals, 0)).toEqual({});
  });

  it('only schedules routine goals', () => {
    const goals = [
      { id: 'g1', type: 'kaizen', title: 'Learn Piano' },
      { id: 'g2', type: 'routine', title: 'Walk' },
    ];
    const plan = generateDailyPlan(goals, 6);
    const scheduled = Object.values(plan).flat();
    const goalIds = scheduled.map((a) => a.parentGoalId).filter(Boolean);
    expect(goalIds).not.toContain('g1');
  });
});
