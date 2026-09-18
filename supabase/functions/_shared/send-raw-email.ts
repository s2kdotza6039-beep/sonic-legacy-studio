import { EmailAPIError, sendLovableEmail } from 'npm:@lovable.dev/email-js@0.1.0'

// Server-only direct send for emails whose HTML is composed at send time
// (security alerts, scheduled exports). Templated emails must use
// ./transactional-email-templates/send-email.ts instead.

const SITE_NAME = 'Culture Collective'
const SENDER_DOMAIN = 'notify.s2kdotza.com'
const FROM_DOMAIN = 's2kdotza.com'

export type SendRawEmailResult =
  | { sent: true }
  | { sent: false; reason: 'recipient_suppressed' }

function stripHtml(html: string): string {
  return html
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/\s*(p|div|h1|h2|h3|li|tr)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function sendRawEmail(opts: {
  to: string
  subject: string
  html: string
  text?: string
  label: string
  idempotencyKey?: string
}): Promise<SendRawEmailResult> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY')
  if (!apiKey) throw new Error('LOVABLE_API_KEY is not configured')

  try {
    await sendLovableEmail(
      {
        to: opts.to,
        from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject: opts.subject,
        html: opts.html,
        text: opts.text ?? stripHtml(opts.html),
        purpose: 'transactional',
        label: opts.label,
        idempotency_key: opts.idempotencyKey || crypto.randomUUID(),
      },
      { apiKey, sendUrl: Deno.env.get('LOVABLE_SEND_URL') }
    )
  } catch (error) {
    if (error instanceof EmailAPIError && error.code === 'recipient_suppressed') {
      return { sent: false, reason: 'recipient_suppressed' }
    }
    throw error
  }

  return { sent: true }
}
