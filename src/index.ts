import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getCacheInfo, shouldUseCachedData } from './cache';
import { DietMemberScraper } from './scraper';
import type { HouseOfRepresentativesResult } from './scrapers/house-of-representatives/types';

async function main() {
  const scraper = new DietMemberScraper();

  // Parse command line arguments
  const args = process.argv.slice(2);
  const scriptName = args[0] || 'basic';
  const forceRefresh = args.includes('--force-refresh');
  const maxProfilesArg = args.includes('--max-profiles')
    ? parseInt(args[args.indexOf('--max-profiles') + 1] ?? '10') || 10
    : 10;

  // Determine chamber
  const chamber =
    args.includes('--house-of-councillors') ||
    args.includes('--councillors') ||
    args.includes('--senate')
      ? 'councillors'
      : 'representatives';

  // Determine scraping mode based on script name
  let includeProfiles = false;
  let getAllProfiles = false;
  let maxProfiles = 10;

  switch (scriptName.toLowerCase()) {
    case 'basic':
      includeProfiles = false;
      break;
    case 'profiles':
      includeProfiles = true;
      maxProfiles = maxProfilesArg;
      break;
    case 'profiles-all':
    case 'all-profiles':
    case 'all':
      includeProfiles = true;
      getAllProfiles = true;
      maxProfiles = Number.MAX_SAFE_INTEGER;
      break;
    default:
      console.error(`❌ Unknown script: ${scriptName}`);
      console.log('\n📖 Available scripts:');
      console.log('  basic        - Scrape basic member data only');
      console.log('  profiles     - Scrape with profiles (default: 10, use --max-profiles N)');
      console.log('  all-profiles - Scrape ALL members with profiles');
      console.log('\n🔧 Options:');
      console.log('  --force-refresh          - Ignore cache and fetch fresh data');
      console.log(
        '  --max-profiles N         - Limit profile scraping to N members (profiles only)'
      );
      console.log('  --house-of-councillors   - Scrape House of Councillors (Senate)');
      console.log('  --councillors            - Alias for --house-of-councillors');
      console.log('  --senate                 - Alias for --house-of-councillors');
      console.log('\n📋 Examples:');
      console.log(
        '  npm run dev basic                                  # House of Representatives basic'
      );
      console.log(
        '  npm run dev basic --house-of-councillors           # House of Councillors basic'
      );
      console.log(
        '  npm run dev profiles --councillors                 # House of Councillors with profiles'
      );
      process.exit(1);
  }

  try {
    // Ensure output directory exists
    const outputDir = join(process.cwd(), 'out');
    mkdirSync(outputDir, { recursive: true });

    const chamberName =
      chamber === 'councillors' ? 'house-of-councillors' : 'house-of-representatives';
    const displayName =
      chamber === 'councillors' ? 'House of Councillors' : 'House of Representatives';

    if (includeProfiles) {
      const filename = getAllProfiles
        ? `${chamberName}-members-with-all-profiles.json`
        : `${chamberName}-members-with-profiles.json`;
      const cacheCheck = shouldUseCachedData(filename, { forceRefresh });

      let result:
        | HouseOfRepresentativesResult
        | import('./scrapers/house-of-councillors/types').HouseOfCouncillorsResult;
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

        console.log(`🚀 Running script: ${scriptName} for ${displayName}`);
        if (getAllProfiles) {
          console.log(`📋 Starting to scrape ${displayName} with profiles for ALL members...`);
        } else {
          console.log(
            `📋 Starting to scrape ${displayName} with profiles (max: ${maxProfiles})...`
          );
        }

        if (chamber === 'councillors') {
          result = await scraper.scrapeHouseOfCouncillorsWithProfiles({
            includeProfiles: true,
            maxProfiles,
            maxConcurrentProfiles: 2,
            profileDelay: 1500,
          });
        } else {
          result = await scraper.scrapeHouseOfRepresentativesWithProfiles({
            includeProfiles: true,
            maxProfiles,
            maxConcurrentProfiles: 2,
            profileDelay: 1500,
          });
        }

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
      const filename = `${chamberName}-members.json`;
      const cacheCheck = shouldUseCachedData(filename, { forceRefresh });

      let result: import('./types').ScrapeResult;
      if (cacheCheck.useCache && cacheCheck.cachedData) {
        console.log('Using cached data from previous scraping...');
        const cacheAge = getCacheInfo(filename);
        if (cacheAge) {
          console.log(`Cache created: ${cacheAge}`);
        }

        // Convert to basic format for backward compatibility
        const basicResult = {
          members: cacheCheck.cachedData.members.map(
            (member: import('./types').DietMember & { termExpiration?: string }) => ({
              name: member.name,
              party: member.party,
              election: member.election,
              ...(member.furigana && { furigana: member.furigana }),
              ...(member.profileUrl && { profileUrl: member.profileUrl }),
              ...(member.electionCount && { electionCount: member.electionCount }),
              ...(member.termExpiration && { termExpiration: member.termExpiration }),
            })
          ),
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

        console.log(`🚀 Running script: ${scriptName} for ${displayName}`);
        console.log(`📋 Starting to scrape ${displayName} (basic data only)...`);

        if (chamber === 'councillors') {
          result = await scraper.scrapeHouseOfCouncillorsList();
        } else {
          result = await scraper.scrapeHouseOfRepresentativesList();
        }

        console.log(`Scraped ${result.members.length} members`);

        const outputPath = join(process.cwd(), 'out', filename);
        writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');
        console.log(`Results saved to ${outputPath}`);
      }

      console.log('\nSample data:');
      console.log(JSON.stringify(result.members.slice(0, 3), null, 2));
    }

    console.log('\n📖 Usage:');
    console.log(
      '  npm run dev basic                               # House of Representatives basic (default)'
    );
    console.log('  npm run dev basic --house-of-councillors        # House of Councillors basic');
    console.log(
      '  npm run dev profiles                            # House of Representatives with profiles'
    );
    console.log(
      '  npm run dev profiles --councillors              # House of Councillors with profiles'
    );
    console.log('  npm run dev profiles --max-profiles 25          # Include up to 25 profiles');
    console.log(
      '  npm run dev all-profiles --senate               # House of Councillors ALL profiles'
    );
    console.log('\n🔧 Options:');
    console.log('  --force-refresh                                 # Force refresh, ignore cache');
    console.log('  --max-profiles N                                # Limit profiles to N members');
    console.log('  --house-of-councillors, --councillors, --senate # Scrape House of Councillors');
    console.log('\n💡 Script aliases:');
    console.log('  all-profiles = profiles-all = all');
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
