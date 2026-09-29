import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string
)

// Called only by the database when a consultation is sent or answered.
// Every call carries a secret key that only the database knows; calls
// without it are refused, so nobody else can send emails through this route.
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
  const eventType = payload.type

  // The question itself is never put in an email: the lawyer reads it on the site.
  if (eventType === 'INSERT' && payload.lawyer_email) {
    await resend.emails.send({
      from: 'Hammurabi <onboarding@resend.dev>',
      to: payload.lawyer_email,
      subject: 'سؤال استشارة جديد على حمورابي',
      html: '<div dir="rtl" style="font-family: sans-serif;"><p>لديك سؤال استشارة جديد بانتظار الرد.</p><p>سجّل الدخول إلى حمورابي لقراءته والرد عليه من صفحة المواعيد والاستشارات.</p></div>',
    })
  }

  if (eventType === 'UPDATE' && payload.customer_email) {
    await resend.emails.send({
      from: 'Hammurabi <onboarding@resend.dev>',
      to: payload.customer_email,
      subject: 'تم الرد على استشارتك في حمورابي',
      html: '<div dir="rtl" style="font-family: sans-serif;"><p>قام المحامي بالرد على استشارتك.</p><p>يمكنك عرض الإجابة بعد إتمام الدفع من صفحة استشاراتي على حمورابي.</p></div>',
    })
  }

  return NextResponse.json({ success: true })
}
