import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";

// Filebase-backed object storage (S3-compatible gateway to IPFS). Filebase
// pins every object to IPFS and returns its content identifier (CID) via
// object metadata — there is no plain path-based public URL, so objects must
// be served through an IPFS gateway keyed by CID, not by `key`/storage_path.
// `key` is still the existing listing_images.storage_path value
// ({tenantId}/{listingId}/{uuid}.jpg) and is what identifies the object for
// upload/delete — the CID is a separate value fetched after upload and
// stored alongside it (listing_images.cid) purely for building the public URL.

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

export async function getObjectCid(key: string): Promise<string | null> {
  try {
    const head = await getClient().send(
      new HeadObjectCommand({ Bucket: getBucket(), Key: key })
    );
    return head.Metadata?.cid ?? null;
  } catch {
    return null;
  }
}

export async function uploadObject(
  key: string,
  body: Buffer,
  contentType: string
): Promise<{ error: string | null; cid: string | null }> {
  try {
    await getClient().send(
      new PutObjectCommand({
        Bucket: getBucket(),
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    );
    const cid = await getObjectCid(key);
    return { error: null, cid };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Upload failed", cid: null };
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

export function buildPublicUrl(cid: string | null | undefined): string {
  if (!cid) return "";
  const gateway = process.env.FILEBASE_GATEWAY_URL || "https://ipfs.filebase.io/ipfs";
  return `${gateway}/${cid}`;
}
