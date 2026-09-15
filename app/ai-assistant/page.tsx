'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'

type Message = {
  role: string
  text: string
}

export default function AiAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: 'مرحباً! أنا مساعد حمورابي الذكي. أخبرني بمشكلتك القانونية بإيجاز وسأساعدك في العثور على التخصص أو المحامي المناسب.' },
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)

  const [checkingAuth, setCheckingAuth] = useState(true)
  const [loggedIn, setLoggedIn] = useState(false)
  const [infoLink, setInfoLink] = useState('')
  const [isLawyerAccount, setIsLawyerAccount] = useState(false)
  const [isFirmAccount, setIsFirmAccount] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const supabase = createClient()
  const router = useRouter()

  useEffect(function () {
    async function checkAccount() {
      const userResult = await supabase.auth.getUser()
      const user = userResult.data.user

      if (user) {
        setLoggedIn(true)

        const customerResult = await supabase.from('customers').select('id').eq('user_id', user.id).maybeSingle()
        if (customerResult.data) {
          setInfoLink('/my-info')
        } else {
          const lawyerResult = await supabase.from('lawyers').select('id').eq('user_id', user.id).maybeSingle()
          if (lawyerResult.data) {
            setInfoLink('/lawyer-info')
            setIsLawyerAccount(true)
          } else {
            const firmResult = await supabase.from('firms').select('id').eq('user_id', user.id).maybeSingle()
            if (firmResult.data) {
              setInfoLink('/firm-info')
              setIsFirmAccount(true)
            }
          }
        }
      }

      setCheckingAuth(false)

      if (isLawyerAccount || isFirmAccount) {
        setMessages([{ role: 'model', text: 'مرحباً! أنا مساعد حمورابي الذكي. يمكنني مساعدتك في شرح مفاهيم قانونية، صياغة نصوص، أو الإجابة عن أسئلتك حول استخدام المنصة.' }])
      }
    }

    checkAccount()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    setLoggedIn(false)
    setMenuOpen(false)
    router.push('/')
  }

  function toggleMenu() {
    setMenuOpen(!menuOpen)
  }

  function getAccountTypeForApi() {
    if (isLawyerAccount) return 'lawyer'
    if (isFirmAccount) return 'firm'
    return 'customer'
  }

  async function handleSend() {
    if (!input.trim()) return

    const newMessages = messages.concat([{ role: 'user', text: input }])
    setMessages(newMessages)
    setInput('')
    setSending(true)

    const historyForApi = messages.map(function (m) {
      return { role: m.role, text: m.text }
    })

    const response = await fetch('/api/chatbot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: input, history: historyForApi, accountType: getAccountTypeForApi() }),
    })

    const data = await response.json()

    setMessages(newMessages.concat([{ role: 'model', text: data.reply }]))
    setSending(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      handleSend()
    }
  }

  function renderMessage(m: Message, index: number) {
    const isUser = m.role === 'user'
    const hasRecommendation = m.text.indexOf('التخصص المقترح:') !== -1

    return (
      <div key={index} className={"mb-3 flex " + (isUser ? 'justify-start' : 'justify-end')}>
        <div className={"px-4 py-3 rounded-lg max-w-sm font-['Tajawal'] text-sm " + (isUser ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'bg-white border border-[#D8D2C4] text-[#1B1A17]')}>
          <p className="whitespace-pre-wrap">{m.text}</p>
          {hasRecommendation && !isUser && !isLawyerAccount && !isFirmAccount && (
            <a href="/lawyers" className="inline-block mt-2 px-3 py-2 bg-[#AD8A4E] text-white rounded-md text-xs">
              تصفح دليل المحامين
            </a>
          )}
        </div>
      </div>
    )
  }

  return (
    <div dir="rtl" className="min-h-screen pattern-bg flex flex-col">
      <div className="bg-[#1B1A17] text-[#F3EEE4] py-8 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-6 font-['Tajawal'] text-sm">
            <a href="/">
              <img src="/logo.png" alt="حمورابي" className="h-10 w-auto" />
            </a>
            <div className="flex gap-4 items-center">
              {!isLawyerAccount && !isFirmAccount && (
                <a href="/lawyers" className="hover:text-[#AD8A4E] transition">دليل المحامين</a>
              )}
              <a href="/my-appointments" className="hover:text-[#AD8A4E] transition">مواعيدي</a>
              <a href="/my-consultations" className="hover:text-[#AD8A4E] transition">استشاراتي</a>
              {isLawyerAccount && (
                <a href="/lawyer-tools" className="hover:text-[#AD8A4E] transition">أدواتي</a>
              )}
              {isLawyerAccount && (
                <a href="/community" className="hover:text-[#AD8A4E] transition">المجتمع</a>
              )}
              {isLawyerAccount && (
                <a href="/lawyer-messages" className="hover:text-[#AD8A4E] transition">الرسائل</a>
              )}
              {isFirmAccount && (
                <a href="/firm-dashboard" className="hover:text-[#AD8A4E] transition">أدواتي</a>
              )}
              {isFirmAccount && (
                <a href="/community" className="hover:text-[#AD8A4E] transition">المجتمع</a>
              )}
              {isFirmAccount && (
                <a href="/lawyer-messages" className="hover:text-[#AD8A4E] transition">الرسائل</a>
              )}

              {!checkingAuth && !loggedIn && (
                <a href="/login" className="hover:text-[#AD8A4E] transition">تسجيل الدخول</a>
              )}

              {!checkingAuth && loggedIn && (
                <div className="relative">
                  <button onClick={toggleMenu} className="w-7 h-7 rounded-full bg-[#AD8A4E] flex items-center justify-center hover:bg-[#c49b58] transition">
                    <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.5c-3.3 0-9.8 1.6-9.8 4.9v2.4h19.6v-2.4c0-3.3-6.5-4.9-9.8-4.9z" />
                    </svg>
                  </button>
                  {menuOpen && (
                    <div className="absolute left-0 top-full mt-2 w-52 bg-white border border-[#D8D2C4] rounded-md shadow-lg overflow-hidden z-20">
                      {infoLink && (
                        <a href={infoLink} className="block px-4 py-3 font-['Tajawal'] text-sm text-[#1B1A17] hover:bg-[#F3EEE4] transition">
                          معلوماتي الشخصية
                        </a>
                      )}
                      <button onClick={handleLogout} className="w-full text-right px-4 py-3 font-['Tajawal'] text-sm text-[#7A2E2E] hover:bg-[#F3EEE4] transition border-t border-[#D8D2C4]">
                        تسجيل الخروج
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <h1 className="font-['Tajawal'] font-bold text-3xl mb-1">مساعد حمورابي الذكي</h1>
          <p className="font-['Tajawal'] text-sm text-[#D8D2C4]">
            {isLawyerAccount || isFirmAccount ? 'اسأل عن أي أمر قانوني أو استخدام المنصة' : 'اسأل عن مشكلتك القانونية وسنوجهك للمحامي المناسب'}
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto w-full px-6 pt-4">
        <div className="bg-[#F3EEE4] border border-[#D8D2C4] rounded-md p-3 mb-2">
          <p className="font-['Tajawal'] text-xs text-[#4A473F]">
            ⚠️ هذا مساعد يعمل بالذكاء الاصطناعي وليس بديلاً عن استشارة محامٍ مرخص، وقد يخطئ أحياناً.{' '}
            <a href="/terms" target="_blank" className="text-[#AD8A4E] underline">اقرأ المزيد</a>
          </p>
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-6 py-4 flex flex-col">
        <div className="flex-1 mb-4">
          {messages.map(renderMessage)}
          {sending && (
            <div className="flex justify-end mb-3">
              <div className="px-4 py-3 rounded-lg bg-white border border-[#D8D2C4] font-['Tajawal'] text-sm text-[#4A473F]">
                يكتب...
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={function (e) { setInput(e.target.value) }}
            onKeyDown={handleKeyDown}
            placeholder="اكتب رسالتك هنا..."
            className="flex-1 px-4 py-3 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
          />
          <button
            onClick={handleSend}
            disabled={sending}
            className="px-6 py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal'] text-sm hover:bg-[#AD8A4E] transition disabled:opacity-60"
          >
            إرسال
          </button>
        </div>
      </div>
    </div>
  )
}