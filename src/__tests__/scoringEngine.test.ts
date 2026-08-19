// src/__tests__/scoringEngine.test.ts - Unit Tests for Mathematical Scoring Engine

import { describe, it, expect } from 'vitest';
import {
  calculateMean,
  calculateStandardDeviation,
  calculateMedian,
  calculatePerformanceScore,
} from '../lib/results/scoringEngine';
import { ScoreSubmission } from '../types';

describe('Scoring Engine Mathematical Calculations', () => {
  it('calculates arithmetic mean correctly', () => {
    expect(calculateMean([10, 20, 30])).toBe(20);
    expect(calculateMean([8.5, 9.5])).toBe(9);
    expect(calculateMean([])).toBe(0);
  });

  it('calculates standard deviation (judge variance) correctly', () => {
    // Identical scores -> 0 standard deviation (perfect consensus)
    expect(calculateStandardDeviation([9, 9, 9])).toBe(0);

    // Varied scores [10, 12, 23, 23, 16, 23, 21, 16]
    // Mean = 18.0, Variance = 24.0, StdDev = sqrt(24) = 4.89897...
    const std = calculateStandardDeviation([10, 12, 23, 23, 16, 23, 21, 16]);
    expect(std).toBeCloseTo(4.899, 2);
  });

  it('calculates median correctly for odd and even count', () => {
    expect(calculateMedian([5, 1, 9])).toBe(5); // sorted: [1, 5, 9] -> 5
    expect(calculateMedian([10, 20, 30, 40])).toBe(25); // (20+30)/2 -> 25
  });

  it('calculates Weighted Sum scoring formula correctly', () => {
    const submissions: ScoreSubmission[] = [
      {
        id: 'sub-1',
        performanceId: 'perf-1',
        judgeId: 'judge-1',
        criteriaVersionId: 'ver-1',
        status: 'locked',
        idempotencyKey: 'idemp-1',
        totalRawScore: 85,
        totalWeightedScore: 88,
        entries: [],
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 'sub-2',
        performanceId: 'perf-1',
        judgeId: 'judge-2',
        criteriaVersionId: 'ver-1',
        status: 'locked',
        idempotencyKey: 'idemp-2',
        totalRawScore: 90,
        totalWeightedScore: 92,
        entries: [],
        createdAt: '',
        updatedAt: '',
      },
    ];

    const result = calculatePerformanceScore('perf-1', submissions, 'weighted_sum');
    // Mean of [88, 92] is 90.000
    expect(result.finalScore).toBe(90.0);
    expect(result.rawAverage).toBe(87.5);
    expect(result.judgeCount).toBe(2);
  });

  it('calculates Olympic Trimmed Mean dropping highest and lowest score for 4+ judges', () => {
    const submissions: ScoreSubmission[] = [
      { id: '1', performanceId: 'p1', judgeId: 'j1', criteriaVersionId: 'v1', status: 'locked', idempotencyKey: 'k1', totalRawScore: 70, totalWeightedScore: 70, entries: [], createdAt: '', updatedAt: '' },
      { id: '2', performanceId: 'p1', judgeId: 'j2', criteriaVersionId: 'v1', status: 'locked', idempotencyKey: 'k2', totalRawScore: 80, totalWeightedScore: 80, entries: [], createdAt: '', updatedAt: '' },
      { id: '3', performanceId: 'p1', judgeId: 'j3', criteriaVersionId: 'v1', status: 'locked', idempotencyKey: 'k3', totalRawScore: 90, totalWeightedScore: 90, entries: [], createdAt: '', updatedAt: '' },
      { id: '4', performanceId: 'p1', judgeId: 'j4', criteriaVersionId: 'v1', status: 'locked', idempotencyKey: 'k4', totalRawScore: 100, totalWeightedScore: 100, entries: [], createdAt: '', updatedAt: '' },
    ];

    const result = calculatePerformanceScore('p1', submissions, 'olympic');
    // Sorted: [70, 80, 90, 100], Trimmed: [80, 90], Mean = 85
    expect(result.finalScore).toBe(85.0);
  });
});
