import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";

// Filebase-backed object storage (S3-compatible gateway to IPFS/Sia/Skynet).
// `key` here is always the existing listing_images.storage_path value
// ({tenantId}/{listingId}/{uuid}.jpg) — no path-format change from Supabase Storage.

let client: S3Client | null = null;

function getClient(): S3Client {
  if (client) return client;

  const endpoint = process.env.FILEBASE_ENDPOINT;
  const region = process.env.FILEBASE_REGION;
  const accessKeyId = process.env.FILEBASE_ACCESS_KEY_ID;
  const secretAccessKey = process.env.FILEBASE_SECRET_ACCESS_KEY;

  if (!endpoint || !region || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Missing Filebase config. Set FILEBASE_ENDPOINT, FILEBASE_REGION, FILEBASE_ACCESS_KEY_ID and FILEBASE_SECRET_ACCESS_KEY in .env.local."
    );
  }

  client = new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });

  return client;
}

function getBucket(): string {
  const bucket = process.env.FILEBASE_BUCKET;
  if (!bucket) throw new Error("Missing FILEBASE_BUCKET in .env.local.");
  return bucket;
}

export async function uploadObject(
  key: string,
  body: Buffer,
  contentType: string
): Promise<{ error: string | null }> {
  try {
    await getClient().send(
      new PutObjectCommand({
        Bucket: getBucket(),
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    );
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Upload failed" };
  }
}

export async function deleteObject(key: string): Promise<void> {
  try {
    await getClient().send(
      new DeleteObjectCommand({ Bucket: getBucket(), Key: key })
    );
  } catch (err) {
    console.error(`[deleteObject] failed to delete ${key}:`, err);
  }
}

export async function objectExists(key: string): Promise<boolean> {
  try {
    await getClient().send(
      new HeadObjectCommand({ Bucket: getBucket(), Key: key })
    );
    return true;
  } catch {
    return false;
  }
}

export function buildPublicUrl(key: string): string {
  const base = process.env.FILEBASE_PUBLIC_BASE_URL;
  if (!base) return "";
  return `${base}/${key}`;
}
