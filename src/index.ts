import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getCacheInfo, shouldUseCachedData } from './cache';
import { DietMemberScraper } from './scraper';
import type { HouseOfRepresentativesResult } from './scrapers/house-of-representatives/types';

async function main() {
  const scraper = new DietMemberScraper();

  // Parse command line arguments
  const args = process.argv.slice(2);
  const includeProfiles = args.includes('--profiles');
  const forceRefresh = args.includes('--force-refresh');
  const getAllProfiles = args.includes('--all');
  const maxProfiles = getAllProfiles
    ? Number.MAX_SAFE_INTEGER // No limit when --all is specified
    : args.includes('--max-profiles')
      ? parseInt(args[args.indexOf('--max-profiles') + 1] ?? '10') || 10
      : 10;

  try {
    // Ensure output directory exists
    const outputDir = join(process.cwd(), 'out');
    mkdirSync(outputDir, { recursive: true });

    if (includeProfiles) {
      const filename = getAllProfiles
        ? 'diet-members-with-all-profiles.json'
        : 'diet-members-with-profiles.json';
      const cacheCheck = shouldUseCachedData(filename, { forceRefresh });

      let result: HouseOfRepresentativesResult;
      if (cacheCheck.useCache && cacheCheck.cachedData) {
        console.log('Using cached data from previous scraping...');
        const cacheAge = getCacheInfo(filename);
        if (cacheAge) {
          console.log(`Cache created: ${cacheAge}`);
        }
        result = cacheCheck.cachedData;

        console.log(`Loaded ${result.members.length} members from cache`);
        const membersWithProfiles = result.members.filter((m) => 'profile' in m && m.profile);
        console.log(`${membersWithProfiles.length} members have profile data`);
      } else {
        if (forceRefresh) {
          console.log('Force refresh requested - ignoring cache');
        }

        console.log('Initializing browser...');
        await scraper.initialize();

        if (getAllProfiles) {
          console.log(
            'Starting to scrape House of Representatives with profiles for ALL members...'
          );
        } else {
          console.log(
            `Starting to scrape House of Representatives with profiles (max: ${maxProfiles})...`
          );
        }
        result = await scraper.scrapeHouseOfRepresentativesWithProfiles({
          includeProfiles: true,
          maxProfiles,
          maxConcurrentProfiles: 2,
          profileDelay: 1500,
        });

        console.log(`Scraped ${result.members.length} members`);
        const membersWithProfiles = result.members.filter((m) => 'profile' in m && m.profile);
        console.log(`${membersWithProfiles.length} members have profile data`);

        const outputPath = join(process.cwd(), 'out', filename);
        writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');
        console.log(`Results with profiles saved to ${outputPath}`);
      }

      // Show sample profile data
      const membersWithProfiles = result.members.filter((m) => 'profile' in m && m.profile);
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
      const filename = 'diet-members.json';
      const cacheCheck = shouldUseCachedData(filename, { forceRefresh });

      let result: HouseOfRepresentativesResult;
      if (cacheCheck.useCache && cacheCheck.cachedData) {
        console.log('Using cached data from previous scraping...');
        const cacheAge = getCacheInfo(filename);
        if (cacheAge) {
          console.log(`Cache created: ${cacheAge}`);
        }

        // Convert to basic format for backward compatibility
        const basicResult = {
          members: cacheCheck.cachedData.members.map((member) => ({
            name: member.name,
            party: member.party,
            election: member.election,
            ...(member.furigana && { furigana: member.furigana }),
            ...(member.profileUrl && { profileUrl: member.profileUrl }),
            ...(member.electionCount && { electionCount: member.electionCount }),
          })),
          scrapedAt: cacheCheck.cachedData.scrapedAt,
          source: cacheCheck.cachedData.source,
        };

        result = basicResult;
        console.log(`Loaded ${result.members.length} members from cache`);
      } else {
        if (forceRefresh) {
          console.log('Force refresh requested - ignoring cache');
        }

        console.log('Initializing browser...');
        await scraper.initialize();

        console.log('Starting to scrape House of Representatives (basic data only)...');
        result = await scraper.scrapeHouseOfRepresentativesList();

        console.log(`Scraped ${result.members.length} members`);

        const outputPath = join(process.cwd(), 'out', filename);
        writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');
        console.log(`Results saved to ${outputPath}`);
      }

      console.log('\nSample data:');
      console.log(JSON.stringify(result.members.slice(0, 3), null, 2));
    }

    console.log('\nUsage:');
    console.log('  npm run dev                         # Basic member data only');
    console.log(
      '  npm run dev -- --profiles           # Include profile data (default: 10 profiles)'
    );
    console.log('  npm run dev -- --profiles --max-profiles 25  # Include up to 25 profiles');
    console.log("  npm run dev -- --profiles --all     # Include ALL members' profiles");
    console.log('  npm run dev -- --force-refresh      # Force refresh, ignore cache');
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
