// src/__tests__/welcomeEmail.test.ts - Unit Tests for Resend Welcome Email Service
import { describe, it, expect } from 'vitest';
import { sendWelcomeEmail } from '../lib/email/welcomeEmail';

describe('Resend Welcome Email Service', () => {
  it('handles welcome email gracefully when RESEND_API_KEY is not set (simulated in dev/test)', async () => {
    const res = await sendWelcomeEmail({
      toEmail: 'newjudge@example.com',
      fullName: 'Judge Judith',
      role: 'judge',
    });

    expect(res.success).toBe(true);
    expect(res.simulated).toBe(true);
  });

  it('generates welcome email for Event Manager role', async () => {
    const res = await sendWelcomeEmail({
      toEmail: 'manager@example.com',
      fullName: 'Stage Director',
      role: 'event_manager',
    });

    expect(res.success).toBe(true);
  });
});
