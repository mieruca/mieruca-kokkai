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
  // 基本情報
  fullName?: string;
  furigana?: string;
  birthDate?: string;
  birthPlace?: string;

  // 選挙・政治情報
  electionDistrict?: string;
  partyAffiliation?: string;
  electionHistory?: string;
  electionCount?: number;
  termNumbers?: string[]; // 第XX回選挙の情報

  // 学歴・経歴
  education?: string;
  university?: string;
  academicBackground?: string[];

  // 職歴
  occupation?: string;
  previousOccupation?: string[];
  careerHistory?: string;

  // 政府・党内での役職
  currentPositions?: {
    government?: string[]; // 政府での現在の役職
    party?: string[]; // 党内での現在の役職
    diet?: string[]; // 国会での現在の役職
  };

  // 過去の役職
  previousPositions?: {
    government?: string[]; // 政府での過去の役職
    party?: string[]; // 党内での過去の役職
    diet?: string[]; // 国会での過去の役職
  };

  // 委員会・その他
  committees?: string[];
  specialRoles?: string[]; // 特別な役割・表彰等

  // 連絡先情報
  website?: string;
  email?: string;
  office?: {
    address?: string;
    phone?: string;
    fax?: string;
  };

  // その他
  biography?: string;
  personalInfo?: string; // 個人的な情報
  achievements?: string[]; // 表彰・受賞歴
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
