import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const userMessage = body.message
  const history = body.history || []
  const accountType = body.accountType || 'customer'

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string
  )

  let systemInstruction = ''

  if (accountType === 'lawyer' || accountType === 'firm') {
    systemInstruction = 'أنت مساعد ذكي مخصص للمحامين على منصة حمورابي، وهي منصة تربط المحامين بالعملاء في الأردن. ' +
      'أنت تتحدث إلى محامٍ محترف، وليس عميلاً يبحث عن محامٍ. ساعده في: شرح مفاهيم قانونية، صياغة أو تحسين نصوص قانونية، تلخيص قضايا، التفكير في استراتيجيات قانونية عامة، أو الإجابة عن أسئلة تتعلق باستخدام المنصة نفسها. ' +
      'لا توصِ أبداً بتصفح دليل المحامين أو اقتراح تخصص قانوني معين له، فهو نفسه محامٍ وليس بحاجة لذلك. ' +
      'تحدث معه بأسلوب مهني ومباشر، كزميل يقدم له أداة مساعدة، لا كموجّه لعميل.'
  } else {
    const specialtiesResult = await supabase.from('specialties').select('name_ar')
    const specialtyNames = (specialtiesResult.data || []).map(function (s) { return s.name_ar })
    const specialtiesText = specialtyNames.join('، ')

    systemInstruction = 'أنت مساعد ذكي على منصة حمورابي، وهي منصة تربط الأشخاص بمحامين موثوقين في الأردن. ' +
      'مهمتك مساعدة المستخدم على فهم مشكلته القانونية وتوجيهه إلى التخصص القانوني المناسب من هذه القائمة فقط: ' +
      specialtiesText + '. ' +
      'اطرح أسئلة توضيحية قصيرة إذا احتجت لمعلومات أكثر قبل التوصية. اشرح المصطلحات القانونية البسيطة عند الحاجة بلغة عربية واضحة وبسيطة. ' +
      'إذا بدت المشكلة عاجلة (مثل توقيف أو موعد جلسة قريب)، نبّه المستخدم لذلك بلطف. ' +
      'عندما تكون واثقاً من التخصص المناسب، اذكره بوضوح في جملة تبدأ بـ "التخصص المقترح:" متبوعة باسم التخصص كما هو مكتوب في القائمة تماماً. ' +
      'كن مختصراً ومباشراً ومتعاطفاً في ردودك.'
  }

  const contents = history.map(function (h: { role: string; text: string }) {
    return { role: h.role, parts: [{ text: h.text }] }
  })

  contents.push({ role: 'user', parts: [{ text: userMessage }] })

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
        contents: contents,
      }),
    }
  )

  const geminiData = await geminiResponse.json()

  let replyText = 'عذراً، حدث خطأ. حاول مرة أخرى.'

  if (
    geminiData.candidates &&
    geminiData.candidates[0] &&
    geminiData.candidates[0].content &&
    geminiData.candidates[0].content.parts &&
    geminiData.candidates[0].content.parts[0]
  ) {
    replyText = geminiData.candidates[0].content.parts[0].text
  }

  return NextResponse.json({ reply: replyText })
}