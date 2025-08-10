export type ElectionSystem = 'single-seat' | 'proportional-representation';
export type ElectionCount = number | { house: number; senate?: number };

export interface Election {
  system: ElectionSystem;
  prefecture?: string;
  number?: string | undefined;
  area?: string;
}

export interface HouseOfRepresentativesMember {
  name: string;
  furigana?: string;
  party: string;
  profileUrl?: string;
  electionCount?: ElectionCount;
  election: Election;
}

export interface HouseOfRepresentativesResult {
  members: HouseOfRepresentativesMember[];
  scrapedAt: string;
  source: 'house-of-representatives-list';
}

// Raw member data from table extraction
export interface RawMemberData {
  name: {
    full: string;
    first: string;
    last: string;
  };
  furigana?: string;
  party: string;
  profileUrl?: string;
  prefecture: string;
  electionCount?: ElectionCount;
}
