// src/lib/scoring/crypto.ts - Cryptographic SHA-256 Signature Generator
import crypto from 'node:crypto';

export const SCORE_SECRET_SALT = process.env.SCORE_SECRET_KEY || 'scoreboard-prod-secret-salt-2026';

/**
 * Computes Cryptographic SHA-256 Hash
 * Hash = SHA-256(event_id + participant_id + judge_id + score + secret)
 */
export function generateScoreHash(
  eventId: string,
  participantId: string,
  judgeId: string,
  totalScore: number,
  secretSalt = SCORE_SECRET_SALT
): string {
  const payload = `${eventId}:${participantId}:${judgeId}:${totalScore.toFixed(2)}:${secretSalt}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}
