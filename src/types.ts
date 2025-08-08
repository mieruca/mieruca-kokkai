export interface DietMember {
  name: string;
  furigana?: string;
  party: string;
  profileUrl?: string;
  electionCount?: number | { house: number; senate?: number };
  election: {
    system: 'single-seat' | 'proportional-representation';
    prefecture?: string;
    number?: string | undefined;
    area?: string;
  };
}

export interface ScrapeResult {
  members: DietMember[];
  scrapedAt: string;
  source: 'house-of-representatives-list';
}
