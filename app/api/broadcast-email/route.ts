import { NextRequest, NextResponse } from 'next/server'
import { getCaller, escapeHtml } from '../../lib/serverAuth'

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

  const body = await request.json()
  const subject = String(body.subject || 'إشعار من حمورابي').slice(0, 200)
  const message = String(body.message || '').slice(0, 10000)
  const target = body.target === 'lawyers' || body.target === 'firms' ? body.target : 'all'

  const supabase = caller.supabase

  const emails: string[] = []

  if (target === 'lawyers' || target === 'all') {
    const lawyersResult = await supabase.from('lawyers').select('email').not('email', 'is', null)
    ;(lawyersResult.data || []).forEach(function (l: { email: string }) {
      if (l.email) emails.push(l.email)
    })
  }

  if (target === 'firms' || target === 'all') {
    const firmsResult = await supabase.from('firms').select('email').not('email', 'is', null)
    ;(firmsResult.data || []).forEach(function (f: { email: string }) {
      if (f.email) emails.push(f.email)
    })
  }

  let sentCount = 0

  for (let i = 0; i < emails.length; i++) {
    const sendResult = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + process.env.RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: 'حمورابي <onboarding@resend.dev>',
        to: emails[i],
        subject: subject,
        html: '<div dir="rtl" style="font-family: Tajawal, sans-serif; text-align: right;">' + escapeHtml(message).replace(/\n/g, '<br>') + '</div>',
      }),
    })

    if (sendResult.ok) sentCount = sentCount + 1
  }

  return NextResponse.json({ sentCount: sentCount, totalRecipients: emails.length })
}
