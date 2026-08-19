// src/lib/practice/practiceManager.ts - Practice Mode Isolation & Sandbox Generator

export const PRACTICE_DEMO_PARTICIPANTS = [
  { participantCode: 'PRACTICE-01', firstName: 'Demo Soloist', lastName: 'Alpha', institution: 'State Music Academy' },
  { participantCode: 'PRACTICE-02', firstName: 'Demo Soloist', lastName: 'Beta', institution: 'National Conservatory' },
  { participantCode: 'PRACTICE-03', firstName: 'Demo Soloist', lastName: 'Gamma', institution: 'City Arts Institute' },
  { participantCode: 'PRACTICE-04', firstName: 'Demo Soloist', lastName: 'Delta', institution: 'Symphony College' },
];

export const PRACTICE_DEMO_CRITERIA = [
  { name: 'Pitch & Vocal Quality', maxMarks: 25, weight: 1.0, displayOrder: 1 },
  { name: 'Rhythm & Timing', maxMarks: 25, weight: 1.0, displayOrder: 2 },
  { name: 'Musical Accuracy & Nuance', maxMarks: 25, weight: 1.2, displayOrder: 3 },
  { name: 'Stage Dynamics & Expression', maxMarks: 25, weight: 0.8, displayOrder: 4 },
];
