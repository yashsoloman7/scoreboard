// src/lib/awards/awardEngine.ts - Dynamic Awards & Seed Data Definitions

export interface SeedAwardTemplate {
  code: string;
  name: string;
  description: string;
  performerType?: 'solo' | 'duet' | 'group';
  displayOrder: number;
}

export const SEED_AWARDS: SeedAwardTemplate[] = [
  // Solo Awards
  { code: 'SOLO_1ST', name: 'Solo 1st Place', description: 'Winner of Solo Category', performerType: 'solo', displayOrder: 1 },
  { code: 'SOLO_2ND', name: 'Solo 2nd Place', description: 'Runner-up of Solo Category', performerType: 'solo', displayOrder: 2 },
  { code: 'SOLO_3RD', name: 'Solo 3rd Place', description: 'Second Runner-up of Solo Category', performerType: 'solo', displayOrder: 3 },
  { code: 'SOLO_CONSOLATION', name: 'Solo Consolation Prize', description: 'Special Recognition in Solo', performerType: 'solo', displayOrder: 4 },

  // Duet Awards
  { code: 'DUET_1ST', name: 'Duet 1st Place', description: 'Winner of Duet Category', performerType: 'duet', displayOrder: 5 },
  { code: 'DUET_2ND', name: 'Duet 2nd Place', description: 'Runner-up of Duet Category', performerType: 'duet', displayOrder: 6 },
  { code: 'DUET_3RD', name: 'Duet 3rd Place', description: 'Second Runner-up of Duet Category', performerType: 'duet', displayOrder: 7 },
  { code: 'DUET_CONSOLATION', name: 'Duet Consolation Prize', description: 'Special Recognition in Duet', performerType: 'duet', displayOrder: 8 },

  // Group Awards
  { code: 'GROUP_1ST', name: 'Group 1st Place', description: 'Winner of Group Competition', performerType: 'group', displayOrder: 9 },
  { code: 'GROUP_2ND', name: 'Group 2nd Place', description: 'Runner-up of Group Competition', performerType: 'group', displayOrder: 10 },
  { code: 'GROUP_3RD', name: 'Group 3rd Place', description: 'Second Runner-up of Group Competition', performerType: 'group', displayOrder: 11 },
  { code: 'GROUP_CONSOLATION', name: 'Group Consolation Prize', description: 'Special Recognition in Group', performerType: 'group', displayOrder: 12 },

  // Special Category Awards
  { code: 'BEST_KEYBOARDIST', name: 'Best Keyboardist of the State', description: 'Outstanding keyboard/piano performance', displayOrder: 13 },
  { code: 'BEST_GUITARIST', name: 'Best Guitarist of the State', description: 'Outstanding lead/rhythm guitar performance', displayOrder: 14 },
  { code: 'BEST_RHYTHMIST', name: 'Best Rhythmist / Drummer', description: 'Exceptional tempo & rhythmic precision', displayOrder: 15 },
  { code: 'DISCIPLINE_1ST', name: 'Stage Discipline 1st Prize', description: 'Exemplary punctuality, conduct, and stage ethics', displayOrder: 16 },
  { code: 'DISCIPLINE_2ND', name: 'Stage Discipline 2nd Prize', description: 'Exemplary stage etiquette and demeanor', displayOrder: 17 },
  { code: 'OVERALL_PERFORMANCE', name: 'Overall Performance Trophy', description: 'Highest aggregated score of the competition', displayOrder: 18 },
  { code: 'BEST_ARRANGEMENT', name: 'Best Music Arrangement', description: 'Innovative vocal harmony and acoustic arrangement', displayOrder: 19 },
  { code: 'SONG_OF_THE_YEAR', name: 'Best Group Song of the Year', description: 'Masterpiece choral or band presentation', displayOrder: 20 },
];
