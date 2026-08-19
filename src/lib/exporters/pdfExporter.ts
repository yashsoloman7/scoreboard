// src/lib/exporters/pdfExporter.ts - Official Competition PDF Certificate & Judging Sheet

import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { ResultEntry } from '@/types';

export function generateOfficialJudgingSheetPdf(
  competitionName: string,
  categoryName: string,
  entries: ResultEntry[],
  sha256Checksum = 'SEALED_OFFICIAL_DOCUMENT'
): jsPDF {
  const doc = new jsPDF();

  // Header Branding
  doc.setFontSize(18);
  doc.setTextColor(30, 41, 59);
  doc.text(competitionName, 14, 20);

  doc.setFontSize(13);
  doc.setTextColor(71, 85, 105);
  doc.text(`Official Certified Results: ${categoryName}`, 14, 28);

  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text(`Generated: ${new Date().toUTCString()} | Digital Seal: ${sha256Checksum.substring(0, 16)}...`, 14, 34);

  // Table Data
  const tableData = entries.map((e) => [
    `#${e.rank}`,
    e.finalScore.toFixed(3),
    e.rawAverage.toFixed(3),
    `±${e.standardDeviation.toFixed(3)}`,
    e.judgeCount.toString(),
    e.tieResolutionNote || (e.isTie ? 'Tie' : 'Clear'),
  ]);

  (doc as any).autoTable({
    startY: 40,
    head: [['Rank', 'Final Score', 'Raw Average', 'Variance (σ)', 'Judges', 'Scrutiny Notes']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 3 },
  });

  // Signatures Section
  const finalY = (doc as any).lastAutoTable?.finalY || 150;
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text('Chief Scrutineer Signature: _______________________', 14, finalY + 25);
  doc.text('Lead Jury Chair Signature: _______________________', 110, finalY + 25);

  return doc;
}
