import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase env variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Example script to synchronize DLD Areas and Communities.
 * In a real-world scenario, you would fetch this from Dubai Pulse APIs.
 */
async function syncLocations() {
  console.log('Starting DLD location sync...');

  // Mock data representing what you might fetch from DLD Open Data
  const mockDldData = [
    {
      area_name_en: 'Dubai Marina',
      area_slug: 'dubai-marina',
      communities: [
        { name_en: 'Marina Promenade', slug: 'marina-promenade' },
        { name_en: 'Jumeirah Beach Residence', slug: 'jumeirah-beach-residence' },
      ],
    },
    {
      area_name_en: 'Downtown Dubai',
      area_slug: 'downtown-dubai',
      communities: [
        { name_en: 'Burj Khalifa', slug: 'burj-khalifa' },
        { name_en: 'The Old Town', slug: 'the-old-town' },
      ],
    },
  ];

  for (const areaData of mockDldData) {
    // 1. Upsert Area
    const { data: area, error: areaError } = await supabase
      .from('dld_areas')
      .upsert(
        {
          name_en: areaData.area_name_en,
          slug: areaData.area_slug,
        },
        { onConflict: 'slug' }
      )
      .select('id')
      .single();

    if (areaError) {
      console.error(`Error upserting area ${areaData.area_name_en}:`, areaError);
      continue;
    }

    const areaId = area.id;

    // 2. Upsert Communities
    for (const comm of areaData.communities) {
      const { error: commError } = await supabase
        .from('dld_communities')
        .upsert(
          {
            area_id: areaId,
            name_en: comm.name_en,
            slug: comm.slug,
          },
          { onConflict: 'area_id,slug' }
        );

      if (commError) {
        console.error(`Error upserting community ${comm.name_en}:`, commError);
      }
    }
  }

  console.log('DLD location sync complete!');
}

syncLocations().catch(console.error);
