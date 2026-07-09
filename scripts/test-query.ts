import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase
    .from('dld_communities')
    .select('id, name_en, area_id, dld_areas!inner(name_en)')
    .ilike('name_en', `%jbr%`)
    .limit(10);

  console.log('Data:', JSON.stringify(data, null, 2));
  if (error) console.error('Error:', error);
}

test();
