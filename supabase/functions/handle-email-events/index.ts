import { createEmailWebhookHandler } from 'npm:@lovable.dev/email-js@0.1.0'
import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

type Reason = 'bounce' | 'complaint' | 'unsubscribe'

const LOG_STATUS: Record<Reason, 'bounced' | 'complained' | 'suppressed'> = {
  bounce: 'bounced',
  complaint: 'complained',
  unsubscribe: 'suppressed',
}

const LOG_MESSAGE: Record<Reason, string> = {
  bounce: 'Permanent bounce — email address is invalid or rejected',
  complaint: 'Spam complaint — recipient marked email as spam',
  unsubscribe: 'Recipient unsubscribed',
}

// Notification-only bookkeeping. Lovable enforces suppression at send time;
// these rows exist so the Founder's dashboards keep their history.
async function record(reason: Reason, event: any) {
  const recipient: string | undefined = event?.data?.recipient
  if (!recipient) {
    console.warn('Email event without recipient', { event_id: event?.event_id })
    return
  }
  const email = recipient.toLowerCase()

  const { error: suppressError } = await supabase
    .from('suppressed_emails')
    .upsert({ email, reason, metadata: null }, { onConflict: 'email' })
  if (suppressError) {
    console.error('Failed to upsert suppressed email', {
      event_id: event?.event_id,
      code: suppressError.code,
      message: suppressError.message,
    })
    throw new Error('suppression_write_failed')
  }

  const { error: logError } = await supabase.from('email_send_log').insert({
    message_id: event?.data?.message_id ?? null,
    template_name: 'system',
    recipient_email: email,
    status: LOG_STATUS[reason],
    error_message: LOG_MESSAGE[reason],
    metadata: null,
  })
  if (logError) {
    console.error('Failed to insert email_send_log', {
      event_id: event?.event_id,
      code: logError.code,
      message: logError.message,
    })
    throw new Error('send_log_write_failed')
  }
}

const handler = createEmailWebhookHandler({
  apiKey: Deno.env.get('LOVABLE_API_KEY')!,
  on: {
    'email.bounced': async (event) => {
      await record('bounce', event)
    },
    'email.complaint': async (event) => {
      await record('complaint', event)
    },
    'email.unsubscribed': async (event) => {
      await record('unsubscribe', event)
    },
  },
})

Deno.serve((req) => handler(req))
