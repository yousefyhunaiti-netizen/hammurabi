import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const userMessage = body.message
  const history = body.history || []
  const accountType = body.accountType || 'customer'

  let systemInstruction = ''

  if (accountType === 'lawyer' || accountType === 'firm') {
    systemInstruction = 'أنت مساعد ذكي مخصص للمحامين على منصة حمورابي، وهي منصة تربط المحامين بالعملاء في الأردن. ' +
      'أنت تتحدث إلى محامٍ محترف، وليس عميلاً يبحث عن محامٍ. قدّم إجابات قانونية دقيقة ومفصّلة وشاملة قدر الإمكان: اذكر الأساس القانوني إن أمكن، الفروقات الدقيقة، والاستثناءات ذات الصلة. ساعده في: شرح مفاهيم قانونية بعمق، صياغة أو تحسين نصوص قانونية، تلخيص قضايا، التفكير في استراتيجيات قانونية، أو الإجابة عن أسئلة تتعلق باستخدام المنصة نفسها. ' +
      'لا توصِ أبداً بتصفح دليل المحامين أو اقتراح تخصص قانوني معين له، فهو نفسه محامٍ وليس بحاجة لذلك. ' +
      'إذا كان السؤال غير متعلق بالقانون أو بممارسة المحاماة إطلاقاً، اعتذر بلطف ووضّح أنك مخصص للمواضيع القانونية فقط. ' +
      'أجب دائماً باللغة العربية الفصحى، بغض النظر عن اللغة التي كُتب بها السؤال. ' +
      'تحدث معه بأسلوب مهني ومباشر، كزميل خبير يقدم له إجابة موثوقة، لا كموجّه لعميل.'
  } else {
    const specialtiesText = 'جنائي، تجاري، عمالي، مدني، عقارات، أحوال شخصية'

    systemInstruction = 'أنت مساعد ذكي على منصة حمورابي، وهي منصة تربط الأشخاص بمحامين موثوقين في الأردن. ' +
      'مهمتك مساعدة المستخدم على فهم مشكلته القانونية بلغة عربية بسيطة جداً يفهمها أي شخص غير متخصص، وتوجيهه إلى التخصص القانوني المناسب من هذه القائمة فقط: ' +
      specialtiesText + '. ' +
      'اجعل إجابتك قصيرة ومباشرة (3 إلى 5 جمل كحد أقصى في العادة) ما لم يكن السؤال يحتاج توضيحاً إضافياً. تجنب التفاصيل القانونية المعقدة أو المصطلحات الفنية إلا عند الضرورة، وفسّرها ببساطة عند استخدامها. ' +
      'اطرح سؤالاً توضيحياً واحداً قصيراً فقط إذا احتجت معلومات أكثر قبل التوصية، وإلا انتقل مباشرة للتوصية. ' +
      'إذا بدت المشكلة عاجلة (مثل توقيف أو موعد جلسة قريب)، نبّه المستخدم لذلك بلطف وبإيجاز. ' +
      'إذا كان السؤال غير متعلق بالقانون إطلاقاً، اعتذر بلطف ووضّح أنك مخصص للمواضيع القانونية فقط، بجملة أو جملتين فقط. ' +
      'أجب دائماً باللغة العربية الفصحى، بغض النظر عن اللغة التي كُتب بها السؤال. ' +
      'عندما تكون واثقاً من التخصص المناسب، اختم دائماً بجملة تبدأ بـ "التخصص المقترح:" متبوعة باسم التخصص كما هو مكتوب في القائمة تماماً. ' +
      'كن مختصراً جداً ومباشراً ومتعاطفاً في كل ردودك.'
  }

  const contents = history.map(function (h: { role: string; text: string }) {
    return { role: h.role, parts: [{ text: h.text }] }
  })

  contents.push({ role: 'user', parts: [{ text: userMessage }] })

  const geminiResponse = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:streamGenerateContent?alt=sse',
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

  if (!geminiResponse.ok || !geminiResponse.body) {
    const errorText = await geminiResponse.text()
    console.error('Gemini API error:', errorText)
    return new NextResponse('عذراً، حدث خطأ أثناء الاتصال بالمساعد الذكي. حاول مرة أخرى.', {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  const stream = new ReadableStream({
    async start(controller) {
      const reader = geminiResponse.body!.getReader()
      let buffer = ''

      while (true) {
        const result = await reader.read()
        if (result.done) break

        buffer = buffer + decoder.decode(result.value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const jsonStr = line.slice(6).trim()
          if (!jsonStr) continue

          try {
            const parsed = JSON.parse(jsonStr)
            const textPiece = parsed?.candidates?.[0]?.content?.parts?.[0]?.text
            if (textPiece) {
              controller.enqueue(encoder.encode(textPiece))
            }
          } catch (e) {
            // ignore malformed partial chunk
          }
        }
      }

      controller.close()
    },
  })

  return new NextResponse(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}