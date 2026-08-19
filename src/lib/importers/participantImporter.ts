// src/lib/importers/participantImporter.ts - CSV & Excel Participant/Team Parser & Validator

import { ParticipantImportRowSchema, TeamImportRowSchema } from '../validation/schemas';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

export interface ImportValidationResult<T> {
  validRows: T[];
  invalidRows: { rowNumber: number; data: Record<string, unknown>; errors: string[] }[];
  duplicates: { rowNumber: number; code: string }[];
  totalRows: number;
}

export interface ParsedParticipantRow {
  participantCode: string;
  firstName: string;
  lastName: string;
  institution?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  categoryName?: string;
  performanceOrder?: number;
}

export interface ParsedTeamRow {
  teamCode: string;
  teamName: string;
  institution?: string | null;
  categoryName?: string;
  performanceOrder?: number;
  members?: { firstName: string; lastName: string; role: string; contactEmail?: string | null }[];
}

/**
 * Normalizes keys to lowerCamelCase / standard headers
 */
function normalizeRowKeys(row: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const cleanKey = key.trim().toLowerCase().replace(/[\s_-]+([a-z0-9])/gi, (_, letter) => letter.toUpperCase());
    
    // Map common column alias variations
    if (['code', 'participantcode', 'bib', 'chestno', 'chestnumber', 'id'].includes(cleanKey.toLowerCase())) {
      normalized['participantCode'] = String(value || '').trim();
      normalized['teamCode'] = String(value || '').trim();
    } else if (['name', 'fullname', 'performername'].includes(cleanKey.toLowerCase())) {
      const parts = String(value || '').trim().split(' ');
      normalized['firstName'] = parts[0] || '';
      normalized['lastName'] = parts.slice(1).join(' ') || '';
      normalized['teamName'] = String(value || '').trim();
    } else if (['firstname', 'first'].includes(cleanKey.toLowerCase())) {
      normalized['firstName'] = String(value || '').trim();
    } else if (['lastname', 'last', 'surname'].includes(cleanKey.toLowerCase())) {
      normalized['lastName'] = String(value || '').trim();
    } else if (['team', 'teamname', 'groupname'].includes(cleanKey.toLowerCase())) {
      normalized['teamName'] = String(value || '').trim();
    } else if (['institution', 'school', 'college', 'academy', 'org'].includes(cleanKey.toLowerCase())) {
      normalized['institution'] = String(value || '').trim();
    } else if (['email', 'contactemail'].includes(cleanKey.toLowerCase())) {
      normalized['contactEmail'] = String(value || '').trim();
    } else if (['phone', 'contactphone', 'mobile'].includes(cleanKey.toLowerCase())) {
      normalized['contactPhone'] = String(value || '').trim();
    } else if (['category', 'categoryname', 'event'].includes(cleanKey.toLowerCase())) {
      normalized['categoryName'] = String(value || '').trim();
    } else if (['order', 'performanceorder', 'seq', 'slot'].includes(cleanKey.toLowerCase())) {
      normalized['performanceOrder'] = Number(value) || undefined;
    } else {
      normalized[cleanKey] = value;
    }
  }
  return normalized;
}

/**
 * Parses raw CSV string or ArrayBuffer Excel file into validated participant rows
 */
export function parseAndValidateParticipants(
  fileContent: string | ArrayBuffer,
  fileType: 'csv' | 'xlsx'
): ImportValidationResult<ParsedParticipantRow> {
  let rawRows: Record<string, unknown>[] = [];

  if (fileType === 'csv') {
    const csvString = typeof fileContent === 'string' ? fileContent : new TextDecoder().decode(fileContent);
    const parsed = Papa.parse<Record<string, unknown>>(csvString, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
    });
    rawRows = parsed.data;
  } else {
    const workbook = XLSX.read(fileContent, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);
  }

  const validRows: ParsedParticipantRow[] = [];
  const invalidRows: { rowNumber: number; data: Record<string, unknown>; errors: string[] }[] = [];
  const duplicates: { rowNumber: number; code: string }[] = [];
  const seenCodes = new Set<string>();

  rawRows.forEach((rawRow, index) => {
    const rowNumber = index + 2; // Accounting for 1-based index and header row
    const normalized = normalizeRowKeys(rawRow);

    const validation = ParticipantImportRowSchema.safeParse(normalized);
    if (!validation.success) {
      invalidRows.push({
        rowNumber,
        data: rawRow,
        errors: validation.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
      });
      return;
    }

    const validData = validation.data as ParsedParticipantRow;

    if (seenCodes.has(validData.participantCode.toUpperCase())) {
      duplicates.push({ rowNumber, code: validData.participantCode });
    } else {
      seenCodes.add(validData.participantCode.toUpperCase());
    }

    validRows.push(validData);
  });

  return {
    validRows,
    invalidRows,
    duplicates,
    totalRows: rawRows.length,
  };
}

/**
 * Parses raw CSV/Excel file into validated team rows with members
 */
export function parseAndValidateTeams(
  fileContent: string | ArrayBuffer,
  fileType: 'csv' | 'xlsx'
): ImportValidationResult<ParsedTeamRow> {
  let rawRows: Record<string, unknown>[] = [];

  if (fileType === 'csv') {
    const csvString = typeof fileContent === 'string' ? fileContent : new TextDecoder().decode(fileContent);
    const parsed = Papa.parse<Record<string, unknown>>(csvString, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
    });
    rawRows = parsed.data;
  } else {
    const workbook = XLSX.read(fileContent, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);
  }

  const validRows: ParsedTeamRow[] = [];
  const invalidRows: { rowNumber: number; data: Record<string, unknown>; errors: string[] }[] = [];
  const duplicates: { rowNumber: number; code: string }[] = [];
  const seenCodes = new Set<string>();

  rawRows.forEach((rawRow, index) => {
    const rowNumber = index + 2;
    const normalized = normalizeRowKeys(rawRow);

    const validation = TeamImportRowSchema.safeParse(normalized);
    if (!validation.success) {
      invalidRows.push({
        rowNumber,
        data: rawRow,
        errors: validation.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
      });
      return;
    }

    const validData = validation.data as ParsedTeamRow;

    if (seenCodes.has(validData.teamCode.toUpperCase())) {
      duplicates.push({ rowNumber, code: validData.teamCode });
    } else {
      seenCodes.add(validData.teamCode.toUpperCase());
    }

    validRows.push(validData);
  });

  return {
    validRows,
    invalidRows,
    duplicates,
    totalRows: rawRows.length,
  };
}
