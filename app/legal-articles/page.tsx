'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'
import { getLawyerBadgeCount, getFirmBadgeCount } from '../lib/badges'
import Footer from '../components/Footer'

type Article = {
  id: number
  lawyer_id: number | null
  firm_id: number | null
  specialty_id: number | null
  title: string
  body: string
  created_at: string
}

type LawyerName = {
  id: number
  full_name: string
}

type FirmName = {
  id: number
  firm_name: string
}

export default function LegalArticlesPage() {
  const [loading, setLoading] = useState(true)
  const [accountType, setAccountType] = useState<'customer' | 'lawyer' | 'firm' | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [loggedIn, setLoggedIn] = useState(false)
  const [infoLink, setInfoLink] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [totalUnread, setTotalUnread] = useState(0)
  const [pendingConsultations, setPendingConsultations] = useState(0)

  const [articles, setArticles] = useState<Article[]>([])
  const [lawyerNames, setLawyerNames] = useState<LawyerName[]>([])
  const [firmNames, setFirmNames] = useState<FirmName[]>([])
  const [search, setSearch] = useState('')

  const supabase = createClient()
  const router = useRouter()
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(function () {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return function () {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  function countConversations(rows: any[]) {
    const senders = new Set(rows.map(function (m) {
      return m.sender_lawyer_id ? 'lawyer-' + m.sender_lawyer_id : 'firm-' + m.sender_firm_id
    }))
    return senders.size
  }

  function readingTime(text: string) {
    const words = text.trim().split(/\s+/).length
    const minutes = Math.max(1, Math.round(words / 150))
    return minutes + ' دقيقة قراءة'
  }

  async function loadArticles() {
    const result = await supabase.from('legal_articles').select('*').order('created_at', { ascending: false })
    const data: Article[] = result.data || []
    setArticles(data)

    const lawyerIds = Array.from(new Set(data.map(function (a) { return a.lawyer_id }).filter(function (id): id is number { return id !== null })))
    if (lawyerIds.length > 0) {
      const namesResult = await supabase.from('lawyers').select('id, full_name').in('id', lawyerIds)
      setLawyerNames(namesResult.data || [])
    }

    const firmIds = Array.from(new Set(data.map(function (a) { return a.firm_id }).filter(function (id): id is number { return id !== null })))
    if (firmIds.length > 0) {
      const firmsResult = await supabase.from('firms').select('id, firm_name').in('id', firmIds)
      setFirmNames(firmsResult.data || [])
    }
  }

  useEffect(function () {
    async function loadData() {
      const userResult = await supabase.auth.getUser()

      if (userResult.data.user) {
        setLoggedIn(true)
        const user = userResult.data.user

        const customerResult = await supabase.from('customers').select('id').eq('user_id', user.id).maybeSingle()
        if (customerResult.data) {
          setAccountType('customer')
          setInfoLink('/my-info')
        } else {
          const lawyerResult = await supabase.from('lawyers').select('id').eq('user_id', user.id).maybeSingle()
          if (lawyerResult.data) {
            setAccountType('lawyer')
            setInfoLink('/lawyer-info')

            const unreadResult = await supabase.from('lawyer_messages').select('sender_lawyer_id, sender_firm_id').eq('recipient_lawyer_id', lawyerResult.data.id).eq('is_read', false)
            setTotalUnread(countConversations(unreadResult.data || []))

            setPendingConsultations(await getLawyerBadgeCount(supabase, lawyerResult.data.id))
          } else {
            const firmResult = await supabase.from('firms').select('id').eq('user_id', user.id).maybeSingle()
            if (firmResult.data) {
              setAccountType('firm')
              setInfoLink('/firm-info')

              const firmUnreadResult = await supabase.from('lawyer_messages').select('sender_lawyer_id, sender_firm_id').eq('recipient_firm_id', firmResult.data.id).eq('is_read', false)
              setTotalUnread(countConversations(firmUnreadResult.data || []))

              setPendingConsultations(await getFirmBadgeCount(supabase, firmResult.data.id))
            }
          }
        }
      }

      setCheckingAuth(false)

      await loadArticles()
      setLoading(false)
    }

    loadData()
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

  function getLawyerName(id: number | null) {
    if (!id) return ''
    const found = lawyerNames.find(function (l) { return l.id === id })
    return found ? found.full_name : ''
  }

  function getFirmName(id: number | null) {
    if (!id) return ''
    const found = firmNames.find(function (f) { return f.id === id })
    return found ? found.firm_name : ''
  }

  function getAuthorLabel(a: Article) {
    if (a.firm_id) return getFirmName(a.firm_id)
    return getLawyerName(a.lawyer_id)
  }

  function getAuthorLink(a: Article) {
    if (a.firm_id) return '/firms/' + a.firm_id
    return '/lawyers/' + a.lawyer_id
  }

  const filteredArticles = articles.filter(function (a) {
    if (!search.trim()) return true
    const lower = search.toLowerCase()
    return a.title.toLowerCase().indexOf(lower) !== -1 || a.body.toLowerCase().indexOf(lower) !== -1 || getAuthorLabel(a).toLowerCase().indexOf(lower) !== -1
  })

  function renderArticle(article: Article) {
    const isFirm = !!article.firm_id
    const authorName = getAuthorLabel(article)

    return (
      <div key={article.id} className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-4 hover:shadow-lg transition">
        <div className="flex items-center gap-3 mb-3">
          <div className={"w-10 h-10 rounded-full flex items-center justify-center font-['Tajawal'] font-bold text-lg flex-shrink-0 " + (isFirm ? 'bg-[#AD8A4E] text-white' : 'bg-[#1B1A17] text-[#AD8A4E]')}>
            {authorName.charAt(0)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <a href={getAuthorLink(article)} className="font-['Tajawal'] font-medium text-sm text-[#1B1A17] hover:text-[#AD8A4E] truncate">{authorName}</a>
              {isFirm && <span className="font-['Tajawal'] text-[10px] px-1.5 py-0.5 rounded bg-[#F0E6D2] text-[#AD8A4E] flex-shrink-0">مكتب</span>}
            </div>
            <p className="font-['Tajawal'] text-xs text-[#4A473F]">{readingTime(article.body)}</p>
          </div>
        </div>
        <h3 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mb-2">{article.title}</h3>
        <p className="font-['Tajawal'] text-sm text-[#4A473F] whitespace-pre-wrap line-clamp-4">{article.body}</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div dir="rtl" className="min-h-screen pattern-bg flex items-center justify-center">
        <p className="font-['Tajawal'] text-[#4A473F]">جاري التحميل...</p>
      </div>
    )
  }

  const isLawyerOrFirm = accountType === 'lawyer' || accountType === 'firm'

  return (
    <div dir="rtl" className="min-h-screen pattern-bg flex flex-col">
      <div className="bg-[#1B1A17] text-[#F3EEE4] py-12 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex justify-between items-center mb-8 font-['Tajawal'] text-sm">
            <a href="/"><img src="/logo.png" alt="حمورابي" className="h-12 w-auto" /></a>
            <div className="flex gap-5 items-center">
              {accountType === 'firm' && (
                <a href="/firm-dashboard" className="hover:text-[#AD8A4E] transition">لوحة التحكم</a>
              )}

              {!isLawyerOrFirm && (
                <>
                  <a href="/my-appointments" className="hover:text-[#AD8A4E] transition">مواعيدي</a>
                  <a href="/my-consultations" className="hover:text-[#AD8A4E] transition">استشاراتي</a>
                  <a href="/lawyers" className="hover:text-[#AD8A4E] transition">دليل المحامين</a>
                </>
              )}

              {isLawyerOrFirm && (
                <a href="/lawyer-tools" className="hover:text-[#AD8A4E] transition">أدواتي</a>
              )}

              <a href="/ai-assistant" className="hover:text-[#AD8A4E] transition">مساعد ذكي</a>

              {isLawyerOrFirm && (
                <a href="/community" className="hover:text-[#AD8A4E] transition">المجتمع</a>
              )}

              <a href="/legal-articles" className="text-[#AD8A4E]">مقالات قانونية</a>

              {isLawyerOrFirm && (
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
                    <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.5c-3.3 0-9.8 1.6-9.8 4.9v2.4h19.6v-2.4c0-3.3-6.5-4.9-9.8-4.9z" /></svg>
                    {isLawyerOrFirm && pendingConsultations > 0 && (
                      <span className="absolute -top-1 -left-1 bg-[#7A2E2E] text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{pendingConsultations}</span>
                    )}
                  </button>
                  {menuOpen && (
                    <div className="absolute left-0 top-full mt-2 w-52 bg-white border border-[#D8D2C4] rounded-md shadow-lg overflow-hidden z-20">
                      {isLawyerOrFirm && (
                        <a href="/subscription" className="block px-4 py-3 font-['Tajawal'] text-sm text-[#1B1A17] hover:bg-[#F3EEE4] transition">ترقية الاشتراك</a>
                      )}
                      {infoLink && (
                        <a href={infoLink} className={"block px-4 py-3 font-['Tajawal'] text-sm text-[#1B1A17] hover:bg-[#F3EEE4] transition " + (isLawyerOrFirm ? 'border-t border-[#D8D2C4]' : '')}>معلوماتي الشخصية</a>
                      )}
                      {isLawyerOrFirm && (
                        <a href="/lawyer-history" className="relative block px-4 py-3 font-['Tajawal'] text-sm text-[#1B1A17] hover:bg-[#F3EEE4] transition border-t border-[#D8D2C4]">
                          المواعيد والاستشارات
                          {pendingConsultations > 0 && (
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 bg-[#7A2E2E] text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{pendingConsultations}</span>
                          )}
                        </a>
                      )}
                      <button onClick={handleLogout} className={"w-full text-right px-4 py-3 font-['Tajawal'] text-sm text-[#7A2E2E] hover:bg-[#F3EEE4] transition " + (infoLink || isLawyerOrFirm ? 'border-t border-[#D8D2C4]' : '')}>تسجيل الخروج</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <h1 className="font-['Tajawal'] font-bold text-4xl mb-2">مقالات قانونية</h1>
          <p className="font-['Tajawal'] text-sm text-[#D8D2C4]">محتوى موثوق كتبه محامون مرخصون، لتزيد معرفتك القانونية</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 flex-1 w-full">
        <div className="bg-[#F3EEE4] border border-[#D8D2C4] rounded-md px-4 py-3 mb-6">
          <p className="font-['Tajawal'] text-xs text-[#4A473F] leading-relaxed">
            هذه المقالات كتبها محامون ومكاتب محاماة موثقون على حمورابي، إلا أن حمورابي لا تتحمل مسؤولية أي معلومة غير دقيقة قد ترد فيها. لا تُعد هذه المقالات استشارة قانونية، ولأي حالة خاصة يرجى التواصل مباشرة مع محامي.
          </p>
        </div>

        <input
          type="text"
          value={search}
          onChange={function (e) { setSearch(e.target.value) }}
          placeholder="ابحث في المقالات..."
          className="w-full px-4 py-2.5 mb-6 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
        />

        <p className="font-['Tajawal'] text-xs text-[#4A473F] mb-4">{filteredArticles.length} من {articles.length} مقال</p>

        {filteredArticles.length === 0 && (
          <p className="font-['Tajawal'] text-center text-[#4A473F]">لا توجد مقالات مطابقة</p>
        )}

        {filteredArticles.map(renderArticle)}
      </div>

      <Footer variant={accountType === 'firm' ? 'firm' : accountType === 'lawyer' ? 'lawyer' : 'customer'} />
    </div>
  )
}