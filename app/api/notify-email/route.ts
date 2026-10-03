import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { escapeHtml } from '../../lib/serverAuth'

const resend = new Resend(process.env.RESEND_API_KEY)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string
)

// Called only by the database (review notifications, "account approved",
// "sorry to see you go"). Every call carries the secret key only the
// database knows; calls without it are refused, so nobody else can use
// this route to send emails.
export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-webhook-secret') || ''
  if (!secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const checkResult = await supabase.rpc('webhook_secret_ok', { p_secret: secret })
  if (checkResult.data !== true) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const payload = await request.json()
  const to = String(payload.to || '').trim()
  const subject = String(payload.subject || 'رسالة من حمورابي').slice(0, 200)
  const message = String(payload.message || '').slice(0, 5000)

  if (!to || to.indexOf('@') === -1) {
    return NextResponse.json({ error: 'missing recipient' }, { status: 400 })
  }

  // Links in the message become clickable; everything else is plain text.
  const body = escapeHtml(message)
    .replace(/(https:\/\/[^\s<]+)/g, '<a href="$1" style="color: #AD8A4E;">$1</a>')
    .replace(/\n/g, '<br>')

  await resend.emails.send({
    from: 'Hammurabi <onboarding@resend.dev>',
    to: to,
    subject: subject,
    html: '<div dir="rtl" style="font-family: Tajawal, sans-serif; text-align: right; line-height: 1.8; color: #1B1A17;">' + body + '<p style="color: #8A8474; font-size: 12px; margin-top: 24px;">حمورابي</p></div>',
  })

  return NextResponse.json({ success: true })
}
