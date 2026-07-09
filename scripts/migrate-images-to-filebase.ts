// One-time backfill: copies every listing image still on Supabase Storage to
// Filebase and flips listing_images.storage_provider once the copy is verified.
// Safe to re-run — rows already marked 'filebase' are skipped.
//
// Usage: npm run migrate:images

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createAdminClient } from '../utils/supabase/admin';
import { uploadObject } from '../utils/storage';

const PAGE_SIZE = 500;
const CONCURRENCY = 8;

type ImageRow = {
  id: string;
  storage_path: string;
  storage_provider: string;
};

async function migrateRow(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminDb: any,
  row: ImageRow
): Promise<'migrated' | 'failed'> {
  try {
    const { data: blob, error: downloadError } = await adminDb.storage
      .from('listing-images')
      .download(row.storage_path);

    if (downloadError || !blob) {
      console.error(`[migrate] download failed for ${row.storage_path}:`, downloadError);
      return 'failed';
    }

    const buffer = Buffer.from(await blob.arrayBuffer());
    const contentType = blob.type || 'image/jpeg';

    const { error: uploadError, cid } = await uploadObject(row.storage_path, buffer, contentType);
    if (uploadError || !cid) {
      console.error(`[migrate] upload failed for ${row.storage_path}:`, uploadError ?? 'no CID returned');
      return 'failed';
    }

    await adminDb
      .from('listing_images')
      .update({ storage_provider: 'filebase', cid })
      .eq('id', row.id);

    return 'migrated';
  } catch (err) {
    console.error(`[migrate] unexpected error for ${row.storage_path}:`, err);
    return 'failed';
  }
}

async function run() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminDb = createAdminClient() as any;

  let migrated = 0;
  let failed = 0;
  let skipped = 0;
  const failures: string[] = [];

  let from = 0;
  for (;;) {
    const { data: rows, error } = await adminDb
      .from('listing_images')
      .select('id, storage_path, storage_provider')
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error('[migrate] failed to fetch listing_images page:', error);
      process.exit(1);
    }
    if (!rows || rows.length === 0) break;

    const pending = (rows as ImageRow[]).filter((r) => r.storage_provider !== 'filebase');
    skipped += rows.length - pending.length;

    for (let i = 0; i < pending.length; i += CONCURRENCY) {
      const batch = pending.slice(i, i + CONCURRENCY);
      const results = await Promise.all(batch.map((row) => migrateRow(adminDb, row)));
      for (let j = 0; j < results.length; j++) {
        if (results[j] === 'migrated') migrated++;
        else {
          failed++;
          failures.push(batch[j].storage_path);
        }
      }
    }

    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  console.log('\n--- Filebase backfill summary ---');
  console.log(`Migrated: ${migrated}`);
  console.log(`Already on Filebase (skipped): ${skipped}`);
  console.log(`Failed: ${failed}`);
  if (failures.length > 0) {
    console.log('Failed paths (re-run this script to retry):');
    for (const path of failures) console.log(`  - ${path}`);
  }
}

run();
