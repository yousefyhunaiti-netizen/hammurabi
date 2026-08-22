import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string
)

export async function POST(request: NextRequest) {
  const payload = await request.json()

  const eventType = payload.type
  const record = payload.record
  const oldRecord = payload.old_record

  if (eventType === 'INSERT') {
    const lawyerResult = await supabase
      .from('lawyers')
      .select('email, full_name')
      .eq('id', record.lawyer_id)
      .single()

    if (lawyerResult.data && lawyerResult.data.email) {
      await resend.emails.send({
        from: 'Hammurabi <onboarding@resend.dev>',
        to: lawyerResult.data.email,
        subject: 'سؤال استشارة جديد على حمورابي',
        html: '<div dir="rtl" style="font-family: sans-serif;"><p>لديك سؤال استشارة جديد بانتظار الرد.</p><p>السؤال: ' + record.question + '</p></div>',
      })
    }
  }

  if (eventType === 'UPDATE' && record.status === 'answered' && oldRecord.status !== 'answered') {
    const customerResult = await supabase
      .from('customers')
      .select('email, full_name')
      .eq('user_id', record.customer_id)
      .single()

    if (customerResult.data && customerResult.data.email) {
      await resend.emails.send({
        from: 'Hammurabi <onboarding@resend.dev>',
        to: customerResult.data.email,
        subject: 'تم الرد على استشارتك في حمورابي',
        html: '<div dir="rtl" style="font-family: sans-serif;"><p>قام المحامي بالرد على استشارتك.</p><p>يمكنك عرض الإجابة بعد إتمام الدفع من صفحة استشاراتي على حمورابي.</p></div>',
      })
    }
  }

  return NextResponse.json({ success: true })
}