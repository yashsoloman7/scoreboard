// src/lib/importers/participantImporter.ts - Google Form & CSV Participant/Church Parser & Validator

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
  firstName?: string;
  lastName?: string;
  teamName?: string | null;
  churchName?: string | null;
  participantName?: string | null;
  performanceType: 'solo' | 'duet' | 'group';
  bestKeyboardist?: string | null;
  bestRhythmist?: string | null;
  bestGuitarist?: string | null;
  institution?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  categoryName?: string;
  performanceOrder?: number;
}

export interface GoogleFormChurchRegistration {
  rowNumber: number;
  performanceOrder?: number;
  timestamp?: string;
  email?: string;
  churchName: string;
  pastorName?: string;
  choirLeaderName?: string;
  soloParticipantName?: string;
  duetParticipant1?: string;
  duetParticipant2?: string;
  instrumentPlayersText?: string;
  // Specific Instruments
  keyboardist?: string | null;
  harmonium?: string | null;
  guitarist?: string | null;
  electricGuitarist?: string | null;
  bassGuitarist?: string | null;
  octopadDrums?: string | null;
  dholak?: string | null;
  tablaNaal?: string | null;
  clapBox?: string | null;
  saxophone?: string | null;
  basuri?: string | null;
  // Award Nominees
  bestKeyboardist?: string | null;
  bestRhythmist?: string | null;
  bestGuitarist?: string | null;
  numberOfParticipants?: number;
  numberOfExtraPersons?: number;
}

export interface ParsedTeamRow {
  teamCode: string;
  teamName: string;
  churchName?: string | null;
  institution?: string | null;
  categoryName?: string;
  performanceOrder?: number;
  members?: { firstName: string; lastName: string; role: string; contactEmail?: string | null }[];
}

/**
 * Parses raw text containing instrument names and performer names.
 */
export function extractInstrumentalists(rawText?: string | null): {
  keyboardist: string | null;
  rhythmist: string | null;
  guitarist: string | null;
} {
  if (!rawText || !rawText.trim()) {
    return { keyboardist: null, rhythmist: null, guitarist: null };
  }

  const text = rawText.trim();
  let keyboardist: string | null = null;
  let rhythmist: string | null = null;
  let guitarist: string | null = null;

  const segments = text.split(/[,;\n/]+/).map((s) => s.trim()).filter(Boolean);

  for (const seg of segments) {
    const lower = seg.toLowerCase();

    // 1. Keyboardist Detection
    if (lower.includes('key') || lower.includes('pian') || lower.includes('organ') || lower.includes('synth') || lower.includes('harmon')) {
      const cleaned = seg.replace(/(best\s*)?(keyboardist|keyboard|keys|pianist|piano|organ|synth|harmonium)(\s*[:\-=])?/gi, '').replace(/[()]/g, '').trim();
      if (cleaned) keyboardist = cleaned;
    }
    // 2. Rhythmist / Drummer Detection
    else if (lower.includes('drum') || lower.includes('rhythm') || lower.includes('cajon') || lower.includes('octapad') || lower.includes('octopad') || lower.includes('pad') || lower.includes('perc') || lower.includes('dhol') || lower.includes('tabla') || lower.includes('naal') || lower.includes('clap')) {
      const cleaned = seg.replace(/(best\s*)?(rhythmist|drummer|drums|cajon|octapad|octopad|percussion|pad|dholak|dhol|tabla|naal|clap\s*box)(\s*[:\-=])?/gi, '').replace(/[()]/g, '').trim();
      if (cleaned) rhythmist = cleaned;
    }
    // 3. Guitarist Detection
    else if (lower.includes('guitar') || lower.includes('lead') || lower.includes('bass') || lower.includes('acoustic') || lower.includes('electric')) {
      const cleaned = seg.replace(/(best\s*)?(guitarist|guitar|lead\s*guitar|electric\s*guitar|bass\s*guitar|acoustic)(\s*[:\-=])?/gi, '').replace(/[()]/g, '').trim();
      if (cleaned) guitarist = cleaned;
    }
  }

  // Fallback: If segments didn't match keywords, map first 3 segments if present
  if (!keyboardist && !rhythmist && !guitarist && segments.length > 0) {
    if (segments[0]) keyboardist = segments[0];
    if (segments[1]) rhythmist = segments[1];
    if (segments[2]) guitarist = segments[2];
  }

  return { keyboardist, rhythmist, guitarist };
}

/**
 * Normalizes keys to lowerCamelCase / standard headers for CSV & Google Form imports
 */
function normalizeRowKeys(row: Record<string, unknown>, index = 0): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const cleanKey = key.trim().toLowerCase().replace(/[\s_-]+([a-z0-9])/gi, (_, letter) => letter.toUpperCase());
    const lowerKey = key.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const strVal = String(value ?? '').trim();
    
    // 1. Serial / Order
    if (['sno', 'slno', 'sno.', 'serialno', 'order', 'performanceorder', 'seq', 'slot'].includes(lowerKey)) {
      normalized['performanceOrder'] = Number(strVal) || index + 1;
    }
    // 2. Church / Team Name
    else if (['churchname', 'church', 'parish', 'congregation'].includes(lowerKey)) {
      normalized['churchName'] = strVal;
      if (!normalized['institution']) normalized['institution'] = strVal;
      if (!normalized['teamName']) normalized['teamName'] = strVal;
    } else if (['teamname', 'team', 'groupname', 'bandname'].includes(lowerKey)) {
      normalized['teamName'] = strVal;
      if (!normalized['churchName']) normalized['churchName'] = strVal;
    } else if (['institution', 'school', 'college', 'academy', 'org'].includes(lowerKey)) {
      normalized['institution'] = strVal;
      if (!normalized['churchName']) normalized['churchName'] = strVal;
    }
    // 3. Solo Participant
    else if (['soloname', 'soloparticipantname', 'soloparticpantname', 'soloperformer', 'solo'].includes(lowerKey)) {
      normalized['soloParticipantName'] = strVal;
      normalized['participantName'] = strVal;
      const parts = strVal.split(' ');
      normalized['firstName'] = parts[0] || '';
      normalized['lastName'] = parts.slice(1).join(' ') || '';
    }
    // 4. Duet Participant
    else if (['duetname', 'duetparticipantname', 'duetparticipantname1', 'duetparticpantname1', 'duetperformer1', 'duet1', 'duet'].includes(lowerKey)) {
      normalized['duetParticipant1'] = strVal;
    } else if (['duetparticipantname2', 'duetparticpantname2', 'duetperformer2', 'duet2'].includes(lowerKey)) {
      normalized['duetParticipant2'] = strVal;
    }
    // 5. Leader / Pastor
    else if (['choirleadername', 'choirleader', 'leadername', 'leader'].includes(lowerKey)) {
      normalized['choirLeaderName'] = strVal;
    } else if (['pastorfathername', 'pastorname', 'fathername', 'pastor', 'father'].includes(lowerKey)) {
      normalized['pastorName'] = strVal;
    }
    // 6. Specific Instrument Columns & Awards
    else if (['bestkeyboardist', 'keyboard', 'keys', 'pianist', 'piano'].includes(lowerKey)) {
      normalized['keyboardist'] = strVal || null;
      normalized['bestKeyboardist'] = strVal || null;
    } else if (['bestrhythmist', 'rhythmist', 'drums', 'drummer', 'percussion', 'octopaddrums', 'octopad', 'octapad', 'octapaddrums'].includes(lowerKey)) {
      normalized['octopadDrums'] = strVal || null;
      normalized['bestRhythmist'] = strVal || null;
    } else if (['bestguitarist', 'guitar', 'guitarist', 'acousticguitar', 'leadguitar'].includes(lowerKey)) {
      normalized['guitarist'] = strVal || null;
      normalized['bestGuitarist'] = strVal || null;
    } else if (['electricguitar'].includes(lowerKey)) {
      normalized['electricGuitarist'] = strVal || null;
      if (!normalized['bestGuitarist']) normalized['bestGuitarist'] = strVal || null;
    } else if (['bassguitar', 'bass'].includes(lowerKey)) {
      normalized['bassGuitarist'] = strVal || null;
      if (!normalized['bestGuitarist']) normalized['bestGuitarist'] = strVal || null;
    } else if (['dholak', 'dhol'].includes(lowerKey)) {
      normalized['dholak'] = strVal || null;
      if (!normalized['bestRhythmist']) normalized['bestRhythmist'] = strVal || null;
    } else if (['harmonium'].includes(lowerKey)) {
      normalized['harmonium'] = strVal || null;
      if (!normalized['bestKeyboardist']) normalized['bestKeyboardist'] = strVal || null;
    } else if (['tablanaal', 'tabla', 'naal'].includes(lowerKey)) {
      normalized['tablaNaal'] = strVal || null;
      if (!normalized['bestRhythmist']) normalized['bestRhythmist'] = strVal || null;
    } else if (['clapbox', 'cajon'].includes(lowerKey)) {
      normalized['clapBox'] = strVal || null;
      if (!normalized['bestRhythmist']) normalized['bestRhythmist'] = strVal || null;
    } else if (['saxophone', 'sax'].includes(lowerKey)) {
      normalized['saxophone'] = strVal || null;
    } else if (['basuri', 'flute', 'bansuri'].includes(lowerKey)) {
      normalized['basuri'] = strVal || null;
    }
    // 7. General Instruments Text
    else if (['totalinstrumentplayerwithinstrumentname', 'instrumentplayers', 'instruments', 'instrumentalist'].includes(lowerKey)) {
      normalized['instrumentPlayersText'] = strVal;
      const instruments = extractInstrumentalists(strVal);
      if (instruments.keyboardist) {
        normalized['keyboardist'] = instruments.keyboardist;
        normalized['bestKeyboardist'] = instruments.keyboardist;
      }
      if (instruments.rhythmist) {
        normalized['octopadDrums'] = instruments.rhythmist;
        normalized['bestRhythmist'] = instruments.rhythmist;
      }
      if (instruments.guitarist) {
        normalized['guitarist'] = instruments.guitarist;
        normalized['bestGuitarist'] = instruments.guitarist;
      }
    }
    // 8. General Participant Fields
    else if (['name', 'fullname', 'performername', 'performer', 'participant', 'participantname'].includes(lowerKey)) {
      normalized['participantName'] = strVal;
      const parts = strVal.split(' ');
      normalized['firstName'] = parts[0] || '';
      normalized['lastName'] = parts.slice(1).join(' ') || '';
    } else if (['firstname', 'first'].includes(lowerKey)) {
      normalized['firstName'] = strVal;
    } else if (['lastname', 'last', 'surname'].includes(lowerKey)) {
      normalized['lastName'] = strVal;
    } else if (['code', 'participantcode', 'bib', 'chestno', 'chestnumber', 'id', 'rollno'].includes(lowerKey)) {
      normalized['participantCode'] = strVal;
      normalized['teamCode'] = strVal;
    } else if (['type', 'performancetype', 'eventtype', 'format'].includes(lowerKey)) {
      const typeVal = strVal.toLowerCase();
      if (typeVal.includes('duet')) normalized['performanceType'] = 'duet';
      else if (typeVal.includes('group') || typeVal.includes('choir') || typeVal.includes('band')) normalized['performanceType'] = 'group';
      else normalized['performanceType'] = 'solo';
    } else if (['noofparticipants', 'noofparticpants', 'participantscount', 'count'].includes(lowerKey)) {
      normalized['numberOfParticipants'] = Number(strVal) || undefined;
    } else if (['noofextraperson', 'extrapersons', 'extra'].includes(lowerKey)) {
      normalized['numberOfExtraPersons'] = Number(strVal) || undefined;
    } else if (['timestamp', 'time'].includes(lowerKey)) {
      normalized['timestamp'] = strVal;
    } else if (['emailaddress', 'email', 'contactemail'].includes(lowerKey)) {
      normalized['contactEmail'] = strVal;
      normalized['email'] = strVal;
    } else if (['phone', 'contactphone', 'mobile'].includes(lowerKey)) {
      normalized['contactPhone'] = strVal;
    } else if (['category', 'categoryname', 'event'].includes(lowerKey)) {
      normalized['categoryName'] = strVal;
    } else {
      normalized[cleanKey] = value;
    }
  }

  // Determine Primary Instrument Award Nominees
  normalized['bestKeyboardist'] = (normalized['keyboardist'] || normalized['harmonium'] || null) as string | null;
  normalized['bestRhythmist'] = (normalized['octopadDrums'] || normalized['dholak'] || normalized['tablaNaal'] || normalized['clapBox'] || null) as string | null;
  normalized['bestGuitarist'] = (normalized['guitarist'] || normalized['electricGuitarist'] || normalized['bassGuitarist'] || null) as string | null;

  // Fallbacks
  if (!normalized['teamName'] && normalized['churchName']) {
    normalized['teamName'] = normalized['churchName'];
  }
  if (!normalized['churchName'] && normalized['teamName']) {
    normalized['churchName'] = normalized['teamName'];
  }
  if (!normalized['institution']) {
    normalized['institution'] = (normalized['churchName'] || normalized['teamName']) as string | undefined;
  }
  if (!normalized['participantCode']) {
    const orderNum = normalized['performanceOrder'] || index + 1;
    normalized['participantCode'] = `P-${orderNum.toString().padStart(3, '0')}`;
  }
  if (!normalized['teamCode']) {
    const orderNum = normalized['performanceOrder'] || index + 1;
    normalized['teamCode'] = `T-${orderNum.toString().padStart(3, '0')}`;
  }
  if (!normalized['performanceType']) {
    normalized['performanceType'] = 'solo';
  }
  if (!normalized['participantName'] && (normalized['firstName'] || normalized['lastName'])) {
    normalized['participantName'] = `${normalized['firstName'] || ''} ${normalized['lastName'] || ''}`.trim();
  }
  if (!normalized['firstName'] && normalized['participantName']) {
    const parts = String(normalized['participantName']).split(' ');
    normalized['firstName'] = parts[0] || 'Performer';
    normalized['lastName'] = parts.slice(1).join(' ') || '';
  }

  return normalized;
}

/**
 * Parses Google Form / Custom Sheet Responses into structured church registrations
 */
export function parseGoogleFormRegistrations(
  content: string | ArrayBuffer,
  fileType: 'csv' | 'xlsx' = 'csv'
): GoogleFormChurchRegistration[] {
  let rawRows: Record<string, unknown>[] = [];

  if (fileType === 'csv') {
    const csvString = typeof content === 'string' ? content : new TextDecoder().decode(content);
    const parsed = Papa.parse<Record<string, unknown>>(csvString, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
    });
    rawRows = parsed.data;
  } else {
    const workbook = XLSX.read(content, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);
  }

  const results: GoogleFormChurchRegistration[] = [];

  rawRows.forEach((row, idx) => {
    const normalized = normalizeRowKeys(row, idx);
    const churchName = String(normalized['churchName'] || normalized['teamName'] || `Church ${idx + 1}`).trim();
    if (!churchName) return;

    results.push({
      rowNumber: idx + 2,
      performanceOrder: Number(normalized['performanceOrder']) || idx + 1,
      timestamp: normalized['timestamp'] ? String(normalized['timestamp']) : undefined,
      email: normalized['email'] || normalized['contactEmail'] ? String(normalized['email'] || normalized['contactEmail']) : undefined,
      churchName,
      pastorName: normalized['pastorName'] ? String(normalized['pastorName']) : undefined,
      choirLeaderName: normalized['choirLeaderName'] ? String(normalized['choirLeaderName']) : undefined,
      soloParticipantName: normalized['soloParticipantName'] ? String(normalized['soloParticipantName']) : undefined,
      duetParticipant1: normalized['duetParticipant1'] ? String(normalized['duetParticipant1']) : undefined,
      duetParticipant2: normalized['duetParticipant2'] ? String(normalized['duetParticipant2']) : undefined,
      // Specific Instruments
      keyboardist: normalized['keyboardist'] as string || null,
      harmonium: normalized['harmonium'] as string || null,
      guitarist: normalized['guitarist'] as string || null,
      electricGuitarist: normalized['electricGuitarist'] as string || null,
      bassGuitarist: normalized['bassGuitarist'] as string || null,
      octopadDrums: normalized['octopadDrums'] as string || null,
      dholak: normalized['dholak'] as string || null,
      tablaNaal: normalized['tablaNaal'] as string || null,
      clapBox: normalized['clapBox'] as string || null,
      saxophone: normalized['saxophone'] as string || null,
      basuri: normalized['basuri'] as string || null,
      // Award Nominees
      bestKeyboardist: normalized['bestKeyboardist'] as string || null,
      bestRhythmist: normalized['bestRhythmist'] as string || null,
      bestGuitarist: normalized['bestGuitarist'] as string || null,
      numberOfParticipants: Number(normalized['numberOfParticipants']) || undefined,
      numberOfExtraPersons: Number(normalized['numberOfExtraPersons']) || undefined,
    });
  });

  return results;
}

/**
 * Converts Google Form / Custom Sheet Registrations into individual Solo, Duet, and Group Competition Acts
 */
export function convertGoogleFormsToCompetitionActs(
  registrations: GoogleFormChurchRegistration[]
): ParsedParticipantRow[] {
  const acts: ParsedParticipantRow[] = [];
  let orderCounter = 1;

  registrations.forEach((reg, churchIdx) => {
    const churchCode = `C${(churchIdx + 1).toString().padStart(2, '0')}`;
    const baseOrder = reg.performanceOrder || orderCounter++;

    // 1. Solo Act (if solo performer provided)
    if (reg.soloParticipantName) {
      acts.push({
        participantCode: `${churchCode}-SOLO`,
        participantName: reg.soloParticipantName,
        firstName: reg.soloParticipantName.split(' ')[0] || reg.soloParticipantName,
        lastName: reg.soloParticipantName.split(' ').slice(1).join(' ') || '',
        teamName: reg.churchName,
        churchName: reg.churchName,
        performanceType: 'solo',
        bestKeyboardist: reg.bestKeyboardist,
        bestRhythmist: reg.bestRhythmist,
        bestGuitarist: reg.bestGuitarist,
        institution: reg.churchName,
        contactEmail: reg.email,
        performanceOrder: baseOrder,
      });
    }

    // 2. Duet Act (if duet performers provided)
    if (reg.duetParticipant1 || reg.duetParticipant2) {
      const duetName = [reg.duetParticipant1, reg.duetParticipant2].filter(Boolean).join(' & ');
      acts.push({
        participantCode: `${churchCode}-DUET`,
        participantName: duetName,
        firstName: reg.duetParticipant1 || duetName,
        lastName: reg.duetParticipant2 || '',
        teamName: reg.churchName,
        churchName: reg.churchName,
        performanceType: 'duet',
        bestKeyboardist: reg.bestKeyboardist,
        bestRhythmist: reg.bestRhythmist,
        bestGuitarist: reg.bestGuitarist,
        institution: reg.churchName,
        contactEmail: reg.email,
        performanceOrder: baseOrder,
      });
    }

    // 3. Group / Choir Act
    const choirName = reg.choirLeaderName 
      ? `${reg.churchName} Choir (Leader: ${reg.choirLeaderName})` 
      : `${reg.churchName} Choir`;

    acts.push({
      participantCode: `${churchCode}-GRP`,
      participantName: choirName,
      firstName: reg.choirLeaderName || `${reg.churchName} Choir`,
      lastName: '',
      teamName: reg.churchName,
      churchName: reg.churchName,
      performanceType: 'group',
      bestKeyboardist: reg.bestKeyboardist,
      bestRhythmist: reg.bestRhythmist,
      bestGuitarist: reg.bestGuitarist,
      institution: reg.churchName,
      contactEmail: reg.email,
      performanceOrder: baseOrder,
    });
  });

  return acts;
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
    const rowNumber = index + 2;
    const normalized = normalizeRowKeys(rawRow, index);

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
    const normalized = normalizeRowKeys(rawRow, index);

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
