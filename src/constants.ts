// Japan prefectures list - all 47 prefectures in geographical order
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

// Configuration constants for scraping
export const SCRAPING_CONFIG = {
  URLS: {
    HOUSE_OF_REPRESENTATIVES:
      'https://www.shugiin.go.jp/internet/itdb_annai.nsf/html/statics/syu/1giin.htm',
    // All pages by Japanese syllabary (あ行 through わ行)
    HOUSE_OF_REPRESENTATIVES_PAGES: [
      'https://www.shugiin.go.jp/internet/itdb_annai.nsf/html/statics/syu/1giin.htm', // あ行
      'https://www.shugiin.go.jp/internet/itdb_annai.nsf/html/statics/syu/2giin.htm', // か行
      'https://www.shugiin.go.jp/internet/itdb_annai.nsf/html/statics/syu/3giin.htm', // さ行
      'https://www.shugiin.go.jp/internet/itdb_annai.nsf/html/statics/syu/4giin.htm', // た行
      'https://www.shugiin.go.jp/internet/itdb_annai.nsf/html/statics/syu/5giin.htm', // な行
      'https://www.shugiin.go.jp/internet/itdb_annai.nsf/html/statics/syu/6giin.htm', // は行
      'https://www.shugiin.go.jp/internet/itdb_annai.nsf/html/statics/syu/7giin.htm', // ま行
      'https://www.shugiin.go.jp/internet/itdb_annai.nsf/html/statics/syu/8giin.htm', // や行
      'https://www.shugiin.go.jp/internet/itdb_annai.nsf/html/statics/syu/9giin.htm', // ら行
      'https://www.shugiin.go.jp/internet/itdb_annai.nsf/html/statics/syu/10giin.htm', // わ行
    ],
  },
  TIMEOUTS: {
    PAGE_LOAD: 3000,
  },
} as const;
