export type ElectionSystem = 'single-seat' | 'proportional-representation';
export type ElectionCount = number | { house: number; senate?: number };

export interface Election {
  system: ElectionSystem;
  prefecture?: string | undefined;
  number?: string | undefined;
  area?: string | undefined;
}

export interface HouseOfRepresentativesMember {
  name: string;
  furigana?: string;
  party: string;
  profileUrl?: string;
  electionCount?: ElectionCount;
  election: Election;
  profile?: MemberProfile;
}

export interface MemberProfile {
  birthDate?: string;
  birthPlace?: string;
  education?: string;
  occupation?: string;
  previousOccupation?: string[];
  committees?: string[];
  website?: string;
  email?: string;
  office?: {
    address?: string;
    phone?: string;
    fax?: string;
  };
  biography?: string;
  additionalInfo?: Record<string, string>;
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
