import { NextRequest, NextResponse } from 'next/server'
import { getCaller } from '../../lib/serverAuth'

export async function POST(request: NextRequest) {
  // Only logged-in accounts, within their daily limit, can use the summarizer.
  const caller = await getCaller(request)
  if (!caller) {
    return NextResponse.json({ summary: null, error: 'يرجى تسجيل الدخول أولاً' }, { status: 401 })
  }

  const quotaResult = await caller.supabase.rpc('use_ai_quota')
  const quota = (quotaResult.data || {}) as { allowed?: boolean }
  if (quotaResult.error || !quota.allowed) {
    return NextResponse.json({ summary: null, error: 'لقد وصلت إلى الحد اليومي لاستخدام الذكاء الاصطناعي. يمكنك المتابعة غداً.' }, { status: 429 })
  }

  const body = await request.json()
  const text = String(body.text || '').slice(0, 20000)
  if (!text.trim()) {
    return NextResponse.json({ summary: null, error: 'لا يوجد نص للتلخيص' }, { status: 400 })
  }

  const systemInstruction = 'أنت مساعد قانوني. لخّص النص القانوني التالي في نقاط قصيرة وواضحة بالعربية، مع إبراز أهم النقاط القانونية فقط. كن مختصراً جداً.'

  const geminiResponse = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': process.env.GEMINI_API_KEY as string,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: 'user', parts: [{ text: text }] }],
      }),
    }
  )

  const geminiData = await geminiResponse.json()

  let summaryText = 'تعذر إنشاء ملخص، حاول مرة أخرى.'

  if (
    geminiData.candidates &&
    geminiData.candidates[0] &&
    geminiData.candidates[0].content &&
    geminiData.candidates[0].content.parts &&
    geminiData.candidates[0].content.parts[0]
  ) {
    summaryText = geminiData.candidates[0].content.parts[0].text
  }

  return NextResponse.json({ summary: summaryText })
}