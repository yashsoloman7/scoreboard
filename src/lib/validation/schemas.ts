// src/lib/validation/schemas.ts - Strict Zod validation schemas for all ingress data

import { z } from 'zod';

export const RoleEnumSchema = z.enum([
  'super_admin',
  'admin',
  'event_manager',
  'event_operator',
  'judge',
  'public_viewer',
  'unauthorized'
]);

export const EnvironmentModeSchema = z.enum(['live', 'practice']);
export const ScoringFormulaSchema = z.enum(['weighted_sum', 'total_sum', 'average', 'olympic']);
export const PerformerTypeSchema = z.enum(['solo', 'duet', 'group']);
export const ScoreStatusSchema = z.enum(['draft', 'submitted', 'locked', 'reopened']);
export const TimerStatusSchema = z.enum(['idle', 'running', 'paused', 'stopped', 'overtime']);
export const ResultStatusSchema = z.enum(['draft', 'under_review', 'approved', 'published']);
export const TieBreakRuleTypeSchema = z.enum([
  'highest_average',
  'priority_criterion',
  'lowest_variance',
  'highest_median',
  'jury_override'
]);

// 1. Competition Validation
export const CompetitionSchema = z.object({
  code: z.string().min(2, 'Code must be at least 2 characters').max(30).regex(/^[A-Z0-9_-]+$/i, 'Competition code must be alphanumeric with dashes/underscores'),
  name: z.string().min(2, 'Event name must be at least 2 characters').max(100),
  description: z.string().max(500).optional().nullable().or(z.literal('')),
  venue: z.string().max(200).optional().nullable().or(z.literal('')),
  startDate: z.string().optional().nullable().or(z.literal('')).transform((val) => {
    if (!val || typeof val !== 'string' || !val.trim()) {
      return new Date().toISOString().split('T')[0];
    }
    const cleaned = val.split('T')[0].trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
      return cleaned;
    }
    return new Date().toISOString().split('T')[0];
  }),
  endDate: z.string().optional().nullable().or(z.literal('')).transform((val) => {
    if (!val || typeof val !== 'string' || !val.trim()) {
      return new Date().toISOString().split('T')[0];
    }
    const cleaned = val.split('T')[0].trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
      return cleaned;
    }
    return new Date().toISOString().split('T')[0];
  }),
  environment: EnvironmentModeSchema.default('live'),
  eventPassword: z.string().optional().nullable().or(z.literal('')),
  publishPasscode: z.string().optional().nullable().or(z.literal('')),
});

export const CompetitionSettingsSchema = z.object({
  allowMultipleJudgeDevices: z.boolean().default(false),
  requireAdminDeviceApproval: z.boolean().default(true),
  autoLockScoreOnSubmit: z.boolean().default(true),
  defaultTimerDurationSeconds: z.number().int().min(30).max(3600).default(300),
  warningThresholdSeconds: z.number().int().min(5).max(120).default(30),
  allowPracticeMode: z.boolean().default(true),
});

// 2. Category & Rounds Validation
export const CategorySchema = z.object({
  competitionId: z.string().uuid(),
  name: z.string().min(2).max(100),
  performerType: PerformerTypeSchema.default('solo'),
  displayOrder: z.number().int().min(0).default(0),
  scoringFormula: ScoringFormulaSchema.default('weighted_sum'),
});

export const RoundSchema = z.object({
  categoryId: z.string().uuid(),
  roundNumber: z.number().int().min(1),
  name: z.string().min(2).max(100),
  isFinal: z.boolean().default(false),
});

// 3. Criteria Validation
export const CriterionItemSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(300).optional().nullable(),
  maxMarks: z.number().positive().max(1000),
  weight: z.number().positive().max(100).default(1.0),
  displayOrder: z.number().int().min(0).default(0),
});

export const CriteriaConfigSchema = z.object({
  categoryId: z.string().uuid(),
  criteria: z.array(CriterionItemSchema).min(1, 'At least one judging criterion is required'),
});

// 4. Participant & Team Validation (Supports CSV & Google Form Importer)
export const ParticipantImportRowSchema = z.object({
  participantCode: z.string().min(1).max(50).optional(),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  teamName: z.string().max(150).optional().nullable(),
  churchName: z.string().max(200).optional().nullable(),
  participantName: z.string().max(200).optional().nullable(),
  performanceType: z.enum(['solo', 'duet', 'group']).default('solo'),
  bestKeyboardist: z.string().max(150).optional().nullable(),
  bestRhythmist: z.string().max(150).optional().nullable(),
  bestGuitarist: z.string().max(150).optional().nullable(),
  institution: z.string().max(200).optional().nullable(),
  contactEmail: z.string().email().optional().nullable().or(z.literal('')),
  contactPhone: z.string().max(30).optional().nullable().or(z.literal('')),
  categoryName: z.string().optional(),
  performanceOrder: z.number().int().positive().optional(),
});

export const TeamImportRowSchema = z.object({
  teamCode: z.string().min(1).max(50),
  teamName: z.string().min(1).max(100),
  institution: z.string().max(200).optional().nullable(),
  categoryName: z.string().optional(),
  performanceOrder: z.number().int().positive().optional(),
  members: z.array(z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    role: z.string().default('Member'),
    contactEmail: z.string().email().optional().nullable().or(z.literal('')),
  })).optional(),
});

// 5. Judge Assignment & Session Validation
export const JudgeAssignmentSchema = z.object({
  competitionId: z.string().uuid(),
  categoryId: z.string().uuid(),
  judgeId: z.string().uuid(),
  judgeSeatNumber: z.number().int().min(1).max(20),
});

export const JudgeSessionRegistrationSchema = z.object({
  competitionId: z.string().uuid(),
  deviceId: z.string().min(5).max(128),
  deviceName: z.string().max(100).optional().nullable(),
  fingerprint: z.string().max(256).optional().nullable(),
});

// 6. Cryptographic Score Submission & Admin Override Validation
export const ScoreInputSchema = z.object({
  eventId: z.string().uuid(),
  participantId: z.string().uuid(),
  category: z.enum(['solo', 'duet', 'group', 'best_keyboardist', 'best_rhythmist', 'best_guitarist']).default('solo'),
  soloScore: z.number().min(0).max(100).default(0),
  duetScore: z.number().min(0).max(100).default(0),
  groupScore: z.number().min(0).max(100).default(0),
  keyboardistScore: z.number().min(0).max(100).default(0),
  rhythmistScore: z.number().min(0).max(100).default(0),
  guitaristScore: z.number().min(0).max(100).default(0),
  deviceFingerprint: z.string().optional().nullable(),
});

export const AdminScoreOverrideSchema = z.object({
  scoreId: z.string().uuid(),
  newSoloScore: z.number().min(0).max(100).default(0),
  newDuetScore: z.number().min(0).max(100).default(0),
  newGroupScore: z.number().min(0).max(100).default(0),
  newKeyboardistScore: z.number().min(0).max(100).default(0),
  newRhythmistScore: z.number().min(0).max(100).default(0),
  newGuitaristScore: z.number().min(0).max(100).default(0),
  reason: z.string().min(5, 'A clear justification is required for administrative audit logs'),
});

export const ScoreEntryItemSchema = z.object({
  criterionId: z.string().uuid(),
  rawScore: z.number().min(0, 'Score cannot be negative'),
  notes: z.string().max(500).optional().nullable(),
});

export const ScoreSubmissionSchema = z.object({
  performanceId: z.string().uuid(),
  criteriaVersionId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
  deviceFingerprint: z.string().optional().nullable(),
  entries: z.array(ScoreEntryItemSchema).min(1, 'Submission must have at least one score entry'),
});

export const ScoreReopenSchema = z.object({
  submissionId: z.string().uuid(),
  reason: z.string().min(10, 'A detailed reason (min 10 chars) is mandatory for score reopening'),
});

// 7. Authoritative Timer Controls
export const TimerControlActionSchema = z.object({
  performanceId: z.string().uuid(),
  action: z.enum(['start', 'pause', 'resume', 'stop', 'reset', 'update_duration']),
  durationSeconds: z.number().int().min(30).max(3600).optional(),
});

// 8. Result Approval & Publication
export const ResultActionSchema = z.object({
  categoryId: z.string().uuid(),
  roundId: z.string().uuid(),
  action: z.enum(['calculate', 'approve', 'publish', 'reopen']),
  reason: z.string().optional(),
});

// 9. Tie Break Rule Configuration & Manual Decision
export const TieBreakRuleConfigSchema = z.object({
  categoryId: z.string().uuid(),
  rules: z.array(z.object({
    priorityOrder: z.number().int().min(1),
    ruleType: TieBreakRuleTypeSchema,
    targetCriterionId: z.string().uuid().optional().nullable(),
  })).min(1),
});

export const TieBreakManualDecisionSchema = z.object({
  resultEntryId: z.string().uuid(),
  reason: z.string().min(15, 'Mandatory explanation for manual jury decision'),
  jurySignatories: z.array(z.string()).min(1, 'At least one jury signatory required'),
});

// 10. Dynamic Awards Configuration
export const AwardSchema = z.object({
  competitionId: z.string().uuid(),
  categoryId: z.string().uuid().optional().nullable(),
  code: z.string().min(2).max(50),
  name: z.string().min(3).max(100),
  description: z.string().max(300).optional().nullable(),
  displayOrder: z.number().int().min(0).default(0),
});

export const AwardOverrideSchema = z.object({
  awardId: z.string().uuid(),
  performanceId: z.string().uuid().optional().nullable(),
  participantId: z.string().uuid().optional().nullable(),
  teamId: z.string().uuid().optional().nullable(),
  overrideReason: z.string().min(10, 'Mandatory justification for award override'),
});
