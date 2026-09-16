'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase'

type Article = {
  id: number
  lawyer_id: number
  specialty_id: number | null
  title: string
  body: string
  created_at: string
}

type Specialty = {
  id: number
  name_ar: string
}

type LawyerName = {
  id: number
  full_name: string
}

export default function LegalArticlesPage() {
  const [loading, setLoading] = useState(true)
  const [isLawyer, setIsLawyer] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [loggedIn, setLoggedIn] = useState(false)
  const [infoLink, setInfoLink] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [totalUnread, setTotalUnread] = useState(0)

  const [articles, setArticles] = useState<Article[]>([])
  const [specialties, setSpecialties] = useState<Specialty[]>([])
  const [lawyerNames, setLawyerNames] = useState<LawyerName[]>([])
  const [search, setSearch] = useState('')

  const supabase = createClient()

  function readingTime(text: string) {
    const words = text.trim().split(/\s+/).length
    const minutes = Math.max(1, Math.round(words / 150))
    return minutes + ' دقيقة قراءة'
  }

  async function loadArticles() {
    const result = await supabase.from('legal_articles').select('*').order('created_at', { ascending: false })
    const data = result.data || []
    setArticles(data)

    const lawyerIds = Array.from(new Set(data.map(function (a: Article) { return a.lawyer_id })))
    if (lawyerIds.length > 0) {
      const namesResult = await supabase.from('lawyers').select('id, full_name').in('id', lawyerIds)
      setLawyerNames(namesResult.data || [])
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
          setInfoLink('/my-info')
        } else {
          const lawyerResult = await supabase.from('lawyers').select('id').eq('user_id', user.id).maybeSingle()
          if (lawyerResult.data) {
            setIsLawyer(true)
            setInfoLink('/lawyer-info')

            const unreadResult = await supabase.from('lawyer_messages').select('id', { count: 'exact', head: true }).eq('recipient_lawyer_id', lawyerResult.data.id).eq('is_read', false)
            setTotalUnread(unreadResult.count || 0)
          } else {
            const firmResult = await supabase.from('firms').select('id').eq('user_id', user.id).maybeSingle()
            if (firmResult.data) {
              setInfoLink('/firm-info')
            }
          }
        }
      }

      setCheckingAuth(false)

      const specialtiesResult = await supabase.from('specialties').select('*')
      setSpecialties(specialtiesResult.data || [])

      await loadArticles()
      setLoading(false)
    }

    loadData()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    setLoggedIn(false)
    setMenuOpen(false)
  }

  function toggleMenu() {
    setMenuOpen(!menuOpen)
  }

  function getSpecialtyName(id: number | null) {
    if (!id) return ''
    const found = specialties.find(function (s) { return s.id === id })
    return found ? found.name_ar : ''
  }

  function getLawyerName(id: number) {
    const found = lawyerNames.find(function (l) { return l.id === id })
    return found ? found.full_name : ''
  }

  const filteredArticles = articles.filter(function (a) {
    if (!search.trim()) return true
    const lower = search.toLowerCase()
    return a.title.toLowerCase().indexOf(lower) !== -1 || a.body.toLowerCase().indexOf(lower) !== -1 || getLawyerName(a.lawyer_id).toLowerCase().indexOf(lower) !== -1
  })

  function renderArticle(article: Article) {
    const lawyerLink = '/lawyers/' + article.lawyer_id
    return (
      <div key={article.id} className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-4 hover:shadow-lg transition">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-[#1B1A17] flex items-center justify-center text-[#AD8A4E] font-['Amiri'] text-lg flex-shrink-0">
            {getLawyerName(article.lawyer_id).charAt(0)}
          </div>
          <div>
            <a href={lawyerLink} className="font-['Tajawal'] font-medium text-sm text-[#1B1A17] hover:text-[#AD8A4E]">{getLawyerName(article.lawyer_id)}</a>
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

  return (
    <div dir="rtl" className="min-h-screen pattern-bg">
      <div className="bg-[#1B1A17] text-[#F3EEE4] py-12 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex justify-between items-center mb-8 font-['Tajawal'] text-sm">
            <a href="/"><img src="/logo.png" alt="حمورابي" className="h-12 w-auto" /></a>
            <div className="flex gap-5 items-center">
              {!isLawyer && (
                <a href="/lawyers" className="hover:text-[#AD8A4E] transition">دليل المحامين</a>
              )}
              <a href="/legal-articles" className="hover:text-[#AD8A4E] transition">مقالات قانونية</a>
              <a href="/ai-assistant" className="hover:text-[#AD8A4E] transition">مساعد ذكي</a>
              {!isLawyer && (
                <a href="/my-appointments" className="hover:text-[#AD8A4E] transition">مواعيدي</a>
              )}
              {!isLawyer && (
                <a href="/my-consultations" className="hover:text-[#AD8A4E] transition">استشاراتي</a>
              )}
              {isLawyer && (
                <a href="/lawyer-tools" className="hover:text-[#AD8A4E] transition">أدواتي</a>
              )}
              {isLawyer && (
                <a href="/community" className="hover:text-[#AD8A4E] transition">المجتمع</a>
              )}
              {isLawyer && (
                <a href="/lawyer-messages" className="relative hover:text-[#AD8A4E] transition">
                  <svg className="w-5 h-5 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                  </svg>
                  {totalUnread > 0 && (
                    <span className="absolute -top-2 -left-2 bg-[#AD8A4E] text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{totalUnread}</span>
                  )}
                </a>
              )}

              {!checkingAuth && !loggedIn && (
                <a href="/login" className="hover:text-[#AD8A4E] transition">تسجيل الدخول</a>
              )}

              {!checkingAuth && loggedIn && (
                <div className="relative">
                  <button onClick={toggleMenu} className="w-8 h-8 rounded-full bg-[#AD8A4E] flex items-center justify-center hover:bg-[#c49b58] transition">
                    <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.5c-3.3 0-9.8 1.6-9.8 4.9v2.4h19.6v-2.4c0-3.3-6.5-4.9-9.8-4.9z" /></svg>
                  </button>
                  {menuOpen && (
                    <div className="absolute left-0 top-full mt-2 w-52 bg-white border border-[#D8D2C4] rounded-md shadow-lg overflow-hidden z-20">
                      {infoLink && <a href={infoLink} className="block px-4 py-3 font-['Tajawal'] text-sm text-[#1B1A17] hover:bg-[#F3EEE4] transition">معلوماتي الشخصية</a>}
                      <button onClick={handleLogout} className="w-full text-right px-4 py-3 font-['Tajawal'] text-sm text-[#7A2E2E] hover:bg-[#F3EEE4] transition border-t border-[#D8D2C4]">تسجيل الخروج</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <h1 className="font-['Tajawal'] font-bold text-4xl mb-2">مقالات قانونية</h1>
          <p className="font-['Tajawal'] text-sm text-[#D8D2C4]">محتوى موثوق كتبه محامون مرخصون، لمساعدتك على فهم حقوقك القانونية</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <input
          type="text"
          value={search}
          onChange={function (e) { setSearch(e.target.value) }}
          placeholder="ابحث في المقالات..."
          className="w-full px-4 py-2.5 mb-6 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
        />

        {filteredArticles.length === 0 && (
          <p className="font-['Tajawal'] text-center text-[#4A473F]">لا توجد مقالات مطابقة</p>
        )}

        {filteredArticles.map(renderArticle)}
      </div>
    </div>
  )
}