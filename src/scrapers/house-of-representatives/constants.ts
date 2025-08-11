// Configuration constants for House of Representatives scraping
export const HOUSE_OF_REPRESENTATIVES_CONFIG = {
  URLS: {
    BASE_URL: 'https://www.shugiin.go.jp/internet/itdb_annai.nsf/html/statics/syu/1giin.htm',
    // All pages by Japanese syllabary (あ行 through わ行)
    ALL_PAGES: [
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
  SYLLABARY_NAMES: ['あ行', 'か行', 'さ行', 'た行', 'な行', 'は行', 'ま行', 'や行', 'ら行', 'わ行'],
} as const;
