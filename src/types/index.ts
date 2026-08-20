// src/types/index.ts - Core domain types for Music Competition Management & Digital Judging Platform

export type AppRole = 'super_admin' | 'admin' | 'event_manager' | 'event_operator' | 'judge' | 'public_viewer' | 'unauthorized';

export type CompetitionStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived';
export type PerformerType = 'solo' | 'duet' | 'group';
export type PerformanceStatus = 'scheduled' | 'on_deck' | 'performing' | 'scoring' | 'completed' | 'disqualified' | 'no_show';
export type ScoreStatus = 'draft' | 'submitted' | 'locked' | 'reopened';
export type TimerStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'overtime';
export type ResultStatus = 'draft' | 'under_review' | 'approved' | 'published';
export type EnvironmentMode = 'live' | 'practice';
export type ScoringFormula = 'weighted_sum' | 'total_sum' | 'average' | 'olympic';
export type TieBreakRuleType = 'highest_average' | 'priority_criterion' | 'lowest_variance' | 'highest_median' | 'jury_override';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  phoneNumber?: string | null;
  avatarUrl?: string | null;
  isActive: boolean;
  role: AppRole;
  createdAt: string;
  updatedAt: string;
}

export interface Competition {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  venue?: string | null;
  startDate: string;
  endDate: string;
  status: CompetitionStatus;
  environment: EnvironmentMode;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  settings?: CompetitionSettings;
}

export interface CompetitionSettings {
  competitionId: string;
  allowMultipleJudgeDevices: boolean;
  requireAdminDeviceApproval: boolean;
  autoLockScoreOnSubmit: boolean;
  defaultTimerDurationSeconds: number;
  warningThresholdSeconds: number;
  allowPracticeMode: boolean;
  updatedAt: string;
}

export interface Category {
  id: string;
  competitionId: string;
  name: string;
  performerType: PerformerType;
  displayOrder: number;
  scoringFormula: ScoringFormula;
  status: string;
  createdAt: string;
  updatedAt: string;
  criteriaVersion?: CriteriaVersion;
  rounds?: Round[];
}

export interface Round {
  id: string;
  categoryId: string;
  roundNumber: number;
  name: string;
  isFinal: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CriteriaVersion {
  id: string;
  categoryId: string;
  versionNumber: number;
  isLocked: boolean;
  lockedAt?: string | null;
  createdBy?: string;
  createdAt: string;
  criteria: CategoryCriterion[];
}

export interface CategoryCriterion {
  id: string;
  criteriaVersionId: string;
  name: string;
  description?: string | null;
  maxMarks: number;
  weight: number;
  displayOrder: number;
  createdAt: string;
}

export interface Participant {
  id: string;
  competitionId: string;
  participantCode: string;
  firstName: string;
  lastName: string;
  teamName?: string | null;
  churchName?: string | null;
  participantName?: string | null;
  performanceType?: 'solo' | 'duet' | 'group' | string;
  bestKeyboardist?: string | null;
  bestRhythmist?: string | null;
  bestGuitarist?: string | null;
  performanceOrder?: number;
  isActive?: boolean;
  institution?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  environment: EnvironmentMode;
  createdAt: string;
  updatedAt: string;
}

export interface Team {
  id: string;
  competitionId: string;
  teamCode: string;
  name: string;
  institution?: string | null;
  environment: EnvironmentMode;
  members?: TeamMember[];
  createdAt: string;
}

export interface TeamMember {
  id: string;
  teamId: string;
  participantId: string;
  roleInTeam: string;
  participant?: Participant;
  createdAt: string;
}

export interface Performance {
  id: string;
  roundId: string;
  participantId?: string | null;
  teamId?: string | null;
  performanceOrder: number;
  performanceCode: string;
  status: PerformanceStatus;
  startedAt?: string | null;
  completedAt?: string | null;
  participant?: Participant | null;
  team?: Team | null;
  timer?: TimerState | null;
  scores?: ScoreSubmission[];
  createdAt: string;
  updatedAt: string;
}

export interface JudgeAssignment {
  id: string;
  competitionId: string;
  categoryId: string;
  judgeId: string;
  judgeSeatNumber: number;
  isActive: boolean;
  judge?: UserProfile;
  assignedAt: string;
}

export interface JudgeSession {
  id: string;
  judgeId: string;
  competitionId: string;
  deviceId: string;
  deviceName?: string | null;
  ipAddress?: string | null;
  isApproved: boolean;
  approvedBy?: string | null;
  lastHeartbeat: string;
  isRevoked: boolean;
  createdAt: string;
}

export interface ScoreSubmission {
  id: string;
  performanceId: string;
  judgeId: string;
  criteriaVersionId: string;
  status: ScoreStatus;
  idempotencyKey: string;
  totalRawScore: number;
  totalWeightedScore: number;
  submittedAt?: string | null;
  lockedAt?: string | null;
  deviceFingerprint?: string | null;
  entries: ScoreEntry[];
  judge?: UserProfile;
  createdAt: string;
  updatedAt: string;
}

export interface ScoreEntry {
  id: string;
  submissionId: string;
  criterionId: string;
  rawScore: number;
  weightedScore: number;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScoreHistory {
  id: string;
  submissionId: string;
  reopenedBy: string;
  reopenReason: string;
  previousRawTotal: number;
  previousWeightedTotal: number;
  previousScoresSnapshot: Record<string, number>;
  reopenedAt: string;
  resubmittedAt?: string | null;
  reopener?: UserProfile;
}

export interface TimerState {
  id: string;
  performanceId: string;
  status: TimerStatus;
  configuredDurationSeconds: number;
  warningThresholdSeconds: number;
  startedAt?: string | null;
  pausedAt?: string | null;
  accumulatedDurationSeconds: number;
  overtimeSeconds: number;
  lastUpdatedBy?: string | null;
  updatedAt: string;
}

export interface CompetitionState {
  competitionId: string;
  activeCategoryId?: string | null;
  activeRoundId?: string | null;
  activePerformanceId?: string | null;
  isLiveActive: boolean;
  updatedBy?: string | null;
  updatedAt: string;
}

export interface Result {
  id: string;
  categoryId: string;
  roundId: string;
  status: ResultStatus;
  approvedBy?: string | null;
  approvedAt?: string | null;
  publishedAt?: string | null;
  entries: ResultEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface ResultEntry {
  id: string;
  resultId: string;
  performanceId: string;
  rank: number;
  finalScore: number;
  judgeCount: number;
  rawAverage: number;
  standardDeviation: number;
  breakdownJson: {
    criteriaScores: Record<string, number>;
    judgeScores: { judgeId: string; judgeSeat: number; total: number; weighted: number }[];
    tieBreakNotes?: string;
  };
  isTie: boolean;
  tieResolutionNote?: string | null;
  performance?: Performance | null;
  createdAt: string;
}

export interface TieBreakRule {
  id: string;
  categoryId: string;
  priorityOrder: number;
  ruleType: TieBreakRuleType;
  targetCriterionId?: string | null;
  createdAt: string;
}

export interface Award {
  id: string;
  competitionId: string;
  categoryId?: string | null;
  code: string;
  name: string;
  description?: string | null;
  displayOrder: number;
  isActive: boolean;
  winners?: AwardWinner[];
  createdAt: string;
}

export interface AwardWinner {
  id: string;
  awardId: string;
  performanceId?: string | null;
  participantId?: string | null;
  teamId?: string | null;
  isOverride: boolean;
  overrideReason?: string | null;
  overriddenBy?: string | null;
  awardedAt: string;
  participant?: Participant;
  team?: Team;
}

export interface AuditLog {
  id: string;
  competitionId?: string | null;
  actorId?: string | null;
  actor?: UserProfile;
  action: string;
  entity: string;
  entityId: string;
  oldState?: Record<string, unknown> | null;
  newState?: Record<string, unknown> | null;
  reason?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
}

export interface BackupSnapshot {
  id: string;
  competitionId: string;
  triggerEvent: 'manual' | 'participant_completed' | 'category_completed' | 'pre_publish';
  filePath: string;
  fileSizeBytes: number;
  sha256Checksum: string;
  metadata: {
    competitionName: string;
    totalParticipants: number;
    totalSubmissions: number;
    timestamp: string;
  };
  createdBy?: string | null;
  createdAt: string;
}

// Enterprise Event Staging & Cryptographic Scoring Interfaces
export interface Score {
  id: string;
  eventId?: string | null;
  participantId: string;
  judgeId: string;
  category: 'solo' | 'duet' | 'group' | 'best_keyboardist' | 'best_rhythmist' | 'best_guitarist' | string;
  soloScore: number;
  duetScore: number;
  groupScore: number;
  keyboardistScore: number;
  rhythmistScore: number;
  guitaristScore: number;
  totalScore: number;
  scoreHash: string;
  isLocked: boolean;
  deviceFingerprint?: string | null;
  submittedAt: string;
  isAdminOverride: boolean;
  overrideReason?: string | null;
  overriddenBy?: string | null;
  overriddenAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EventState {
  id?: string;
  eventId: string;
  activeParticipantId?: string | null;
  stageMode: 'standby' | 'live' | 'completed';
  timerStatus: 'idle' | 'running' | 'paused' | 'stopped' | 'overtime';
  timerDurationSeconds: number;
  timerStartedAt?: string | null;
  timerEndsAt?: string | null;
  timerElapsedSeconds: number;
  isJudgeInputUnlocked: boolean;
  currentCategory: 'solo' | 'duet' | 'group' | 'best_keyboardist' | 'best_rhythmist' | 'best_guitarist' | string;
  updatedBy?: string | null;
  updatedAt: string;
  activeParticipant?: Participant | null;
}

export interface ParticipantAggregatedScore {
  participantId: string;
  teamName: string;
  churchName: string;
  participantName: string;
  performanceType: string;
  bestKeyboardist: string | null;
  bestRhythmist: string | null;
  bestGuitarist: string | null;
  soloSums: number;
  duetSums: number;
  groupSums: number;
  keyboardistSums: number;
  rhythmistSums: number;
  guitaristSums: number;
  specialInstrumentTotal: number;
  grandTotal: number;
  judgeCount: number;
  isTie: boolean;
  tieCategories: string[];
}

export interface TieBreakerAlert {
  category: string;
  score: number;
  tiedTeams: { participantId: string; teamName: string; churchName: string }[];
  alertMessage: string;
}
