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
    expect(regs[0].duetParticipant1).toBe('Luke');
    expect(regs[0].duetParticipant2).toBe('John');
    expect(regs[0].duetCombinedName).toBe('Luke & John');
    expect(regs[0].guitarist).toBe('Acoustic Guy');
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

  it('correctly pairs 2 duet singers when solo performer sings with second singer', () => {
    const csvData = `Sno.,Church Name,Solo Name,Duet Name
1,Bhilai Church,Parina H. George,B. Paulina
2,Raipur Parish,Pratush Hemrm,Pratush & Ashish
3,Nagpur Assembly,A. Nageshwar Rao,Y. Kiran Kumar`;

    const regs = parseGoogleFormRegistrations(csvData, 'csv');
    expect(regs.length).toBe(3);

    // Row 1: Solo + 2nd singer -> Parina H. George & B. Paulina
    expect(regs[0].duetCombinedName).toBe('Parina H. George & B. Paulina');

    // Row 2: Already has delimiter & -> Pratush & Ashish
    expect(regs[1].duetCombinedName).toBe('Pratush & Ashish');

    // Row 3: Solo + 2nd singer -> A. Nageshwar Rao & Y. Kiran Kumar
    expect(regs[2].duetCombinedName).toBe('A. Nageshwar Rao & Y. Kiran Kumar');

    const acts = convertGoogleFormsToCompetitionActs(regs);
    const duetActs = acts.filter((a) => a.performanceType === 'duet');
    expect(duetActs.length).toBe(3);
    expect(duetActs[0].participantName).toBe('Parina H. George & B. Paulina');
    expect(duetActs[1].participantName).toBe('Pratush & Ashish');
    expect(duetActs[2].participantName).toBe('A. Nageshwar Rao & Y. Kiran Kumar');
  });

  it('correctly processes full 15-act sample contestant sheet across 5 churches', () => {
    const sampleCsv = `Timestamp,Email Address,Church Name,Pastor Name,Choir Leader Name,Solo Participant Name,Duet Participant 1,Duet Participant 2,Keyboardist Name,Rhythmist / Drums Name,Guitarist Name,Total Participants
2026-08-20 10:00:00,bhilai@church.org,Bhilai Central Church,Rev. Thomas,Samuel K.,Pratush Hemrm,Parina H. George,B. Paulina,John Samuel,David Raj,Philip K.,15
2026-08-20 10:15:00,raipur@church.org,St. Thomas Cathedral Raipur,Fr. Mathew,Rachel J.,A. Nageshwar Rao,Raj Abhishek Singh,Shifa Masih,Grace Paul,Stephen M.,Daniel V.,18
2026-08-20 10:30:00,durg@church.org,Grace Fellowship Durg,Pastor John,Timothy B.,Sneha Singh,Vijay Kumar,Priya Sharma,Timothy B.,Karan Joshua,Anand M.,14
2026-08-20 10:45:00,bilaspur@church.org,Emmanuel Methodist Bilaspur,Rev. Wilson,Esther R.,Rohan Masih,Sunil Das,Anita Minz,Mark Philip,James Luke,Peter S.,16
2026-08-20 11:00:00,nagpur@church.org,Zion City Church Nagpur,Bishop Paul,Nehemiah T.,Debasish Sen,Rahul Verma,Preeti Toppo,Nehemiah T.,Samson G.,Joshua K.,20`;

    const registrations = parseGoogleFormRegistrations(sampleCsv, 'csv');
    expect(registrations.length).toBe(5);

    const generatedActs = convertGoogleFormsToCompetitionActs(registrations);
    expect(generatedActs.length).toBe(15); // 5 Solo + 5 Duet + 5 Group acts

    const solos = generatedActs.filter((a) => a.performanceType === 'solo');
    const duets = generatedActs.filter((a) => a.performanceType === 'duet');
    const groups = generatedActs.filter((a) => a.performanceType === 'group');

    expect(solos.length).toBe(5);
    expect(duets.length).toBe(5);
    expect(groups.length).toBe(5);

    // Duet verification: both singer names present
    expect(duets[0].participantName).toBe('Parina H. George & B. Paulina');
    expect(duets[1].participantName).toBe('Raj Abhishek Singh & Shifa Masih');

    // Group choir instrumentalists verification
    expect(groups[0].bestKeyboardist).toBe('John Samuel');
    expect(groups[0].bestRhythmist).toBe('David Raj');
    expect(groups[0].bestGuitarist).toBe('Philip K.');
  });
});
