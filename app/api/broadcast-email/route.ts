import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const subject = body.subject || 'إشعار من حمورابي'
  const message = body.message || ''
  const target = body.target || 'all'

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string
  )

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
        html: '<div dir="rtl" style="font-family: Tajawal, sans-serif; text-align: right;">' + message.replace(/\n/g, '<br>') + '</div>',
      }),
    })

    if (sendResult.ok) sentCount = sentCount + 1
  }

  return NextResponse.json({ sentCount: sentCount, totalRecipients: emails.length })
}