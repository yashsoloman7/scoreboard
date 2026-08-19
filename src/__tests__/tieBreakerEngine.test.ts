// src/__tests__/tieBreakerEngine.test.ts - Unit Tests for Deterministic Tie-Breaker Pipeline

import { describe, it, expect } from 'vitest';
import { rankPerformancesWithTieBreakers } from '../lib/results/tieBreakerEngine';
import { PerformanceCalculatedScore } from '../lib/results/scoringEngine';
import { TieBreakRule } from '../types';

describe('Deterministic Tie-Breaker Priority Pipeline', () => {
  it('ranks higher final score first without tie', () => {
    const p1: PerformanceCalculatedScore = {
      performanceId: 'p1',
      finalScore: 92.5,
      rawAverage: 92.5,
      totalSum: 185,
      standardDeviation: 1.0,
      medianScore: 92.5,
      judgeCount: 2,
      criteriaAverages: {},
      judgeBreakdown: [],
    };

    const p2: PerformanceCalculatedScore = {
      performanceId: 'p2',
      finalScore: 89.0,
      rawAverage: 89.0,
      totalSum: 178,
      standardDeviation: 1.0,
      medianScore: 89.0,
      judgeCount: 2,
      criteriaAverages: {},
      judgeBreakdown: [],
    };

    const ranked = rankPerformancesWithTieBreakers([p2, p1]);
    expect(ranked[0].performanceId).toBe('p1');
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].performanceId).toBe('p2');
    expect(ranked[1].rank).toBe(2);
  });

  it('resolves tie using Priority 1: Highest Raw Average', () => {
    const p1: PerformanceCalculatedScore = {
      performanceId: 'p1',
      finalScore: 90.0,
      rawAverage: 91.5, // Higher raw average
      totalSum: 183,
      standardDeviation: 2.0,
      medianScore: 90.0,
      judgeCount: 2,
      criteriaAverages: {},
      judgeBreakdown: [],
    };

    const p2: PerformanceCalculatedScore = {
      performanceId: 'p2',
      finalScore: 90.0,
      rawAverage: 88.5,
      totalSum: 177,
      standardDeviation: 2.0,
      medianScore: 90.0,
      judgeCount: 2,
      criteriaAverages: {},
      judgeBreakdown: [],
    };

    const rules: TieBreakRule[] = [
      { id: 'r1', categoryId: 'cat1', priorityOrder: 1, ruleType: 'highest_average', createdAt: '' },
    ];

    const ranked = rankPerformancesWithTieBreakers([p2, p1], rules);
    expect(ranked[0].performanceId).toBe('p1');
    expect(ranked[0].rank).toBe(1);
    expect(ranked[0].tieResolutionNote).toContain('Highest Raw Average');
  });

  it('resolves tie using Lower Judge Variance (Standard Deviation consistency)', () => {
    const p1: PerformanceCalculatedScore = {
      performanceId: 'p1',
      finalScore: 90.0,
      rawAverage: 90.0,
      totalSum: 180,
      standardDeviation: 0.5, // Much tighter consensus
      medianScore: 90.0,
      judgeCount: 2,
      criteriaAverages: {},
      judgeBreakdown: [],
    };

    const p2: PerformanceCalculatedScore = {
      performanceId: 'p2',
      finalScore: 90.0,
      rawAverage: 90.0,
      totalSum: 180,
      standardDeviation: 5.0, // High variance
      medianScore: 90.0,
      judgeCount: 2,
      criteriaAverages: {},
      judgeBreakdown: [],
    };

    const rules: TieBreakRule[] = [
      { id: 'r1', categoryId: 'c1', priorityOrder: 1, ruleType: 'lowest_variance', createdAt: '' },
    ];

    const ranked = rankPerformancesWithTieBreakers([p2, p1], rules);
    expect(ranked[0].performanceId).toBe('p1');
    expect(ranked[0].rank).toBe(1);
    expect(ranked[0].tieResolutionNote).toContain('Lower Judge Variance');
  });

  it('flags unresolvable ties for Manual Jury Decision', () => {
    const p1: PerformanceCalculatedScore = {
      performanceId: 'p1',
      finalScore: 90.0,
      rawAverage: 90.0,
      totalSum: 180,
      standardDeviation: 1.0,
      medianScore: 90.0,
      judgeCount: 2,
      criteriaAverages: {},
      judgeBreakdown: [],
    };

    const p2: PerformanceCalculatedScore = {
      performanceId: 'p2',
      finalScore: 90.0,
      rawAverage: 90.0,
      totalSum: 180,
      standardDeviation: 1.0,
      medianScore: 90.0,
      judgeCount: 2,
      criteriaAverages: {},
      judgeBreakdown: [],
    };

    const ranked = rankPerformancesWithTieBreakers([p1, p2], []);
    expect(ranked[1].isTie).toBe(true);
    expect(ranked[1].tieResolutionNote).toContain('MANUAL JURY DECISION REQUIRED');
  });
});
