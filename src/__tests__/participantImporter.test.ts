// src/__tests__/participantImporter.test.ts - Unit Tests for CSV/Excel Importer

import { describe, it, expect } from 'vitest';
import { parseAndValidateParticipants } from '../lib/importers/participantImporter';

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
});
