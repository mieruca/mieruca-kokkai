import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DietMemberScraper } from './scraper';

async function main() {
  const scraper = new DietMemberScraper();

  // Parse command line arguments
  const args = process.argv.slice(2);
  const includeProfiles = args.includes('--profiles');
  const maxProfiles = args.includes('--max-profiles')
    ? parseInt(args[args.indexOf('--max-profiles') + 1] ?? '10') || 10
    : 10;

  try {
    console.log('Initializing browser...');
    await scraper.initialize();

    if (includeProfiles) {
      console.log(
        `Starting to scrape House of Representatives with profiles (max: ${maxProfiles})...`
      );
      const result = await scraper.scrapeHouseOfRepresentativesWithProfiles({
        includeProfiles: true,
        maxProfiles,
        maxConcurrentProfiles: 2,
        profileDelay: 1500,
      });

      console.log(`Scraped ${result.members.length} members`);
      const membersWithProfiles = result.members.filter((m) => 'profile' in m && m.profile);
      console.log(`${membersWithProfiles.length} members have profile data`);

      const outputPath = join(process.cwd(), 'diet-members-with-profiles.json');
      writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');
      console.log(`Results with profiles saved to ${outputPath}`);

      // Show sample profile data
      const memberWithProfile = membersWithProfiles[0];
      if (memberWithProfile?.profile) {
        console.log('\nSample profile data:');
        console.log(
          JSON.stringify(
            {
              name: memberWithProfile.name,
              party: memberWithProfile.party,
              profile: memberWithProfile.profile,
            },
            null,
            2
          )
        );
      }
    } else {
      console.log('Starting to scrape House of Representatives (basic data only)...');
      const result = await scraper.scrapeHouseOfRepresentativesList();

      console.log(`Scraped ${result.members.length} members`);

      const outputPath = join(process.cwd(), 'diet-members.json');
      writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');

      console.log(`Results saved to ${outputPath}`);
      console.log('\nSample data:');
      console.log(JSON.stringify(result.members.slice(0, 3), null, 2));
    }

    console.log('\nUsage:');
    console.log('  npm run dev                    # Basic member data only');
    console.log('  npm run dev -- --profiles      # Include profile data (default: 10 profiles)');
    console.log('  npm run dev -- --profiles --max-profiles 25  # Include up to 25 profiles');
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
