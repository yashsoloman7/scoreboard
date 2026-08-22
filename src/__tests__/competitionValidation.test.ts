import { describe, it, expect } from 'vitest';
import { CompetitionSchema } from '../lib/validation/schemas';

describe('Competition Validation Schema', () => {
  it('validates a standard competition payload with explicit dates', () => {
    const input = {
      name: 'State Choir Championship 2026',
      code: 'SCC-2026',
      venue: 'Auditorium Hall',
      startDate: '2026-08-25',
      endDate: '2026-08-26',
      environment: 'live',
      eventPassword: 'SecurePassword123!',
    };

    const parsed = CompetitionSchema.parse(input);
    expect(parsed.name).toBe('State Choir Championship 2026');
    expect(parsed.code).toBe('SCC-2026');
    expect(parsed.startDate).toBe('2026-08-25');
    expect(parsed.endDate).toBe('2026-08-26');
    expect(parsed.eventPassword).toBe('SecurePassword123!');
  });

  it('automatically defaults empty or missing startDate and endDate to today (YYYY-MM-DD)', () => {
    const input = {
      name: 'Annual Gospel Fest',
      code: 'AGF-2026',
      startDate: '',
      endDate: undefined,
    };

    const parsed = CompetitionSchema.parse(input);
    const today = new Date().toISOString().split('T')[0];
    expect(parsed.startDate).toBe(today);
    expect(parsed.endDate).toBe(today);
  });

  it('correctly handles ISO string datetime input', () => {
    const input = {
      name: 'Music League 2026',
      code: 'ML-2026',
      startDate: '2026-10-15T10:30:00.000Z',
      endDate: '2026-10-16T18:00:00.000Z',
    };

    const parsed = CompetitionSchema.parse(input);
    expect(parsed.startDate).toBe('2026-10-15');
    expect(parsed.endDate).toBe('2026-10-16');
  });

  it('rejects codes that are too short or contain forbidden characters', () => {
    expect(() => {
      CompetitionSchema.parse({
        name: 'Invalid Code Test',
        code: 'A', // Too short (min 2)
      });
    }).toThrow();

    expect(() => {
      CompetitionSchema.parse({
        name: 'Invalid Special Character',
        code: 'CODE@123', // @ is not allowed
      });
    }).toThrow();
  });
});
