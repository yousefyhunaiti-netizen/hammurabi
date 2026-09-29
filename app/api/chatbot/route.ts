import { NextRequest, NextResponse } from 'next/server'
import { getCaller } from '../../lib/serverAuth'

function plainMessage(text: string, status: number) {
  return new NextResponse(text, {
    status: status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

export async function POST(request: NextRequest) {
  // Only logged-in accounts, within their daily limit, can use the assistant.
  const caller = await getCaller(request)
  if (!caller) {
    return plainMessage('يرجى تسجيل الدخول لاستخدام المساعد الذكي.', 401)
  }

  const quotaResult = await caller.supabase.rpc('use_ai_quota')
  if (quotaResult.error) {
    return plainMessage('عذراً، حدث خطأ أثناء الاتصال بالمساعد الذكي. حاول مرة أخرى.', 500)
  }
  const quota = (quotaResult.data || {}) as { allowed?: boolean; account_type?: string }
  if (!quota.allowed) {
    return plainMessage('لقد وصلت إلى الحد اليومي لاستخدام المساعد الذكي. يمكنك المتابعة غداً.', 429)
  }

  const body = await request.json()
  const userMessage = String(body.message || '').slice(0, 2000)
  if (!userMessage.trim()) {
    return plainMessage('يرجى كتابة سؤالك.', 400)
  }

  // Keep only the recent, well-formed part of the conversation.
  const rawHistory: unknown[] = Array.isArray(body.history) ? body.history.slice(-20) : []
  const history = rawHistory
    .filter(function (h): h is { role: string; text: string } {
      const item = h as { role?: unknown; text?: unknown }
      return !!item && (item.role === 'user' || item.role === 'model') && typeof item.text === 'string'
    })
    .map(function (h) {
      return { role: h.role, text: h.text.slice(0, 4000) }
    })

  // The account type comes from the database, not from the page.
  const accountType = quota.account_type || 'customer'

  let systemInstruction = ''

  if (accountType === 'lawyer' || accountType === 'firm') {
    systemInstruction = 'أنت مساعد ذكي مخصص للمحامين على منصة حمورابي، وهي منصة تربط المحامين بالعملاء في الأردن. ' +
      'أنت تتحدث إلى محامي محترف، وليس عميلاً يبحث عن محامي. قدّم إجابات قانونية دقيقة ومفصّلة وشاملة قدر الإمكان: اذكر الأساس القانوني إن أمكن، الفروقات الدقيقة، والاستثناءات ذات الصلة. ساعده في: شرح مفاهيم قانونية بعمق، صياغة أو تحسين نصوص قانونية، تلخيص قضايا، التفكير في استراتيجيات قانونية، أو الإجابة عن أسئلة تتعلق باستخدام المنصة نفسها. ' +
      'لا توصِ أبداً بتصفح دليل المحامين أو اقتراح اختصاص قانوني معين له، فهو نفسه محامي وليس بحاجة لذلك. ' +
      'إذا كان السؤال غير متعلق بالقانون أو بممارسة المحاماة إطلاقاً، اعتذر بلطف ووضّح أنك مخصص للمواضيع القانونية فقط. ' +
      'أجب دائماً باللغة العربية الفصحى، بغض النظر عن اللغة التي كُتب بها السؤال. ' +
      'تحدث معه بأسلوب مهني ومباشر، كزميل خبير يقدم له إجابة موثوقة، لا كموجّه لعميل.'
  } else {
    const specialtiesText = 'شركات، حقوقي، جزائي، بنوك ومصرفية، شرعي'
    const specialtiesGuide = 'ما يشمله كل اختصاص: ' +
      'شركات: تأسيس الشركات والشراكات والعقود التجارية والعلامات التجارية وإعسار الشركات. ' +
      'حقوقي: النزاعات المدنية كالديون والعقود والإيجارات والعقارات والأراضي والتعويضات وقضايا العمل والعمال. ' +
      'جزائي: الجرائم والتوقيف والشكاوى الجزائية والجرائم الإلكترونية. ' +
      'بنوك ومصرفية: القروض والتسهيلات البنكية والنزاعات مع البنوك وشركات التمويل. ' +
      'شرعي: الزواج والطلاق والنفقة والحضانة والميراث والوصايا، وهي قضايا تنظرها المحاكم الشرعية. ' +
      'الاختصاصات الأربعة الأولى نظامية تنظرها المحاكم النظامية.'
    systemInstruction = 'أنت مساعد ذكي على منصة حمورابي، وهي منصة تربط الأشخاص بمحامين موثوقين في الأردن. ' +
      'مهمتك مساعدة المستخدم على فهم مشكلته القانونية بلغة عربية بسيطة جداً يفهمها أي شخص غير مختص، وتوجيهه إلى الاختصاص القانوني المناسب من هذه القائمة فقط: ' +
      specialtiesText + '. ' + specialtiesGuide + ' ' +      'اجعل إجابتك قصيرة ومباشرة (3 إلى 5 جمل كحد أقصى في العادة) ما لم يكن السؤال يحتاج توضيحاً إضافياً. تجنب التفاصيل القانونية المعقدة أو المصطلحات الفنية إلا عند الضرورة، وفسّرها ببساطة عند استخدامها. ' +
      'اطرح سؤالاً توضيحياً واحداً قصيراً فقط إذا احتجت معلومات أكثر قبل التوصية، وإلا انتقل مباشرة للتوصية. ' +
      'إذا بدت المشكلة عاجلة (مثل توقيف أو موعد جلسة قريب)، نبّه المستخدم لذلك بلطف وبإيجاز. ' +
      'إذا كان السؤال غير متعلق بالقانون إطلاقاً، اعتذر بلطف ووضّح أنك مخصص للمواضيع القانونية فقط، بجملة أو جملتين فقط. ' +
      'أجب دائماً باللغة العربية الفصحى، بغض النظر عن اللغة التي كُتب بها السؤال. ' +
      'عندما تكون واثقاً من الاختصاص المناسب، اختم دائماً بجملة تبدأ بـ "الاختصاص المقترح:" متبوعة باسم الاختصاص كما هو مكتوب في القائمة تماماً. ' +
      'كن مختصراً جداً ومباشراً ومتعاطفاً في كل ردودك.'
  }

  const contents = history.map(function (h: { role: string; text: string }) {
    return { role: h.role, parts: [{ text: h.text }] }
  })

  contents.push({ role: 'user', parts: [{ text: userMessage }] })

  async function callGemini() {
    return fetch(
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
  }

  let geminiResponse = await callGemini()

  if (geminiResponse.status === 503) {
    await new Promise(function (resolve) { setTimeout(resolve, 1000) })
    geminiResponse = await callGemini()
  }

  if (geminiResponse.status === 503) {
    await new Promise(function (resolve) { setTimeout(resolve, 2000) })
    geminiResponse = await callGemini()
  }

  if (geminiResponse.status === 503) {
    await new Promise(function (resolve) { setTimeout(resolve, 4000) })
    geminiResponse = await callGemini()
  }

  if (!geminiResponse.ok || !geminiResponse.body) {
    const errorText = await geminiResponse.text()
    console.error('Gemini API error:', errorText)

    const isOverloaded = geminiResponse.status === 503
    const message = isOverloaded
      ? 'المساعد الذكي مزدحم حالياً بسبب ارتفاع الطلب على النظام. الرجاء المحاولة خلال دقيقة.'
      : 'عذراً، حدث خطأ أثناء الاتصال بالمساعد الذكي. حاول مرة أخرى.'

    return new NextResponse(message, {
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