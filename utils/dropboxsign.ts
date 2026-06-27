import * as DropboxSign from '@dropbox/sign';
import { marked } from 'marked';
import * as fs from 'fs';
import * as path from 'path';

interface AgreementParams {
  userId: string;
  tenantId: string;
  email: string;
  fullName: string;
  reraCardNo: string;
  brokerageName: string;
  tradeLicenseNo?: string;
  listingPct?: number;
  cooperatingPct?: number;
}

function buildAgreementHtml(params: AgreementParams): string {
  const platformName = process.env.PLATFORM_NAME ?? 'Micro MLS';
  const platformAddress = process.env.PLATFORM_ADDRESS ?? '[Platform Address]';
  const platformRep = process.env.PLATFORM_REP ?? '[Platform Representative]';
  const listingPct = params.listingPct ?? 50;
  const cooperatingPct = params.cooperatingPct ?? 50;

  const agreementPath = path.join(process.cwd(), 'legal', 'agreement.md');
  let markdown = fs.readFileSync(agreementPath, 'utf-8');

  // Platform party
  markdown = markdown.replace(/\[Your Company Name\]/g, platformName);
  markdown = markdown.replace(/\[Your Address\]/g, platformAddress);
  markdown = markdown.replace(/\[Your Name\/Title\]/g, platformRep);

  // Broker party — order matters: replace first [Insert Number] (RERA), then second (trade license)
  markdown = markdown.replace('[Broker\'s Full Name]', params.fullName);
  markdown = markdown.replace('[Insert Number]', params.reraCardNo);
  markdown = markdown.replace('[Brokerage Company Name]', params.brokerageName);
  markdown = markdown.replace('[Insert Number]', params.tradeLicenseNo ?? 'N/A');
  markdown = markdown.replace('[Broker\'s Address]', '');

  // Commission split — replace both percentage placeholders
  markdown = markdown.replace(
    /\[Insert Percentage, e\.g\., 50%\]/,
    `${listingPct}%`
  );
  markdown = markdown.replace(
    /\[Insert Percentage, e\.g\., 50%\]/,
    `${cooperatingPct}%`
  );

  // Termination notice period
  markdown = markdown.replace(/\[Insert Number, e\.g\., 15\]/g, '15');

  const body = marked.parse(markdown) as string;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: Georgia, serif; max-width: 800px; margin: 40px auto; padding: 0 24px; line-height: 1.7; color: #1a1a1a; }
  h2 { font-size: 1.1rem; margin-top: 2rem; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  h3 { font-size: 1rem; margin-top: 1.5rem; }
  strong { font-weight: 600; }
  hr { border: none; border-top: 1px solid #ccc; margin: 2rem 0; }
  ul { padding-left: 1.5rem; }
  p { margin: 0.75rem 0; }
</style>
</head>
<body>
<h1 style="text-align:center;font-size:1.3rem;margin-bottom:0.25rem;">MASTER CO-BROKERAGE AGREEMENT</h1>
<p style="text-align:center;color:#555;font-size:0.9rem;">Micro MLS — Dubai Real Estate Broker Community</p>
<hr>
${body}
</body>
</html>`;
}

export async function sendAgreement(params: AgreementParams): Promise<string | null> {
  const apiKey = process.env.DROPBOX_SIGN_API_KEY;

  if (!apiKey) {
    console.warn('DROPBOX_SIGN_API_KEY not set — skipping agreement send.');
    return null;
  }

  const client = new DropboxSign.SignatureRequestApi();
  client.username = apiKey;

  const html = buildAgreementHtml(params);
  const fileBuffer = Buffer.from(html, 'utf-8');

  const signerRole: DropboxSign.SubSignatureRequestSigner = {
    emailAddress: params.email,
    name: params.fullName,
    order: 0,
  };

  const data: DropboxSign.SignatureRequestSendRequest = {
    title: 'Master Co-Brokerage Agreement',
    subject: 'Master Co-Brokerage Agreement — Micro MLS',
    message:
      'Please sign the Master Co-Brokerage Agreement to complete your registration and access the Micro MLS platform.',
    signers: [signerRole],
    files: [fileBuffer],
    fileNames: ['Master_Co-Brokerage_Agreement.html'],
    metadata: {
      user_id: params.userId,
      tenant_id: params.tenantId,
    },
    testMode: process.env.NODE_ENV !== 'production',
  };

  const response = await client.signatureRequestSend(data);
  return response.body.signatureRequest?.signatureRequestId ?? null;
}

export async function resendAgreement(signatureRequestId: string): Promise<void> {
  const apiKey = process.env.DROPBOX_SIGN_API_KEY;
  if (!apiKey) throw new Error('DROPBOX_SIGN_API_KEY not configured.');

  const client = new DropboxSign.SignatureRequestApi();
  client.username = apiKey;
  await client.signatureRequestRemind(signatureRequestId, { emailAddress: '' });
}

export function verifyWebhookEvent(
  payload: string,
  signature: string
): DropboxSign.EventCallbackRequest | null {
  try {
    const secret = process.env.DROPBOX_SIGN_WEBHOOK_SECRET ?? '';
    const parsed = JSON.parse(payload) as DropboxSign.EventCallbackRequest;
    return DropboxSign.EventCallbackHelper.isValid(secret, parsed, signature) ? parsed : null;
  } catch {
    return null;
  }
}
