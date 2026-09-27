'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'
import ReactMarkdown from 'react-markdown'
import Footer from '../components/Footer'

type Message = {
  role: string
  text: string
}

export default function AiAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: 'مرحباً! أنا مساعد حمورابي الذكي. كيف يمكنني مساعدتك اليوم؟' },
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [slowWait, setSlowWait] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [loggedIn, setLoggedIn] = useState(false)
  const [infoLink, setInfoLink] = useState('')
  const [isLawyerAccount, setIsLawyerAccount] = useState(false)
  const [isFirmAccount, setIsFirmAccount] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [totalUnread, setTotalUnread] = useState(0)
  const [pendingConsultations, setPendingConsultations] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)

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

            const unreadResult = await supabase.from('lawyer_messages').select('sender_lawyer_id, sender_firm_id').eq('recipient_lawyer_id', lawyerResult.data.id).eq('is_read', false)
            const uniqueSenders = new Set((unreadResult.data || []).map(function (m) {
              return m.sender_lawyer_id ? 'lawyer-' + m.sender_lawyer_id : 'firm-' + m.sender_firm_id
            }))
            setTotalUnread(uniqueSenders.size)

            const pendingResult = await supabase.from('consultations').select('id', { count: 'exact', head: true }).eq('lawyer_id', lawyerResult.data.id).eq('status', 'pending')
            setPendingConsultations(pendingResult.count || 0)
          } else {
            const firmResult = await supabase.from('firms').select('id').eq('user_id', user.id).maybeSingle()
            if (firmResult.data) {
              setInfoLink('/firm-info')
              setIsFirmAccount(true)

              const firmUnreadResult = await supabase.from('lawyer_messages').select('sender_lawyer_id, sender_firm_id').eq('recipient_firm_id', firmResult.data.id).eq('is_read', false)
              const firmUniqueSenders = new Set((firmUnreadResult.data || []).map(function (m) {
                return m.sender_lawyer_id ? 'lawyer-' + m.sender_lawyer_id : 'firm-' + m.sender_firm_id
              }))
              setTotalUnread(firmUniqueSenders.size)

              const rosterResult = await supabase.from('lawyers').select('id').eq('firm_id', firmResult.data.id)
              const rosterIds = (rosterResult.data || []).map(function (l) { return l.id })
              let firmPendingResult
              if (rosterIds.length > 0) {
                firmPendingResult = await supabase.from('consultations').select('id', { count: 'exact', head: true }).or('firm_id.eq.' + firmResult.data.id + ',lawyer_id.in.(' + rosterIds.join(',') + ')').eq('status', 'pending')
              } else {
                firmPendingResult = await supabase.from('consultations').select('id', { count: 'exact', head: true }).eq('firm_id', firmResult.data.id).eq('status', 'pending')
              }
              setPendingConsultations(firmPendingResult.count || 0)
            }
          }
        }
      }

      setCheckingAuth(false)
    }

    checkAccount()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    setLoggedIn(false)
    setMenuOpen(false)
  }

  function toggleMenu() {
    setMenuOpen(!menuOpen)
  }

  useEffect(function () {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return function () {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  function getAccountTypeForApi() {
    if (isLawyerAccount) return 'lawyer'
    if (isFirmAccount) return 'firm'
    return 'customer'
  }

  function getFooterVariant(): 'customer' | 'lawyer' | 'firm' {
    if (isLawyerAccount) return 'lawyer'
    if (isFirmAccount) return 'firm'
    return 'customer'
  }

  async function handleSend() {
    if (!input.trim()) return

    const newMessages = messages.concat([{ role: 'user', text: input }])
    setMessages(newMessages.concat([{ role: 'model', text: '' }]))
    setInput('')
    setSending(true)
    setSlowWait(false)

    const slowTimer = setTimeout(function () {
      setSlowWait(true)
    }, 5000)

    const historyForApi = messages.map(function (m) {
      return { role: m.role, text: m.text }
    })

    const response = await fetch('/api/chatbot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: input, history: historyForApi, accountType: getAccountTypeForApi() }),
    })

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    if (!reader) {
      setSending(false)
      return
    }

    let accumulatedText = ''

    while (true) {
      const result = await reader.read()
      if (result.done) break

      accumulatedText = accumulatedText + decoder.decode(result.value, { stream: true })

      setMessages(newMessages.concat([{ role: 'model', text: accumulatedText }]))
    }

    clearTimeout(slowTimer)
    setSlowWait(false)
    setSending(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      handleSend()
    }
  }

  function renderMessage(m: Message, index: number) {
    const isUser = m.role === 'user'
    const hasRecommendation = m.text.indexOf('الاختصاص المقترح:') !== -1

    return (
      <div key={index} className={"mb-3 flex " + (isUser ? 'justify-start' : 'justify-end')}>
        <div className={"px-4 py-3 rounded-lg max-w-sm font-['Tajawal'] text-sm " + (isUser ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'bg-white border border-[#D8D2C4] text-[#1B1A17]')}>
          <div className="prose-sm [&_p]:mb-2 [&_ul]:list-disc [&_ul]:mr-4 [&_ol]:list-decimal [&_ol]:mr-4 [&_strong]:font-bold [&_h3]:font-bold [&_h3]:text-base [&_h3]:mb-1">
            <ReactMarkdown>{m.text}</ReactMarkdown>
          </div>
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
      <div className="bg-[#1B1A17] text-[#F3EEE4] py-12 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-8 font-['Tajawal'] text-sm">
            <a href="/">
              <img src="/logo.png" alt="حمورابي" className="h-12 w-auto" />
            </a>
            <div className="flex gap-5 items-center">
              {!isLawyerAccount && !isFirmAccount && (
                <>
                  <a href="/my-appointments" className="hover:text-[#AD8A4E] transition">مواعيدي</a>
                  <a href="/my-consultations" className="hover:text-[#AD8A4E] transition">استشاراتي</a>
                  <a href="/lawyers" className="hover:text-[#AD8A4E] transition">دليل المحامين</a>
                  <a href="/ai-assistant" className="text-[#AD8A4E] transition">مساعد ذكي</a>
                  <a href="/legal-articles" className="hover:text-[#AD8A4E] transition">مقالات قانونية</a>
                </>
              )}
              {isFirmAccount && (
                <a href="/firm-dashboard" className="hover:text-[#AD8A4E] transition">لوحة التحكم</a>
              )}
              {isLawyerAccount && (
                <a href="/lawyer-tools" className="hover:text-[#AD8A4E] transition">أدواتي</a>
              )}
              {isFirmAccount && (
                <a href="/lawyer-tools" className="hover:text-[#AD8A4E] transition">أدواتي</a>
              )}
              {(isLawyerAccount || isFirmAccount) && (
                <a href="/ai-assistant" className="text-[#AD8A4E] transition">مساعد ذكي</a>
              )}
              {(isLawyerAccount || isFirmAccount) && (
                <a href="/community" className="hover:text-[#AD8A4E] transition">المجتمع</a>
              )}
              {(isLawyerAccount || isFirmAccount) && (
                <a href="/lawyer-messages" className="relative hover:text-[#AD8A4E] transition">
                  <svg className="w-5 h-5 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                  </svg>
                  {totalUnread > 0 && (
                    <span className="absolute -top-2 -left-2 bg-[#7A2E2E] text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{totalUnread}</span>
                  )}
                </a>
              )}

              {!checkingAuth && !loggedIn && (
                <a href="/login" className="hover:text-[#AD8A4E] transition">تسجيل الدخول</a>
              )}

              {!checkingAuth && loggedIn && (
                <div className="relative" ref={menuRef}>
                <button onClick={toggleMenu} className="relative w-8 h-8 rounded-full bg-[#AD8A4E] flex items-center justify-center hover:bg-[#c49b58] transition">
                                      <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.5c-3.3 0-9.8 1.6-9.8 4.9v2.4h19.6v-2.4c0-3.3-6.5-4.9-9.8-4.9z" />
                    </svg>
                    {(isLawyerAccount || isFirmAccount) && pendingConsultations > 0 && (
                      <span className="absolute -top-1 -left-1 bg-[#7A2E2E] text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{pendingConsultations}</span>
                    )}
                  </button>
                  {menuOpen && (
                    <div className="absolute left-0 top-full mt-2 w-52 bg-white border border-[#D8D2C4] rounded-md shadow-lg overflow-hidden z-20">
                      {(isLawyerAccount || isFirmAccount) && (
                        <a href="/subscription" className="block px-4 py-3 font-['Tajawal'] text-sm text-[#1B1A17] hover:bg-[#F3EEE4] transition">
                          ترقية الاشتراك
                        </a>
                      )}
                      {infoLink && (
                        <a href={infoLink} className={"block px-4 py-3 font-['Tajawal'] text-sm text-[#1B1A17] hover:bg-[#F3EEE4] transition " + ((isLawyerAccount || isFirmAccount) ? 'border-t border-[#D8D2C4]' : '')}>
                          معلوماتي الشخصية
                        </a>
                      )}
                      {(isLawyerAccount || isFirmAccount) && (
                        <a href="/lawyer-history" className="relative block px-4 py-3 font-['Tajawal'] text-sm text-[#1B1A17] hover:bg-[#F3EEE4] transition border-t border-[#D8D2C4]">
                          المواعيد والاستشارات
                          {pendingConsultations > 0 && (
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 bg-[#7A2E2E] text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{pendingConsultations}</span>
                          )}
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

          <h1 className="font-['Tajawal'] font-bold text-4xl mb-1">مساعد حمورابي الذكي</h1>
          <p className="font-['Tajawal'] text-sm text-[#D8D2C4]">
            {isLawyerAccount || isFirmAccount ? 'اسأل عن أي أمر قانوني أو استخدام المنصة' : 'اسأل عن مشكلتك القانونية وسنوجهك للمحامي المناسب'}
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto w-full px-6 pt-4">
        <div className="bg-[#F3EEE4] border border-[#D8D2C4] rounded-md p-3 mb-2">
          <p className="font-['Tajawal'] text-xs text-[#4A473F]">
            ⚠️ هذا مساعد يعمل بالذكاء الاصطناعي وليس بديلاً عن استشارة محامي مرخص، وقد يخطئ أحياناً.{' '}
            <a href="/terms" target="_blank" className="text-[#AD8A4E] underline">اقرأ المزيد</a>
          </p>
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-6 py-4 flex flex-col">
        <div className="flex-1 mb-4">
          {messages.map(renderMessage)}
          {sending && messages[messages.length - 1] && messages[messages.length - 1].text === '' && (
            <div className="flex justify-end mb-3">
              <div className="px-4 py-3 rounded-lg bg-white border border-[#D8D2C4] flex flex-col gap-1.5">
                <div className="flex gap-1.5 items-center">
                  <span className="w-2 h-2 rounded-full bg-[#AD8A4E] animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-2 h-2 rounded-full bg-[#AD8A4E] animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-2 h-2 rounded-full bg-[#AD8A4E] animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
                {slowWait && (
                  <p className="font-['Tajawal'] text-xs text-[#4A473F]">لا يزال يعمل على إجابتك، شكراً لصبرك...</p>
                )}
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

      <Footer variant={getFooterVariant()} />
    </div>
  )
}