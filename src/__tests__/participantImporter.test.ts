import { describe, it, expect } from 'vitest';
import { 
  parseAndValidateParticipants,
  parseGoogleFormRegistrations,
  convertGoogleFormsToCompetitionActs
} from '../lib/importers/participantImporter';

describe('Participant CSV/Excel Importer & Validator', () => {
  it('parses valid CSV with standard columns', () => {
    const csvContent = `participantCode,firstName,lastName,institution,contactEmail
P-101,John,Doe,State Conservatory,john@example.com
P-102,Jane,Smith,National Academy,jane@example.com`;

    const result = parseAndValidateParticipants(csvContent, 'csv');
    expect(result.validRows.length).toBe(2);
    expect(result.invalidRows.length).toBe(0);
    expect(result.duplicates.length).toBe(0);
    expect(result.validRows[0].participantCode).toBe('P-101');
    expect(result.validRows[0].firstName).toBe('John');
  });

  it('normalizes alternative column names (Chest Number, Performer Name, School)', () => {
    const csvContent = `chestNumber,name,school
P-201,Alice Johnson,Metropolitan Symphony
P-202,Bob Williams,Royal Arts Guild`;

    const result = parseAndValidateParticipants(csvContent, 'csv');
    expect(result.validRows.length).toBe(2);
    expect(result.validRows[0].participantCode).toBe('P-201');
    expect(result.validRows[0].firstName).toBe('Alice');
    expect(result.validRows[0].lastName).toBe('Johnson');
    expect(result.validRows[0].institution).toBe('Metropolitan Symphony');
  });

  it('detects duplicate participant codes and invalid email formats', () => {
    const csvContent = `participantCode,firstName,lastName,contactEmail
P-301,Charlie,Brown,not-an-email
P-301,Charlie,Brown,valid@example.com`;

    const result = parseAndValidateParticipants(csvContent, 'csv');
    // Row 1 has invalid email
    expect(result.invalidRows.length).toBe(1);
    expect(result.invalidRows[0].rowNumber).toBe(2);
  });

  it('parses exact custom church sheet with multi-instrument columns', () => {
    const customCsv = `Sno.,Church Name,Solo Name,Duet Name,Guitar,Electric Guitar,Bass Guitar,Octopad/Drums,Keyboard,Dholak,Harmonium,Tabla / Naal,Clap Box,Saxophone,Basuri
1,St. Thomas Cathedral,Mark Paul,Luke & John,Acoustic Guy,Elec Steve,Bass Kevin,Drummer Dan,Keys Keith,Dholak Dave,Harmonium Harry,Tabla Tom,Cajon Carl,Sax Sam,Flute Felix`;

    const regs = parseGoogleFormRegistrations(customCsv, 'csv');
    expect(regs.length).toBe(1);
    expect(regs[0].churchName).toBe('St. Thomas Cathedral');
    expect(regs[0].soloParticipantName).toBe('Mark Paul');
    expect(regs[0].duetParticipant1).toBe('Luke & John');
    expect(regs[0].guitarist).toBe('Acoustic Guy');
    expect(regs[0].octopadDrums).toBe('Drummer Dan');
    expect(regs[0].keyboardist).toBe('Keys Keith');
    expect(regs[0].bestKeyboardist).toBe('Keys Keith');
    expect(regs[0].bestRhythmist).toBe('Drummer Dan');
    expect(regs[0].bestGuitarist).toBe('Acoustic Guy');

    const acts = convertGoogleFormsToCompetitionActs(regs);
    expect(acts.length).toBe(3); // Solo, Duet, Group
    expect(acts[0].performanceType).toBe('solo');
    expect(acts[0].participantName).toBe('Mark Paul');
    expect(acts[1].performanceType).toBe('duet');
    expect(acts[1].participantName).toBe('Luke & John');
    expect(acts[2].performanceType).toBe('group');
  });
});
