import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM = process.env.EMAIL_FROM || 'hello@example.com'

// Tenant names, user names and anything else a user typed are escaped before
// going into an HTML body.
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export interface EmailPayload {
  to: string | string[]
  subject: string
  html: string
  text: string
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  if (!resend) return

  const { error } = await resend.emails.send({
    from: FROM,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
  })

  if (error) throw new Error(error.message)
}

export async function sendInviteEmail(
  to: string,
  opts: { tenantName: string; email: string; password: string; appUrl: string }
): Promise<void> {
  const { tenantName, email, password, appUrl } = opts
  const text = `You've been added to the ${tenantName} team. Log in at ${appUrl} with:\nEmail: ${email}\nTemporary password: ${password}\nPlease log in and change your password.`
  const html = `<p>You've been added to the <strong>${escapeHtml(tenantName)}</strong> team.</p>
<p>Log in at <a href="${escapeHtml(appUrl)}">${escapeHtml(appUrl)}</a> with:</p>
<ul>
  <li>Email: ${escapeHtml(email)}</li>
  <li>Temporary password: ${escapeHtml(password)}</li>
</ul>
<p>Please log in and change your password.</p>`

  await sendEmail({ to, subject: `You've been added to ${tenantName}`, html, text })
}
