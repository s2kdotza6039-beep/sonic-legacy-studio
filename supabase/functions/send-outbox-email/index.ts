import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { requireFounderOrService } from '../_shared/authGuard.ts'
import { sendTemplateEmail } from '../_shared/transactional-email-templates/send-email.ts'

// Sends one Outbox draft to its one recipient. The recipient, subject and body
// are read from the stored draft — never accepted from the caller.

const json = (data: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const denied = await requireFounderOrService(req)
  if (denied) return denied

  let draftId: string
  try {
    const body = await req.json()
    draftId = String(body?.draftId || body?.draft_id || '').trim().slice(0, 60)
  } catch {
    return json({ error: 'Invalid JSON in request body' }, 400)
  }
  if (!draftId) return json({ error: 'draftId is required' }, 400)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: draft, error: draftError } = await supabase
    .from('email_drafts')
    .select('id, recipient_email, recipient_name, subject, body, status')
    .eq('id', draftId)
    .maybeSingle()

  if (draftError) return json({ error: 'Failed to load the draft' }, 500)
  if (!draft) return json({ error: 'Draft not found' }, 404)
  if (!draft.recipient_email || !draft.subject) {
    return json({ error: 'Draft is missing a recipient or subject' }, 400)
  }

  const messageId = `outbox-${draft.id}`
  const now = () => new Date().toISOString()

  const logSend = async (status: string, errorMessage?: string) => {
    const { error } = await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: 'adhoc-message',
      recipient_email: draft.recipient_email,
      status,
      error_message: errorMessage ?? null,
    })
    if (error) {
      console.error('Failed to write email_send_log', {
        code: error.code,
        message: error.message,
      })
    }
  }

  try {
    const result = await sendTemplateEmail('adhoc-message', draft.recipient_email, {
      idempotencyKey: messageId,
      templateData: {
        subject: draft.subject,
        body: draft.body,
        recipientName: draft.recipient_name || undefined,
      },
    })

    if (!result.sent) {
      await logSend('suppressed', 'Recipient is on the do-not-send list')
      const { error } = await supabase
        .from('email_drafts')
        .update({
          status: 'blocked',
          delivery_message_id: messageId,
          delivery_status: 'suppressed',
          delivery_error: 'Recipient is on the do-not-send list',
          delivery_updated_at: now(),
        })
        .eq('id', draft.id)
      if (error) console.error('Failed to update draft', { code: error.code, message: error.message })
      return json({
        success: false,
        status: 'suppressed',
        reason: 'email_suppressed',
        message_id: messageId,
      })
    }

    // The mail service accepted the message. Inbox delivery is confirmed later
    // by delivery events, never claimed here.
    await logSend('sent')
    const { error } = await supabase
      .from('email_drafts')
      .update({
        status: 'queued',
        sent_via: 'system',
        sent_at: null,
        delivery_message_id: messageId,
        delivery_status: 'accepted',
        delivery_error: null,
        delivery_updated_at: now(),
      })
      .eq('id', draft.id)
    if (error) console.error('Failed to update draft', { code: error.code, message: error.message })

    return json({ success: true, status: 'accepted', message_id: messageId })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await logSend('failed', message.slice(0, 1000))
    const { error } = await supabase
      .from('email_drafts')
      .update({
        delivery_message_id: messageId,
        delivery_status: 'failed',
        delivery_error: message.slice(0, 500),
        delivery_updated_at: now(),
      })
      .eq('id', draft.id)
    if (error) console.error('Failed to update draft', { code: error.code, message: error.message })
    console.error('Outbox send failed', { message })
    return json({ success: false, status: 'failed', error: message.slice(0, 300), message_id: messageId }, 502)
  }
})
