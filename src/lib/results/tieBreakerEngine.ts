// src/lib/results/tieBreakerEngine.ts - Deterministic Multi-Tier Tie-Breaker Pipeline

import { TieBreakRule } from '@/types';
import { PerformanceCalculatedScore } from './scoringEngine';

export interface RankedPerformanceEntry {
  performanceId: string;
  rank: number;
  finalScore: number;
  calculated: PerformanceCalculatedScore;
  isTie: boolean;
  tieResolutionNote?: string;
}

/**
 * Ranks performances with multi-tier tie-breaking
 */
export function rankPerformancesWithTieBreakers(
  performances: PerformanceCalculatedScore[],
  rules: TieBreakRule[] = []
): RankedPerformanceEntry[] {
  // Sort rules by priority order
  const sortedRules = [...rules].sort((a, b) => a.priorityOrder - b.priorityOrder);

  // Comparator applying tie break rules sequentially
  const comparator = (a: PerformanceCalculatedScore, b: PerformanceCalculatedScore): { diff: number; note?: string } => {
    // Primary score comparison (to 3 decimal places)
    const scoreDiff = b.finalScore - a.finalScore;
    if (Math.abs(scoreDiff) >= 0.001) {
      return { diff: scoreDiff };
    }

    // Scores are tied: Run through configured priority rules
    for (const rule of sortedRules) {
      if (rule.ruleType === 'highest_average') {
        const avgDiff = b.rawAverage - a.rawAverage;
        if (Math.abs(avgDiff) >= 0.001) {
          return { diff: avgDiff, note: `Resolved by Highest Raw Average (${b.rawAverage.toFixed(2)} vs ${a.rawAverage.toFixed(2)})` };
        }
      } else if (rule.ruleType === 'priority_criterion' && rule.targetCriterionId) {
        const aCrit = a.criteriaAverages[rule.targetCriterionId] || 0;
        const bCrit = b.criteriaAverages[rule.targetCriterionId] || 0;
        const critDiff = bCrit - aCrit;
        if (Math.abs(critDiff) >= 0.001) {
          return { diff: critDiff, note: `Resolved by Priority Criterion (${bCrit.toFixed(2)} vs ${aCrit.toFixed(2)})` };
        }
      } else if (rule.ruleType === 'lowest_variance') {
        // Lower standard deviation wins (more consistent)
        const stdDiff = a.standardDeviation - b.standardDeviation;
        if (Math.abs(stdDiff) >= 0.001) {
          return { diff: stdDiff, note: `Resolved by Lower Judge Variance (σ: ${a.standardDeviation.toFixed(2)} vs ${b.standardDeviation.toFixed(2)})` };
        }
      } else if (rule.ruleType === 'highest_median') {
        const medDiff = b.medianScore - a.medianScore;
        if (Math.abs(medDiff) >= 0.001) {
          return { diff: medDiff, note: `Resolved by Highest Median Score (${b.medianScore.toFixed(2)} vs ${a.medianScore.toFixed(2)})` };
        }
      }
    }

    // Persistent tie requiring manual jury decision
    return { diff: 0, note: 'TIE: MANUAL JURY DECISION REQUIRED' };
  };

  // Sort list
  const sorted = [...performances].sort((a, b) => comparator(a, b).diff);

  const results: RankedPerformanceEntry[] = [];
  let currentRank = 1;

  for (let i = 0; i < sorted.length; i++) {
    const item = sorted[i];
    let isTie = false;
    let tieNote: string | undefined;

    if (i > 0) {
      const prev = sorted[i - 1];
      const comp = comparator(prev, item);
      const isPrimaryScoreTied = Math.abs(prev.finalScore - item.finalScore) < 0.001;

      if (comp.diff === 0) {
        isTie = true;
        tieNote = comp.note;
        // Also tag previous if exact tie
        if (results[i - 1]) {
          results[i - 1].isTie = true;
          results[i - 1].tieResolutionNote = comp.note;
        }
      } else {
        currentRank = i + 1;
        if (isPrimaryScoreTied && comp.note) {
          tieNote = comp.note;
          if (results[i - 1] && !results[i - 1].tieResolutionNote) {
            results[i - 1].tieResolutionNote = comp.note;
          }
        }
      }
    }

    results.push({
      performanceId: item.performanceId,
      rank: currentRank,
      finalScore: item.finalScore,
      calculated: item,
      isTie,
      tieResolutionNote: tieNote,
    });
  }

  return results;
}
