import { NextRequest, NextResponse } from 'next/server'
import { getCaller, escapeHtml } from '../../lib/serverAuth'

// sending to many recipients takes a while
export const maxDuration = 60

export async function POST(request: NextRequest) {
  // Only a logged-in admin can email every lawyer and firm.
  const caller = await getCaller(request)
  if (!caller) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const adminResult = await caller.supabase.rpc('is_admin')
  if (adminResult.data !== true) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  let body: { subject?: unknown; message?: unknown; target?: unknown } = {}
  try {
    body = await request.json()
  } catch (e) {
    return NextResponse.json({ error: 'bad request' }, { status: 400 })
  }
  const subject = String(body.subject || 'إشعار من حمورابي').slice(0, 200)
  const message = String(body.message || '').slice(0, 10000)
  const target = body.target === 'lawyers' || body.target === 'firms' ? body.target : 'all'

  // Email addresses are private: an admin-only database function returns them.
  const listResult = await caller.supabase.rpc('admin_broadcast_emails', { p_target: target })
  const emails: string[] = Array.from(new Set(((listResult.data as string[]) || []).filter(function (e) { return !!e && e.indexOf('@') > 0 })))

  const html = '<div dir="rtl" style="font-family: Tajawal, sans-serif; text-align: right;">' + escapeHtml(message).replace(/\n/g, '<br>') + '</div>'

  // Resend takes up to 100 emails per request, so 20,000 recipients is 200 requests, not 20,000.
  let sentCount = 0
  for (let i = 0; i < emails.length; i += 100) {
    const chunk = emails.slice(i, i + 100)
    const sendResult = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + process.env.RESEND_API_KEY,
      },
      body: JSON.stringify(chunk.map(function (to) {
        return { from: 'حمورابي <onboarding@resend.dev>', to: [to], subject: subject, html: html }
      })),
    })
    if (sendResult.ok) sentCount = sentCount + chunk.length
    // stay under Resend's limit of a few requests per second
    await new Promise(function (resolve) { setTimeout(resolve, 600) })
  }

  return NextResponse.json({ sentCount: sentCount, totalRecipients: emails.length })
}
