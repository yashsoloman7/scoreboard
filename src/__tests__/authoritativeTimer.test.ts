// src/__tests__/authoritativeTimer.test.ts - Unit Tests for Server-Authoritative Timer

import { describe, it, expect } from 'vitest';
import { formatTimerSeconds, computeTimerDisplay } from '../lib/timer/authoritativeTimer';
import { TimerState } from '../types';

describe('Server-Authoritative Timer Engine', () => {
  it('formats seconds into MM:SS correctly', () => {
    expect(formatTimerSeconds(300)).toBe('05:00');
    expect(formatTimerSeconds(45)).toBe('00:45');
    expect(formatTimerSeconds(0)).toBe('00:00');
    expect(formatTimerSeconds(15, true)).toBe('+00:15'); // Overtime prefix
  });

  it('computes idle timer state with configured duration', () => {
    const timer: TimerState = {
      id: 't1',
      performanceId: 'p1',
      status: 'idle',
      configuredDurationSeconds: 300,
      warningThresholdSeconds: 30,
      accumulatedDurationSeconds: 0,
      overtimeSeconds: 0,
      updatedAt: '',
    };

    const display = computeTimerDisplay(timer);
    expect(display.formattedDisplay).toBe('05:00');
    expect(display.isWarning).toBe(false);
    expect(display.isOvertime).toBe(false);
    expect(display.remainingSeconds).toBe(300);
  });

  it('computes paused timer with accumulated duration', () => {
    const timer: TimerState = {
      id: 't1',
      performanceId: 'p1',
      status: 'paused',
      configuredDurationSeconds: 300,
      warningThresholdSeconds: 30,
      accumulatedDurationSeconds: 60, // 1 minute elapsed
      overtimeSeconds: 0,
      updatedAt: '',
    };

    const display = computeTimerDisplay(timer);
    expect(display.formattedDisplay).toBe('04:00'); // 4 minutes remaining
    expect(display.remainingSeconds).toBe(240);
  });

  it('triggers warning threshold at <= 30 seconds', () => {
    const timer: TimerState = {
      id: 't1',
      performanceId: 'p1',
      status: 'running',
      configuredDurationSeconds: 300,
      warningThresholdSeconds: 30,
      startedAt: new Date(Date.now() - 280 * 1000).toISOString(), // 280s elapsed (20s left)
      accumulatedDurationSeconds: 0,
      overtimeSeconds: 0,
      updatedAt: '',
    };

    const display = computeTimerDisplay(timer);
    expect(display.isWarning).toBe(true);
    expect(display.isOvertime).toBe(false);
  });

  it('computes overtime when elapsed duration exceeds configured duration', () => {
    const timer: TimerState = {
      id: 't1',
      performanceId: 'p1',
      status: 'running',
      configuredDurationSeconds: 300,
      warningThresholdSeconds: 30,
      startedAt: new Date(Date.now() - 320 * 1000).toISOString(), // 320s elapsed (20s overtime)
      accumulatedDurationSeconds: 0,
      overtimeSeconds: 0,
      updatedAt: '',
    };

    const display = computeTimerDisplay(timer);
    expect(display.isOvertime).toBe(true);
    expect(display.formattedDisplay).toBe('+00:20');
  });
});
