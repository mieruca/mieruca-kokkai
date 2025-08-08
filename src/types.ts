export interface DietMember {
  name: string;
  furigana?: string;
  party: string;
  district?: string;
  profileUrl?: string;
  imageUrl?: string;
  email?: string;
  website?: string;
  electionCount?: number;
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
  source: string;
}
