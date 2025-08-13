export interface HouseOfCouncillorsMember {
  name: string;
  furigana?: string;
  party: string;
  profileUrl?: string;
  election: {
    system: 'constituency' | 'proportional-representation';
    prefecture?: string;
    area?: string;
  };
  termExpiration: string; // 令和10年7月25日 format
  profile?: HouseOfCouncillorsProfile;
}

export interface HouseOfCouncillorsProfile {
  fullName?: string;
  furigana?: string;
  birthDate?: string;
  birthPlace?: string;
  education?: string;
  university?: string;
  academicBackground?: string[];
  electionHistory?: string;
  electionCount?: number;
  termNumbers?: string[];
  partyAffiliation?: string;
  electionDistrict?: string;
  previousPositions?: {
    government?: string[];
    party?: string[];
    diet?: string[];
  };
  achievements?: string[];
  careerHistory?: string;
  biography?: string;
  website?: string;
  additionalInfo?: Record<string, string>;
}

export interface RawHouseOfCouncillorsMemberData {
  name: {
    full: string;
    last: string;
    first: string;
  };
  furigana?: string;
  party: string;
  election: string; // Raw election info
  termExpiration: string;
  profileUrl?: string;
}

export interface HouseOfCouncillorsResult {
  members: HouseOfCouncillorsMember[];
  scrapedAt: string;
  source: string;
}
