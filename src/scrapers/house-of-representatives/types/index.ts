export interface HouseOfRepresentativesMember {
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
  electionCount?: number | { house: number; senate?: number };
}
