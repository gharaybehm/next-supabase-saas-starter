'use server';

import { createClient } from '@/utils/supabase/server';

export async function searchAreas(query: string) {
  const supabase = await createClient();

  let dbQuery = supabase
    .from('dld_areas')
    .select('id, name_en, slug')
    .limit(10);

  if (query) {
    dbQuery = dbQuery.ilike('name_en', `%${query}%`);
  }

  const { data, error } = await dbQuery;

  if (error) {
    console.error('Error fetching areas:', error);
    return [];
  }

  return data;
}

export async function searchCommunities(areaId: string, query: string) {
  if (!areaId) return [];

  const supabase = await createClient();

  let dbQuery = supabase
    .from('dld_communities')
    .select('id, name_en, slug, area_id')
    .eq('area_id', areaId)
    .limit(15);

  if (query) {
    dbQuery = dbQuery.ilike('name_en', `%${query}%`);
  }

  const { data, error } = await dbQuery;

  if (error) {
    console.error('Error fetching communities:', error);
    return [];
  }

  return data;
}

export interface GlobalLocationResult {
  id: string;
  type: 'area' | 'community' | 'building';
  name_en: string;
  parent_area_name?: string;
  parent_community_name?: string;
  area_id?: string;
  community_id?: string;
}

export async function searchGlobalLocations(query: string): Promise<GlobalLocationResult[]> {
  if (!query || query.length < 2) return [];

  const supabase = await createClient();

  // 1. Search Areas
  const { data: areas, error: areaError } = await supabase
    .from('dld_areas')
    .select('id, name_en')
    .ilike('name_en', `%${query}%`)
    .limit(5);

  const areaIds = areas ? areas.map(a => a.id) : [];

  // 2. Search Communities
  let commQuery = supabase
    .from('dld_communities')
    .select('id, name_en, area_id, dld_areas!inner(name_en)')
    .limit(10);

  if (areaIds.length > 0) {
    commQuery = commQuery.or(`name_en.ilike.%${query}%,area_id.in.(${areaIds.join(',')})`);
  } else {
    commQuery = commQuery.ilike('name_en', `%${query}%`);
  }

  const { data: communities, error: commError } = await commQuery;
  const commIds = communities ? communities.map(c => c.id) : [];

  // 3. Search Buildings
  let bldgQuery = supabase
    .from('dld_buildings')
    .select('id, name_en, community_id, dld_communities!inner(id, name_en, area_id, dld_areas(name_en))')
    .limit(10);

  if (commIds.length > 0) {
    bldgQuery = bldgQuery.or(`name_en.ilike.%${query}%,community_id.in.(${commIds.join(',')})`);
  } else {
    bldgQuery = bldgQuery.ilike('name_en', `%${query}%`);
  }

  const { data: buildings, error: bldgError } = await bldgQuery;

  if (areaError) console.error('Area Search Error:', areaError);
  if (commError) console.error('Community Search Error:', commError);
  if (bldgError) console.error('Building Search Error:', bldgError);

  const results: GlobalLocationResult[] = [];

  if (areas) {
    areas.forEach(a => results.push({ id: a.id, type: 'area', name_en: a.name_en, area_id: a.id }));
  }

  if (communities) {
    communities.forEach(c => {
      const parentName = (c.dld_areas as any)?.name_en || '';
      results.push({
        id: c.id,
        type: 'community',
        name_en: c.name_en,
        parent_area_name: parentName,
        area_id: c.area_id,
        community_id: c.id
      });
    });
  }

  if (buildings) {
    buildings.forEach(b => {
      const commData = b.dld_communities as any;
      const parentArea = commData?.dld_areas?.name_en || '';
      results.push({
        id: b.id,
        type: 'building',
        name_en: b.name_en,
        parent_community_name: commData?.name_en || '',
        parent_area_name: parentArea,
        area_id: commData?.area_id,
        community_id: b.community_id
      });
    });
  }

  return results;
}
