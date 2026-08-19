// src/lib/timer/authoritativeTimer.ts - Mathematical Server-Authoritative Timer Engine

import { TimerState, TimerStatus } from '@/types';

export interface CalculatedTimerDisplay {
  elapsedSeconds: number;
  remainingSeconds: number;
  overtimeSeconds: number;
  isOvertime: boolean;
  isWarning: boolean;
  formattedDisplay: string;
}

/**
 * Formats seconds into MM:SS or +MM:SS for overtime
 */
export function formatTimerSeconds(seconds: number, isOvertime = false): string {
  const absSeconds = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(absSeconds / 60);
  const secs = absSeconds % 60;
  const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return isOvertime ? `+${formatted}` : formatted;
}

/**
 * Calculates current real-time authoritative timer values given the server state
 * and local time calibrated with server offset
 */
export function computeTimerDisplay(
  timer: TimerState,
  serverClockOffsetMs = 0
): CalculatedTimerDisplay {
  const configured = timer.configuredDurationSeconds || 300;
  const warningThreshold = timer.warningThresholdSeconds || 30;

  let elapsed = Number(timer.accumulatedDurationSeconds || 0);

  if (timer.status === 'running' && timer.startedAt) {
    const startedAtMs = new Date(timer.startedAt).getTime();
    const currentServerTimeMs = Date.now() + serverClockOffsetMs;
    const additionalRunningSeconds = Math.max(0, (currentServerTimeMs - startedAtMs) / 1000);
    elapsed += additionalRunningSeconds;
  }

  const isOvertime = elapsed > configured;
  const remaining = Math.max(0, configured - elapsed);
  const overtime = isOvertime ? elapsed - configured : 0;
  const isWarning = !isOvertime && remaining <= warningThreshold && timer.status === 'running';

  const formattedDisplay = isOvertime
    ? formatTimerSeconds(overtime, true)
    : formatTimerSeconds(remaining, false);

  return {
    elapsedSeconds: elapsed,
    remainingSeconds: remaining,
    overtimeSeconds: overtime,
    isOvertime,
    isWarning,
    formattedDisplay,
  };
}
