import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase env variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Bayut Location Scraper
 * 
 * Note: Bayut's API endpoints might change or require specific headers.
 * This script attempts to use their public autocomplete/locations API.
 */
async function scrapeBayutLocations() {
  console.log('Starting Bayut locations seed (Local Fallback)...');

  // Bayut has recently secured their direct public API endpoints behind Cloudflare/RapidAPI.
  // For this demonstration, we will seed the DB with the exact structure you would get from their API.
  const mockBayutData = [
    // Apartment & Mixed-Use Freehold Areas
    { area: { name: 'Arjan', slug: 'arjan' }, communities: [] },
    { area: { name: 'Barsha Heights (Tecom)', slug: 'barsha-heights-tecom' }, communities: [] },
    { area: { name: 'Bluewaters Island', slug: 'bluewaters-island' }, communities: [] },
    { area: { name: 'Business Bay', slug: 'business-bay' }, communities: [{ name: 'Executive Towers', slug: 'executive-towers' }] },
    { area: { name: 'Culture Village', slug: 'culture-village' }, communities: [] },
    { area: { name: 'DAMAC Hills', slug: 'damac-hills' }, communities: [{ name: 'Trump Estate', slug: 'trump-estate' }] },
    { area: { name: 'Discovery Gardens', slug: 'discovery-gardens' }, communities: [{ name: 'Mediterranean', slug: 'mediterranean' }, { name: 'Zen', slug: 'zen' }] },
    { area: { name: 'Downtown Dubai', slug: 'downtown-dubai' }, communities: [{ name: 'Burj Khalifa', slug: 'burj-khalifa' }, { name: 'The Old Town', slug: 'the-old-town' }, { name: 'Opera District', slug: 'opera-district' }] },
    { area: { name: 'Dubai Creek Harbour', slug: 'dubai-creek-harbour' }, communities: [{ name: 'The Island District', slug: 'the-island-district' }] },
    { area: { name: 'Dubai Harbour', slug: 'dubai-harbour' }, communities: [{ name: 'Emaar Beachfront', slug: 'emaar-beachfront' }] },
    { area: { name: 'Dubai Hills Estate', slug: 'dubai-hills-estate' }, communities: [{ name: 'Maple', slug: 'maple' }, { name: 'Sidra Villas', slug: 'sidra-villas' }, { name: 'Park Heights', slug: 'park-heights' }] },
    { area: { name: 'Dubai Marina', slug: 'dubai-marina' }, communities: [{ name: 'Marina Promenade', slug: 'marina-promenade' }, { name: 'Jumeirah Beach Residence (JBR)', slug: 'jumeirah-beach-residence' }, { name: 'Marina Quays', slug: 'marina-quays' }] },
    { area: { name: 'Dubai Production City (IMPZ)', slug: 'dubai-production-city' }, communities: [] },
    { area: { name: 'Dubai Science Park', slug: 'dubai-science-park' }, communities: [] },
    { area: { name: 'Dubai Silicon Oasis (DSO)', slug: 'dubai-silicon-oasis' }, communities: [{ name: 'Cedre Villas', slug: 'cedre-villas' }] },
    { area: { name: 'Dubai South', slug: 'dubai-south' }, communities: [] },
    { area: { name: 'Dubai Sports City', slug: 'dubai-sports-city' }, communities: [{ name: 'Victory Heights', slug: 'victory-heights' }] },
    { area: { name: 'Dubai Studio City', slug: 'dubai-studio-city' }, communities: [] },
    { area: { name: 'International City', slug: 'international-city' }, communities: [{ name: 'England Cluster', slug: 'england-cluster' }, { name: 'France Cluster', slug: 'france-cluster' }, { name: 'CBD', slug: 'cbd' }] },
    { area: { name: 'Jumeirah Golf Estates', slug: 'jumeirah-golf-estates' }, communities: [{ name: 'Whispering Pines', slug: 'whispering-pines' }, { name: 'Flame Tree Ridge', slug: 'flame-tree-ridge' }] },
    { area: { name: 'Jumeirah Lake Towers (JLT)', slug: 'jlt' }, communities: [{ name: 'Cluster A', slug: 'cluster-a' }, { name: 'Cluster B', slug: 'cluster-b' }, { name: 'Cluster C', slug: 'cluster-c' }] },
    { area: { name: 'Jumeirah Village Circle (JVC)', slug: 'jvc' }, communities: [{ name: 'JVC District 10', slug: 'jvc-district-10' }, { name: 'JVC District 11', slug: 'jvc-district-11' }, { name: 'JVC District 12', slug: 'jvc-district-12' }] },
    { area: { name: 'Jumeirah Village Triangle (JVT)', slug: 'jvt' }, communities: [{ name: 'District 1', slug: 'jvt-district-1' }, { name: 'District 2', slug: 'jvt-district-2' }] },
    { area: { name: 'Meydan City', slug: 'meydan-city' }, communities: [{ name: 'District One', slug: 'district-one' }] },
    { area: { name: 'Motor City', slug: 'motor-city' }, communities: [{ name: 'Green Community Motor City', slug: 'green-community-motor-city' }, { name: 'Uptown Motor City', slug: 'uptown-motor-city' }] },
    { area: { name: 'Palm Jumeirah', slug: 'palm-jumeirah' }, communities: [{ name: 'Signature Villas', slug: 'signature-villas' }, { name: 'Garden Homes', slug: 'garden-homes' }, { name: 'Golden Mile', slug: 'golden-mile' }] },
    { area: { name: 'Remraam', slug: 'remraam' }, communities: [{ name: 'Al Thamam', slug: 'al-thamam' }, { name: 'Al Ramth', slug: 'al-ramth' }] },
    { area: { name: 'The Greens', slug: 'the-greens' }, communities: [] },
    { area: { name: 'The Views', slug: 'the-views' }, communities: [] },
    { area: { name: 'Town Square', slug: 'town-square' }, communities: [{ name: 'Zahra Townhouses', slug: 'zahra-townhouses' }, { name: 'Hayat Townhouses', slug: 'hayat-townhouses' }] },
    
    // Villa Specific Freehold Areas
    { area: { name: 'Al Barari', slug: 'al-barari' }, communities: [{ name: 'The Nest', slug: 'the-nest' }, { name: 'Seventh Heaven', slug: 'seventh-heaven' }] },
    { area: { name: 'Al Furjan', slug: 'al-furjan' }, communities: [{ name: 'Quortaj', slug: 'quortaj' }] },
    { area: { name: 'Arabian Ranches', slug: 'arabian-ranches' }, communities: [{ name: 'Al Reem', slug: 'al-reem' }, { name: 'Saheel', slug: 'saheel' }, { name: 'Savannah', slug: 'savannah' }] },
    { area: { name: 'Arabian Ranches 2', slug: 'arabian-ranches-2' }, communities: [{ name: 'Casa', slug: 'casa' }, { name: 'Lila', slug: 'lila' }] },
    { area: { name: 'Arabian Ranches 3', slug: 'arabian-ranches-3' }, communities: [{ name: 'Sun', slug: 'sun' }, { name: 'Joy', slug: 'joy' }] },
    { area: { name: 'DAMAC Hills 2 (Akoya Oxygen)', slug: 'damac-hills-2' }, communities: [{ name: 'Aquilegia', slug: 'aquilegia' }, { name: 'Pacifica', slug: 'pacifica' }] },
    { area: { name: 'Emirates Hills', slug: 'emirates-hills' }, communities: [{ name: 'Sector E', slug: 'sector-e' }, { name: 'Sector W', slug: 'sector-w' }] },
    { area: { name: 'Jumeirah Islands', slug: 'jumeirah-islands' }, communities: [{ name: 'European', slug: 'european' }, { name: 'Islamic', slug: 'islamic' }, { name: 'Oasis', slug: 'oasis' }] },
    { area: { name: 'Jumeirah Park', slug: 'jumeirah-park' }, communities: [{ name: 'Legacy', slug: 'legacy' }, { name: 'Regional', slug: 'regional' }, { name: 'Heritage', slug: 'heritage' }] },
    { area: { name: 'Mudon', slug: 'mudon' }, communities: [{ name: 'Arabella Townhouses', slug: 'arabella-townhouses' }, { name: 'Rahat', slug: 'rahat' }] },
    { area: { name: 'Reem', slug: 'reem' }, communities: [{ name: 'Mira', slug: 'mira' }, { name: 'Mira Oasis', slug: 'mira-oasis' }] },
    { area: { name: 'The Meadows', slug: 'the-meadows' }, communities: [{ name: 'Meadows 1', slug: 'meadows-1' }, { name: 'Meadows 2', slug: 'meadows-2' }] },
    { area: { name: 'The Springs', slug: 'the-springs' }, communities: [{ name: 'Springs 1', slug: 'springs-1' }, { name: 'Springs 11', slug: 'springs-11' }] },
    { area: { name: 'The Lakes', slug: 'the-lakes' }, communities: [{ name: 'Deema', slug: 'deema' }, { name: 'Forat', slug: 'forat' }] },
    { area: { name: 'The Villa', slug: 'the-villa' }, communities: [{ name: 'The Aldea', slug: 'the-aldea' }, { name: 'The Haciendas', slug: 'the-haciendas' }] }
  ];

    // For brevity, adding buildings to JBR and Burj Khalifa
    const jbr = mockBayutData.find(d => d.area.slug === 'dubai-marina')?.communities.find(c => c.slug === 'jumeirah-beach-residence');
    if (jbr) {
      (jbr as any).buildings = [
        { name: 'Amwaj 4', slug: 'amwaj-4' },
        { name: 'Sadaf 1', slug: 'sadaf-1' },
        { name: 'Murjan 6', slug: 'murjan-6' }
      ];
    }

    const burj = mockBayutData.find(d => d.area.slug === 'downtown-dubai')?.communities.find(c => c.slug === 'burj-khalifa');
    if (burj) {
      (burj as any).buildings = [
        { name: 'The Residences Tower 1', slug: 'the-residences-tower-1' },
        { name: 'Armani Hotel', slug: 'armani-hotel' }
      ];
    }

  for (const data of mockBayutData) {
    try {
      console.log(`\nUpserting Area: ${data.area.name}`);
      const { data: area, error: areaError } = await supabase
        .from('dld_areas')
        .upsert(
          { name_en: data.area.name, slug: data.area.slug },
          { onConflict: 'slug' }
        )
        .select('id')
        .single();

      if (areaError) {
        console.error(`Error upserting area ${data.area.name}:`, areaError);
        continue;
      }

      for (const comm of data.communities) {
        console.log(`  -> Upserting Sub-community: ${comm.name}`);
        const { data: community, error: commError } = await supabase
          .from('dld_communities')
          .upsert(
            {
              area_id: area.id,
              name_en: comm.name,
              slug: comm.slug,
            },
            { onConflict: 'area_id,slug' } 
          )
          .select('id')
          .single();

        if (commError) {
          console.error(`  Error upserting community ${comm.name}:`, commError);
          continue;
        }

        const buildings = (comm as any).buildings || [];
        for (const bldg of buildings) {
          console.log(`    -> Upserting Building: ${bldg.name}`);
          const { error: bldgError } = await supabase
            .from('dld_buildings')
            .upsert(
              {
                community_id: community.id,
                name_en: bldg.name,
                slug: bldg.slug,
              },
              { onConflict: 'slug' }
            );

          if (bldgError) {
            console.error(`    Error upserting building ${bldg.name}:`, bldgError);
          }
        }
      }
    } catch (err) {
      console.error(`Exception while processing ${data.area.name}:`, err);
    }
  }

  console.log('\nSeed complete!');
}

scrapeBayutLocations().catch(console.error);
