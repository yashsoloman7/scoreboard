// src/lib/results/scoringEngine.ts - Mathematical Result Calculation Engine

import { ScoringFormula, ScoreSubmission } from '@/types';

export interface PerformanceCalculatedScore {
  performanceId: string;
  finalScore: number;
  rawAverage: number;
  totalSum: number;
  standardDeviation: number;
  medianScore: number;
  judgeCount: number;
  criteriaAverages: Record<string, number>;
  judgeBreakdown: {
    judgeId: string;
    judgeSeat: number;
    rawTotal: number;
    weightedTotal: number;
    entries: Record<string, number>;
  }[];
}

/**
 * Calculates arithmetic mean
 */
export function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return sum / values.length;
}

/**
 * Calculates population standard deviation (judge variance / consistency metric)
 */
export function calculateStandardDeviation(values: number[]): number {
  if (values.length <= 1) return 0;
  const mean = calculateMean(values);
  const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Calculates median score
 */
export function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Computes official final score according to the configured scoring formula
 */
export function calculatePerformanceScore(
  performanceId: string,
  submissions: ScoreSubmission[],
  formula: ScoringFormula = 'weighted_sum'
): PerformanceCalculatedScore {
  const judgeCount = submissions.length;
  if (judgeCount === 0) {
    return {
      performanceId,
      finalScore: 0,
      rawAverage: 0,
      totalSum: 0,
      standardDeviation: 0,
      medianScore: 0,
      judgeCount: 0,
      criteriaAverages: {},
      judgeBreakdown: [],
    };
  }

  const rawTotals = submissions.map((s) => Number(s.totalRawScore));
  const weightedTotals = submissions.map((s) => Number(s.totalWeightedScore));

  const rawAverage = calculateMean(rawTotals);
  const totalSum = rawTotals.reduce((acc, v) => acc + v, 0);
  const standardDeviation = calculateStandardDeviation(rawTotals);
  const medianScore = calculateMedian(rawTotals);

  // Criteria-level averages across judges
  const criteriaTotals: Record<string, { sum: number; count: number }> = {};
  const judgeBreakdown = submissions.map((sub, idx) => {
    const entriesMap: Record<string, number> = {};
    sub.entries.forEach((e) => {
      entriesMap[e.criterionId] = Number(e.rawScore);
      if (!criteriaTotals[e.criterionId]) {
        criteriaTotals[e.criterionId] = { sum: 0, count: 0 };
      }
      criteriaTotals[e.criterionId].sum += Number(e.rawScore);
      criteriaTotals[e.criterionId].count += 1;
    });

    return {
      judgeId: sub.judgeId,
      judgeSeat: idx + 1,
      rawTotal: Number(sub.totalRawScore),
      weightedTotal: Number(sub.totalWeightedScore),
      entries: entriesMap,
    };
  });

  const criteriaAverages: Record<string, number> = {};
  for (const [critId, data] of Object.entries(criteriaTotals)) {
    criteriaAverages[critId] = data.count > 0 ? Number((data.sum / data.count).toFixed(3)) : 0;
  }

  let finalScore = 0;

  switch (formula) {
    case 'weighted_sum':
      finalScore = calculateMean(weightedTotals);
      break;

    case 'average':
      finalScore = rawAverage;
      break;

    case 'total_sum':
      finalScore = totalSum;
      break;

    case 'olympic':
      // Drops highest and lowest if 4 or more judges; otherwise calculates mean
      if (judgeCount >= 4) {
        const sorted = [...weightedTotals].sort((a, b) => a - b);
        const trimmed = sorted.slice(1, sorted.length - 1);
        finalScore = calculateMean(trimmed);
      } else {
        finalScore = calculateMean(weightedTotals);
      }
      break;

    default:
      finalScore = calculateMean(weightedTotals);
  }

  return {
    performanceId,
    finalScore: Number(finalScore.toFixed(3)),
    rawAverage: Number(rawAverage.toFixed(3)),
    totalSum: Number(totalSum.toFixed(3)),
    standardDeviation: Number(standardDeviation.toFixed(3)),
    medianScore: Number(medianScore.toFixed(3)),
    judgeCount,
    criteriaAverages,
    judgeBreakdown,
  };
}
