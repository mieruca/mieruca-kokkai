export interface DietMember {
  name: string;
  furigana?: string;
  party: string;
  prefecture: string;
  district?: string;
  chamber: 'house-of-representatives' | 'house-of-councillors';
  profileUrl?: string;
  imageUrl?: string;
  email?: string;
  website?: string;
  electionCount?: number;
}

export interface ScrapeResult {
  members: DietMember[];
  scrapedAt: string;
  source: string;
}