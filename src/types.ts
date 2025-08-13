export interface DietMember {
  name: string;
  furigana?: string;
  party: string;
  profileUrl?: string;
  electionCount?: number | { house: number; senate?: number };
  election: {
    system: 'single-seat' | 'constituency' | 'proportional-representation';
    prefecture?: string | undefined;
    number?: string | undefined;
    area?: string | undefined;
  };
}

export interface ScrapeResult {
  members: DietMember[];
  scrapedAt: string;
  source: string;
}
