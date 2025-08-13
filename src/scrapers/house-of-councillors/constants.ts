// Configuration constants for House of Councillors scraping
export const HOUSE_OF_COUNCILLORS_CONFIG = {
  URLS: {
    // Current session member list - configurable for different sessions
    CURRENT:
      process.env.HOUSE_OF_COUNCILLORS_URL ||
      'https://www.sangiin.go.jp/japanese/joho1/kousei/giin/218/giin.htm',
    // Fallback URLs for common sessions
    FALLBACK_URLS: [
      'https://www.sangiin.go.jp/japanese/joho1/kousei/giin/218/giin.htm', // 218th session
      'https://www.sangiin.go.jp/japanese/joho1/kousei/giin/217/giin.htm', // 217th session
    ],
    BASE_URL: 'https://www.sangiin.go.jp',
  },
  TIMEOUTS: {
    PAGE_LOAD: Number(process.env.PAGE_LOAD_TIMEOUT) || 10000,
    NAVIGATION: Number(process.env.NAVIGATION_TIMEOUT) || 15000,
    PROFILE_SCRAPE: Number(process.env.PROFILE_SCRAPE_TIMEOUT) || 10000,
    NETWORK_IDLE: Number(process.env.NETWORK_IDLE_TIMEOUT) || 5000,
  },
  // Known political parties - used for validation but not restrictive
  KNOWN_POLITICAL_PARTIES: [
    '自民', // 自由民主党
    '立憲', // 立憲民主党
    '公明', // 公明党
    '維新', // 日本維新の会
    '共産', // 日本共産党
    '民主', // 国民民主党
    'れ新', // れいわ新選組
    '社民', // 社会民主党
    '無所属',
    '無会派',
  ],
  // Patterns to identify valid party names (more flexible)
  PARTY_PATTERNS: [
    /[自立公維共民社][民主明新産主]/, // Major party patterns
    /れ新/, // れいわ新選組
    /無[所会][属派]/, // 無所属、無会派
    /[会派]/, // General party/faction patterns
  ],
  ELECTION_TYPES: {
    PROPORTIONAL: '比例',
    CONSTITUENCY: 'prefecture', // Prefecture-based constituencies for Upper House
  },
} as const;

// Japanese prefectures for election district parsing
export const PREFECTURES = [
  '北海道',
  '青森',
  '岩手',
  '宮城',
  '秋田',
  '山形',
  '福島',
  '茨城',
  '栃木',
  '群馬',
  '埼玉',
  '千葉',
  '東京',
  '神奈川',
  '新潟',
  '富山',
  '石川',
  '福井',
  '山梨',
  '長野',
  '岐阜',
  '静岡',
  '愛知',
  '三重',
  '滋賀',
  '京都',
  '大阪',
  '兵庫',
  '奈良',
  '和歌山',
  '鳥取',
  '島根',
  '岡山',
  '広島',
  '山口',
  '徳島',
  '香川',
  '愛媛',
  '高知',
  '福岡',
  '佐賀',
  '長崎',
  '熊本',
  '大分',
  '宮崎',
  '鹿児島',
  '沖縄',
] as const;

// Proportional representation blocks for House of Councillors
export const PROPORTIONAL_BLOCKS = [
  '北海道',
  '東北',
  '北関東',
  '南関東',
  '東京',
  '北陸信越',
  '東海',
  '近畿',
  '中国',
  '四国',
  '九州',
] as const;
