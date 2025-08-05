import { chromium, Browser, Page } from 'playwright';
import { DietMember, ScrapeResult } from './types';

export class DietMemberScraper {
  private browser: Browser | null = null;

  async initialize(): Promise<void> {
    this.browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async scrapeHouseOfRepresentatives(): Promise<ScrapeResult> {
    if (!this.browser) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    const page = await this.browser.newPage();
    const members: DietMember[] = [];

    try {
      await page.goto('https://www.shugiin.go.jp/internet/itdb_shitsumei.nsf/html/shitsumon/menu_m.htm');
      
      await page.waitForTimeout(2000);

      const memberLinks = await page.$$eval('a[href*="detail"]', links => 
        links.map(link => ({
          url: (link as HTMLAnchorElement).href,
          text: link.textContent?.trim() || ''
        }))
      );

      for (const link of memberLinks.slice(0, 10)) {
        try {
          const member = await this.scrapeMemberDetail(page, link.url);
          if (member) {
            members.push(member);
          }
        } catch (error) {
          console.error(`Error scraping member from ${link.url}:`, error);
        }
      }

    } catch (error) {
      console.error('Error scraping House of Representatives:', error);
    } finally {
      await page.close();
    }

    return {
      members,
      scrapedAt: new Date().toISOString(),
      source: 'house-of-representatives'
    };
  }

  private async scrapeMemberDetail(page: Page, url: string): Promise<DietMember | null> {
    try {
      await page.goto(url);
      await page.waitForTimeout(1000);

      const name = await page.$eval('h1, .member-name, .name', el => el.textContent?.trim() || '').catch(() => '');
      
      if (!name) return null;

      const party = await page.$eval('[class*="party"], [class*="政党"]', el => el.textContent?.trim() || '').catch(() => '不明');
      
      const prefecture = await page.$eval('[class*="prefecture"], [class*="選挙区"], [class*="都道府県"]', el => el.textContent?.trim() || '').catch(() => '不明');

      return {
        name,
        party,
        prefecture,
        chamber: 'house-of-representatives',
        profileUrl: url
      };
    } catch (error) {
      console.error(`Error scraping member detail from ${url}:`, error);
      return null;
    }
  }

  async scrapeSimpleExample(): Promise<ScrapeResult> {
    if (!this.browser) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    const page = await this.browser.newPage();
    const members: DietMember[] = [];

    try {
      await page.goto('https://www.shugiin.go.jp/internet/itdb_giinprof.nsf/html/profile/list.htm');
      
      await page.waitForTimeout(3000);

      const memberData = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('tr'));
        const members: any[] = [];
        
        rows.forEach(row => {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 3) {
            const nameCell = cells[0];
            const name = nameCell.textContent?.trim();
            
            if (name && name !== '氏名' && name !== '') {
              members.push({
                name: name,
                party: cells[1]?.textContent?.trim() || '不明',
                prefecture: cells[2]?.textContent?.trim() || '不明',
                chamber: 'house-of-representatives'
              });
            }
          }
        });
        
        return members;
      });

      members.push(...memberData);

    } catch (error) {
      console.error('Error in simple scraping:', error);
      
      members.push({
        name: 'テストデータ',
        party: 'テスト党',
        prefecture: 'テスト県',
        chamber: 'house-of-representatives' as const
      });
    } finally {
      await page.close();
    }

    return {
      members,
      scrapedAt: new Date().toISOString(),
      source: 'house-of-representatives-simple'
    };
  }
}