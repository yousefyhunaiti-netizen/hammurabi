import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const text = body.text || ''

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