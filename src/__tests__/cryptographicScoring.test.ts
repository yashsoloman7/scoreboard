import { describe, it, expect } from 'vitest';
import { generateScoreHash } from '../lib/scoring/crypto';
import { 
  parseAndValidateParticipants, 
  parseGoogleFormRegistrations, 
  convertGoogleFormsToCompetitionActs, 
  extractInstrumentalists 
} from '../lib/importers/participantImporter';

describe('Scoreboard Enterprise Upgrades', () => {
  describe('Cryptographic SHA-256 Hashing', () => {
    it('generates consistent, deterministic SHA-256 hashes for identical payloads', () => {
      const eventId = 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c';
      const participantId = 'p1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c';
      const judgeId = 'j1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c';
      const totalScore = 95.5;

      const hash1 = generateScoreHash(eventId, participantId, judgeId, totalScore);
      const hash2 = generateScoreHash(eventId, participantId, judgeId, totalScore);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // Standard SHA-256 hex string length
    });

    it('generates completely different hashes when score or participant differs', () => {
      const eventId = 'e1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c';
      const participantId = 'p1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c';
      const judgeId = 'j1a2b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c';

      const hash1 = generateScoreHash(eventId, participantId, judgeId, 95.5);
      const hash2 = generateScoreHash(eventId, participantId, judgeId, 95.6);
      const hash3 = generateScoreHash(eventId, 'different-participant', judgeId, 95.5);

      expect(hash1).not.toBe(hash2);
      expect(hash1).not.toBe(hash3);
    });
  });

  describe('CSV & Google Form Importer Field Parsing', () => {
    it('correctly maps Team Name, Church Name, Performance Type, and Special Instruments', () => {
      const csvData = `Team Name,Church Name,Participant Name,Performance Type,Best Keyboardist,Best Rhythmist,Best Guitarist,Performance Order
Grace Choir,St. Andrews Church,John Doe,Group,Mark Keys,Luke Beats,Paul Strings,1
Zion Melody,Bethel Fellowship,Jane Smith,Solo,Timothy Solo,,David Rhythm,2`;

      const result = parseAndValidateParticipants(csvData, 'csv');

      expect(result.invalidRows).toHaveLength(0);
      expect(result.validRows).toHaveLength(2);

      const row1 = result.validRows[0];
      expect(row1.teamName).toBe('Grace Choir');
      expect(row1.churchName).toBe('St. Andrews Church');
      expect(row1.participantName).toBe('John Doe');
      expect(row1.performanceType).toBe('group');
      expect(row1.bestKeyboardist).toBe('Mark Keys');
      expect(row1.bestRhythmist).toBe('Luke Beats');
      expect(row1.bestGuitarist).toBe('Paul Strings');
      expect(row1.performanceOrder).toBe(1);

      const row2 = result.validRows[1];
      expect(row2.teamName).toBe('Zion Melody');
      expect(row2.churchName).toBe('Bethel Fellowship');
      expect(row2.participantName).toBe('Jane Smith');
      expect(row2.performanceType).toBe('solo');
      expect(row2.bestKeyboardist).toBe('Timothy Solo');
      expect(row2.bestRhythmist).toBeNull();
      expect(row2.bestGuitarist).toBe('David Rhythm');
      expect(row2.performanceOrder).toBe(2);
    });

    it('correctly parses exact Google Form response columns and converts to competition acts', () => {
      const googleFormCsv = `Timestamp,Email Address,CHURCH NAME,PASTOR/ FATHER NAME,CHOIR LEADER NAME,SOLO PARTICPANT NAME ,DUET PARTICPANT NAME 1,DUET PARTICPANT NAME 2,TOTAL INSTRUMENT PLAYER WITH INSTRUMENT NAME,NO. OF PARTICPANTS ,NO. Of EXTRA PERSON 
2026/08/21 10:00:00 AM,pastor@gracecathedral.org,Grace Cathedral,Rev. Dr. Thomas,Jonathan Cross,Aaron Matthew,Sarah Jenkins,Rachel Adams,Keyboard: Kevin Vance; Drums: Luke Sky; Guitar: Paul Mark,25,3`;

      const parsedChurches = parseGoogleFormRegistrations(googleFormCsv, 'csv');
      expect(parsedChurches).toHaveLength(1);

      const church = parsedChurches[0];
      expect(church.churchName).toBe('Grace Cathedral');
      expect(church.pastorName).toBe('Rev. Dr. Thomas');
      expect(church.choirLeaderName).toBe('Jonathan Cross');
      expect(church.soloParticipantName).toBe('Aaron Matthew');
      expect(church.duetParticipant1).toBe('Sarah Jenkins');
      expect(church.duetParticipant2).toBe('Rachel Adams');
      expect(church.numberOfParticipants).toBe(25);
      expect(church.numberOfExtraPersons).toBe(3);
      expect(church.bestKeyboardist).toBe('Kevin Vance');
      expect(church.bestRhythmist).toBe('Luke Sky');
      expect(church.bestGuitarist).toBe('Paul Mark');

      // Convert to 3 competition acts (Solo, Duet, Group)
      const acts = convertGoogleFormsToCompetitionActs(parsedChurches);
      expect(acts).toHaveLength(3);

      // Act 1: Solo
      expect(acts[0].performanceType).toBe('solo');
      expect(acts[0].participantName).toBe('Aaron Matthew');
      expect(acts[0].teamName).toBe('Grace Cathedral');

      // Act 2: Duet
      expect(acts[1].performanceType).toBe('duet');
      expect(acts[1].participantName).toBe('Sarah Jenkins & Rachel Adams');
      expect(acts[1].teamName).toBe('Grace Cathedral');

      // Act 3: Group Choir
      expect(acts[2].performanceType).toBe('group');
      expect(acts[2].participantName).toContain('Grace Cathedral Choir (Leader: Jonathan Cross)');
      expect(acts[2].bestKeyboardist).toBe('Kevin Vance');
    });

    it('extracts instrumentalists with varied syntax', () => {
      const res1 = extractInstrumentalists('Sam (Keys), Alex (Drums), Chris (Guitar)');
      expect(res1.keyboardist).toBe('Sam');
      expect(res1.rhythmist).toBe('Alex');
      expect(res1.guitarist).toBe('Chris');

      const res2 = extractInstrumentalists('Pianist: John / Cajon: Peter / Bass Guitar: Andrew');
      expect(res2.keyboardist).toBe('John');
      expect(res2.rhythmist).toBe('Peter');
      expect(res2.guitarist).toBe('Andrew');
    });
  });
});
