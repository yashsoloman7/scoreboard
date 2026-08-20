'use server';

// src/lib/importers/participantImporter.ts - Comprehensive Google Sheets, CSV & Form Importer
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { ParticipantImportRowSchema } from '../validation/schemas';

export interface ParsedParticipantRow {
  participantCode?: string;
  firstName?: string;
  lastName?: string;
  duetParticipant1?: string;
  duetParticipant2?: string;
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

export interface ParsedTeamRow {
  teamCode: string;
  teamName: string;
  churchName?: string | null;
  institution?: string | null;
  categoryName?: string;
  performanceOrder?: number;
  members?: { firstName: string; lastName: string; role: string; contactEmail?: string | null }[];
}

export interface ImportValidationResult<T> {
  validRows: T[];
  invalidRows: { rowNumber: number; data: unknown; errors: string[] }[];
  duplicates: string[];
  totalProcessed: number;
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
  duetCombinedName?: string;
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
    if (['sno', 'slno', 'sno.', 'serialno', 'order', 'performanceorder', 'seq', 'slot', 'chestnumber', 'chestno', 'code', 'participantcode'].includes(lowerKey)) {
      normalized['performanceOrder'] = Number(strVal) || index + 1;
      normalized['participantCode'] = strVal;
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
    // 4. Duet Participants
    else if (['duetparticipantname1', 'duetparticpantname1', 'duetperformer1', 'duet1', 'duetparticipant1'].includes(lowerKey)) {
      normalized['duetParticipant1'] = strVal;
    } else if (['duetparticipantname2', 'duetparticpantname2', 'duetperformer2', 'duet2', 'duetparticipant2'].includes(lowerKey)) {
      normalized['duetParticipant2'] = strVal;
    } else if (['duetname', 'duetparticipantname', 'duet', 'duetpair', 'duetmembers'].includes(lowerKey)) {
      normalized['duetParticipant1'] = strVal;
      if (strVal.includes('&') || strVal.toLowerCase().includes(' and ') || strVal.includes('/')) {
        const parts = strVal.split(/\s*(&|\band\b|\/)\s*/i).filter((p) => p && !['&', 'and', '/'].includes(p.toLowerCase()));
        if (parts.length >= 2) {
          normalized['duetSinger1'] = parts[0].trim();
          normalized['duetSinger2'] = parts[1].trim();
        }
      }
    }
    // 5. Leader / Pastor
    else if (['choirleadername', 'choirleader', 'leadername', 'leader'].includes(lowerKey)) {
      normalized['choirLeaderName'] = strVal;
    } else if (['pastorfathername', 'pastorname', 'fathername', 'pastor', 'father'].includes(lowerKey)) {
      normalized['pastorName'] = strVal;
    }
    // 6. Specific Instrument Columns
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
    // 8. General Names
    else if (['firstname', 'first'].includes(lowerKey)) {
      normalized['firstName'] = strVal;
    } else if (['lastname', 'last', 'surname'].includes(lowerKey)) {
      normalized['lastName'] = strVal;
    } else if (['name', 'fullname', 'performername', 'performer', 'participant', 'participantname'].includes(lowerKey)) {
      normalized['participantName'] = strVal;
      const parts = strVal.split(' ');
      if (!normalized['firstName']) normalized['firstName'] = parts[0] || '';
      if (!normalized['lastName']) normalized['lastName'] = parts.slice(1).join(' ') || '';
    }
    // 9. Contact Info
    else if (['email', 'emailaddress', 'contactemail', 'mail'].includes(lowerKey)) {
      normalized['contactEmail'] = strVal;
    } else if (['phone', 'contactphone', 'mobile', 'cell'].includes(lowerKey)) {
      normalized['contactPhone'] = strVal;
    }
    // 10. Counts
    else if (['noofparticpants', 'noofparticipants', 'numberofparticipants', 'totalparticipants', 'participants'].includes(lowerKey)) {
      normalized['numberOfParticipants'] = Number(strVal) || undefined;
    } else if (['noofextraperson', 'numberofextraperson', 'extraperson', 'extrapersons'].includes(lowerKey)) {
      normalized['numberOfExtraPersons'] = Number(strVal) || undefined;
    } else if (['category', 'categoryname'].includes(lowerKey)) {
      normalized['categoryName'] = strVal;
    } else if (['performancetype', 'type'].includes(lowerKey)) {
      const typeLower = strVal.toLowerCase();
      if (typeLower.includes('duet')) normalized['performanceType'] = 'duet';
      else if (typeLower.includes('group') || typeLower.includes('choir') || typeLower.includes('band')) normalized['performanceType'] = 'group';
      else normalized['performanceType'] = 'solo';
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
 * Standard CSV/Excel Parser for generic participant imports
 */
export function parseAndValidateParticipants(
  content: string | ArrayBuffer,
  fileType: 'csv' | 'xlsx' = 'csv'
): ImportValidationResult<ParsedParticipantRow> {
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

  const validRows: ParsedParticipantRow[] = [];
  const invalidRows: { rowNumber: number; data: unknown; errors: string[] }[] = [];
  const seenCodes = new Set<string>();

  rawRows.forEach((row, idx) => {
    const rowNum = idx + 2;
    const normalized = normalizeRowKeys(row, idx);

    const parseResult = ParticipantImportRowSchema.safeParse(normalized);

    if (!parseResult.success) {
      invalidRows.push({
        rowNumber: rowNum,
        data: row,
        errors: parseResult.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
      });
      return;
    }

    const val = parseResult.data as ParsedParticipantRow;

    if (val.participantCode) {
      if (seenCodes.has(val.participantCode)) {
        invalidRows.push({
          rowNumber: rowNum,
          data: row,
          errors: [`Duplicate participant code '${val.participantCode}'`],
        });
        return;
      }
      seenCodes.add(val.participantCode);
    }

    validRows.push(val);
  });

  return {
    validRows,
    invalidRows,
    duplicates: [],
    totalProcessed: rawRows.length,
  };
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

    const d1 = normalized['duetParticipant1'] ? String(normalized['duetParticipant1']).trim() : undefined;
    const d2 = normalized['duetParticipant2'] ? String(normalized['duetParticipant2']).trim() : undefined;
    const duetCombined = [d1, d2].filter(Boolean).join(' & ');

    results.push({
      rowNumber: idx + 2,
      performanceOrder: Number(normalized['performanceOrder']) || idx + 1,
      timestamp: normalized['timestamp'] ? String(normalized['timestamp']) : undefined,
      email: normalized['email'] || normalized['contactEmail'] ? String(normalized['email'] || normalized['contactEmail']) : undefined,
      churchName,
      pastorName: normalized['pastorName'] ? String(normalized['pastorName']) : undefined,
      choirLeaderName: normalized['choirLeaderName'] ? String(normalized['choirLeaderName']) : undefined,
      soloParticipantName: normalized['soloParticipantName'] ? String(normalized['soloParticipantName']) : undefined,
      duetParticipant1: d1,
      duetParticipant2: d2,
      duetCombinedName: duetCombined || undefined,
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

    // 1. Solo Act
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

    // 2. Duet Act with Both Names Captured
    if (reg.duetParticipant1 || reg.duetParticipant2 || reg.duetCombinedName) {
      const p1 = reg.duetParticipant1 || '';
      const p2 = reg.duetParticipant2 || '';
      const duetCombined = reg.duetCombinedName || [p1, p2].filter(Boolean).join(' & ');

      acts.push({
        participantCode: `${churchCode}-DUET`,
        participantName: duetCombined,
        firstName: p1 || duetCombined,
        lastName: p2 || '',
        duetParticipant1: p1,
        duetParticipant2: p2,
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

    // 3. Group Choir Act
    const groupName = reg.choirLeaderName 
      ? `${reg.churchName} Choir (Leader: ${reg.choirLeaderName})` 
      : `${reg.churchName} Choir`;

    acts.push({
      participantCode: `${churchCode}-GROUP`,
      participantName: groupName,
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
