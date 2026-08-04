import { Resend } from 'resend'

export interface InviteEmailParams {
  to: string
  inviteUrl: string
}

function buildInviteEmailHtml(params: InviteEmailParams): string {
  const platformName = process.env.PLATFORM_NAME ?? 'this app'

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="font-family: sans-serif; color: #27272a; max-width: 480px; margin: 0 auto; padding: 24px;">
  <h2 style="margin-bottom: 8px;">You're invited</h2>
  <p>You've been invited to join ${platformName}.</p>
  <p style="margin: 24px 0;">
    <a href="${params.inviteUrl}" style="background: #c2632f; color: #fff; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">
      Accept invitation
    </a>
  </p>
  <p style="color: #71717a; font-size: 13px;">Or copy this link into your browser:<br>${params.inviteUrl}</p>
</body>
</html>`
}

export async function sendInviteEmail(params: InviteEmailParams): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  if (!apiKey || !from) return false

  try {
    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from,
      to: params.to,
      subject: "You've been invited",
      html: buildInviteEmailHtml(params),
    })
    return !error
  } catch {
    return false
  }
}
