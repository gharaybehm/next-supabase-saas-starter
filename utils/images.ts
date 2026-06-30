import sharp from 'sharp';

export async function watermarkImage(
  buffer: Buffer,
  brokerName: string,
  reraCard: string
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const metadata = await sharp(buffer).metadata();
  const originalWidth = metadata.width ?? 1920;
  const originalHeight = metadata.height ?? 1080;

  const finalWidth = Math.min(originalWidth, 1920);
  const scale = finalWidth / originalWidth;
  const finalHeight = Math.round(originalHeight * scale);

  const resized = sharp(buffer).resize({ width: 1920, withoutEnlargement: true });

  const fontSize = Math.max(16, Math.round(finalWidth * 0.022));
  const bannerHeight = Math.round(fontSize * 2.5);
  const padding = 16;
  const text = `${brokerName} · RERA ${reraCard}`;

  const svgBanner = `<svg width="${finalWidth}" height="${bannerHeight}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="${finalWidth}" height="${bannerHeight}" fill="rgba(0,0,0,0.45)"/>
    <text x="${finalWidth - padding}" y="${bannerHeight - padding / 1.5}"
          text-anchor="end" font-family="sans-serif"
          font-size="${fontSize}" fill="white" opacity="0.92">
      ${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}
    </text>
  </svg>`;

  const processed = await resized
    .composite([{ input: Buffer.from(svgBanner), gravity: 'southeast' }])
    .jpeg({ quality: 85 })
    .toBuffer();

  return { buffer: processed, width: finalWidth, height: finalHeight };
}

export function buildImageUrl(storagePath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return '';
  return `${base}/storage/v1/object/public/listing-images/${storagePath}`;
}
