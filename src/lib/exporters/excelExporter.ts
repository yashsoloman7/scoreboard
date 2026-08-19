// src/lib/exporters/excelExporter.ts - Multi-Sheet Excel Exporter

import * as XLSX from 'xlsx';
import { ResultEntry, Award } from '@/types';

export function exportFullCompetitionWorkbook(
  competitionName: string,
  categoryResults: { categoryName: string; entries: ResultEntry[] }[],
  awards: Award[]
): Uint8Array {
  const workbook = XLSX.utils.book_new();

  // 1. Category Results Sheets
  for (const cat of categoryResults) {
    const rows = cat.entries.map((e) => ({
      Rank: e.rank,
      FinalScore: e.finalScore,
      RawAverage: e.rawAverage,
      StdDev: e.standardDeviation,
      Judges: e.judgeCount,
      TieResolved: e.tieResolutionNote || (e.isTie ? 'Tie Pending' : 'Clear'),
    }));

    const sheet = XLSX.utils.json_to_sheet(rows);
    const sheetName = cat.categoryName.substring(0, 31).replace(/[:\/\\?*\[\]]/g, '');
    XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  }

  // 2. Awards Sheet
  const awardRows = awards.map((a) => ({
    Code: a.code,
    AwardTitle: a.name,
    Description: a.description,
    WinnerCount: a.winners?.length || 0,
  }));
  const awardSheet = XLSX.utils.json_to_sheet(awardRows);
  XLSX.utils.book_append_sheet(workbook, awardSheet, 'Awards Summary');

  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
}
