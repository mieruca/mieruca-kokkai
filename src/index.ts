import { DietMemberScraper } from './scraper';
import { writeFileSync } from 'fs';
import { join } from 'path';

async function main() {
  const scraper = new DietMemberScraper();
  
  try {
    console.log('Initializing browser...');
    await scraper.initialize();
    
    console.log('Starting to scrape House of Representatives...');
    const result = await scraper.scrapeSimpleExample();
    
    console.log(`Scraped ${result.members.length} members`);
    
    const outputPath = join(process.cwd(), 'diet-members.json');
    writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');
    
    console.log(`Results saved to ${outputPath}`);
    console.log('\nSample data:');
    console.log(JSON.stringify(result.members.slice(0, 3), null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    console.log('Closing browser...');
    await scraper.close();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { DietMemberScraper } from './scraper';
export * from './types';