// src/lib/exporters/csvExporter.ts - CSV Result & Submission Exporter

import Papa from 'papaparse';
import { ResultEntry } from '@/types';

export function exportResultsToCsv(entries: ResultEntry[]): string {
  const flattened = entries.map((e) => ({
    Rank: e.rank,
    Score: e.finalScore,
    RawAverage: e.rawAverage,
    StdDeviation: e.standardDeviation,
    JudgesCount: e.judgeCount,
    IsTie: e.isTie ? 'YES' : 'NO',
    TieNotes: e.tieResolutionNote || '',
    PerformanceId: e.performanceId,
  }));

  return Papa.unparse(flattened);
}
