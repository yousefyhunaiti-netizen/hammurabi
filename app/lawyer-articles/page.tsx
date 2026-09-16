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

export default function LawyerArticlesPage() {
  const [loading, setLoading] = useState(true)
  const [lawyerId, setLawyerId] = useState<number | null>(null)
  const [notAllowed, setNotAllowed] = useState(false)
  const [notSubscribed, setNotSubscribed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [totalUnread, setTotalUnread] = useState(0)

  const [articles, setArticles] = useState<Article[]>([])
  const [specialties, setSpecialties] = useState<Specialty[]>([])
  const [cardMenuOpenId, setCardMenuOpenId] = useState<number | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)

  const supabase = createClient()

  async function loadArticles(id: number) {
    const result = await supabase.from('legal_articles').select('*').eq('lawyer_id', id).order('created_at', { ascending: false })
    setArticles(result.data || [])
  }

  useEffect(function () {
    async function loadData() {
      const userResult = await supabase.auth.getUser()

      if (!userResult.data.user) {
        setNotAllowed(true)
        setLoading(false)
        return
      }

      const lawyerResult = await supabase.from('lawyers').select('id, is_active, is_comped').eq('user_id', userResult.data.user.id).maybeSingle()

      if (!lawyerResult.data) {
        setNotAllowed(true)
        setLoading(false)
        return
      }

      if (!lawyerResult.data.is_active && !lawyerResult.data.is_comped) {
        setNotSubscribed(true)
        setLoading(false)
        return
      }

      setLawyerId(lawyerResult.data.id)

      const specialtiesResult = await supabase.from('specialties').select('*')
      setSpecialties(specialtiesResult.data || [])

      const unreadResult = await supabase.from('lawyer_messages').select('id', { count: 'exact', head: true }).eq('recipient_lawyer_id', lawyerResult.data.id).eq('is_read', false)
      setTotalUnread(unreadResult.count || 0)

      await loadArticles(lawyerResult.data.id)
      setLoading(false)
    }

    loadData()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    setMenuOpen(false)
  }

  function toggleMenu() {
    setMenuOpen(!menuOpen)
  }

  function resetForm() {
    setTitle('')
    setBody('')
    setEditingId(null)
  }

  async function handleSave() {
    if (!title.trim() || !body.trim() || !lawyerId) return
    setSaving(true)

    if (editingId) {
      await supabase.from('legal_articles').update({
        title: title,
        body: body,
      }).eq('id', editingId)
    } else {
      await supabase.from('legal_articles').insert({
        lawyer_id: lawyerId,
        title: title,
        body: body,
      })
    }

    resetForm()
    setShowForm(false)
    await loadArticles(lawyerId)
    setSaving(false)
  }

  function startEdit(article: Article) {
    setEditingId(article.id)
    setTitle(article.title)
    setBody(article.body)
    setShowForm(true)
    setCardMenuOpenId(null)
  }

  async function handleDelete(id: number) {
    if (!lawyerId) return
    await supabase.from('legal_articles').delete().eq('id', id)
    setCardMenuOpenId(null)
    await loadArticles(lawyerId)
  }

  function getSpecialtyName(id: number | null) {
    if (!id) return ''
    const found = specialties.find(function (s) { return s.id === id })
    return found ? found.name_ar : ''
  }

  function renderArticle(article: Article) {
    const menuOpenHere = cardMenuOpenId === article.id

    function menuClick() {
      setCardMenuOpenId(menuOpenHere ? null : article.id)
    }

    function editClick() {
      startEdit(article)
    }

    function deleteClick() {
      handleDelete(article.id)
    }

    return (
      <div key={article.id} className="bg-white border border-[#D8D2C4] rounded-lg p-5 mb-3 relative">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-['Tajawal'] font-bold text-[#1B1A17]">{article.title}</h3>
          <div className="relative">
            <button onClick={menuClick} className="cursor-pointer text-[#4A473F] px-2">⋮</button>
            {menuOpenHere && (
              <div className="absolute left-0 top-full mt-1 bg-white border border-[#D8D2C4] rounded-md shadow-lg z-10 w-28">
                <button onClick={editClick} className="cursor-pointer w-full text-right px-3 py-2 font-['Tajawal'] text-xs text-[#1B1A17] hover:bg-[#F3EEE4]">تعديل</button>
                <button onClick={deleteClick} className="cursor-pointer w-full text-right px-3 py-2 font-['Tajawal'] text-xs text-[#7A2E2E] hover:bg-[#F3EEE4] border-t border-[#D8D2C4]">حذف</button>
              </div>
            )}
          </div>
        </div>
        <p className="font-['Tajawal'] text-sm text-[#4A473F] line-clamp-3">{article.body}</p>
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

  if (notAllowed) {
    return (
      <div dir="rtl" className="min-h-screen pattern-bg flex items-center justify-center px-6">
        <div className="text-center">
          <p className="font-['Tajawal'] text-[#4A473F] mb-4">هذه الصفحة مخصصة لحسابات المحامين فقط</p>
          <a href="/login" className="inline-block px-6 py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal']">تسجيل الدخول</a>
        </div>
      </div>
    )
  }

  if (notSubscribed) {
    return (
      <div dir="rtl" className="min-h-screen pattern-bg flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="bg-white border-2 border-[#AD8A4E] rounded-lg p-8">
            <h1 className="font-['Amiri'] text-2xl text-[#1B1A17] mb-3">يلزم الاشتراك للوصول إلى المقالات</h1>
            <a href="/subscription" className="inline-block mt-4 px-6 py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal']">عرض خطط الاشتراك</a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div dir="rtl" className="min-h-screen pattern-bg">
      <div className="bg-[#1B1A17] text-[#F3EEE4] py-12 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-8 font-['Tajawal'] text-sm">
            <a href="/"><img src="/logo.png" alt="حمورابي" className="h-12 w-auto" /></a>
            <div className="flex gap-5 items-center">
              <a href="/my-appointments" className="hover:text-[#AD8A4E] transition">مواعيدي</a>
              <a href="/my-consultations" className="hover:text-[#AD8A4E] transition">استشاراتي</a>
              <a href="/ai-assistant" className="hover:text-[#AD8A4E] transition">مساعد ذكي</a>
              <a href="/lawyer-tools" className="hover:text-[#AD8A4E] transition">أدواتي</a>
              <a href="/community" className="hover:text-[#AD8A4E] transition">المجتمع</a>
              <a href="/lawyer-messages" className="relative hover:text-[#AD8A4E] transition">
                <svg className="w-5 h-5 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
                {totalUnread > 0 && (
                  <span className="absolute -top-2 -left-2 bg-[#AD8A4E] text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{totalUnread}</span>
                )}
              </a>
              <div className="relative">
                <button onClick={toggleMenu} className="w-8 h-8 rounded-full bg-[#AD8A4E] flex items-center justify-center hover:bg-[#c49b58] transition">
                  <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.5c-3.3 0-9.8 1.6-9.8 4.9v2.4h19.6v-2.4c0-3.3-6.5-4.9-9.8-4.9z" /></svg>
                </button>
                {menuOpen && (
                  <div className="absolute left-0 top-full mt-2 w-52 bg-white border border-[#D8D2C4] rounded-md shadow-lg overflow-hidden z-20">
                    <a href="/lawyer-info" className="block px-4 py-3 font-['Tajawal'] text-sm text-[#1B1A17] hover:bg-[#F3EEE4] transition">معلوماتي الشخصية</a>
                    <button onClick={handleLogout} className="w-full text-right px-4 py-3 font-['Tajawal'] text-sm text-[#7A2E2E] hover:bg-[#F3EEE4] transition border-t border-[#D8D2C4]">تسجيل الخروج</button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <h1 className="font-['Tajawal'] font-bold text-4xl mb-2">مقالاتي القانونية ({articles.length})</h1>
          <p className="font-['Tajawal'] text-sm text-[#D8D2C4]">اكتب مقالات يراها العملاء في دليل المقالات العامة، وابنِ سمعتك المهنية</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10">
        <button onClick={function () { resetForm(); setShowForm(!showForm) }} className="px-5 py-2 bg-[#AD8A4E] text-white rounded-md font-['Tajawal'] text-sm mb-6">
          {showForm ? 'إلغاء' : '+ مقال جديد'}
        </button>

        {showForm && (
          <div className="bg-white border-2 border-[#AD8A4E] rounded-lg p-6 mb-6">
            <input type="text" value={title} onChange={function (e) { setTitle(e.target.value) }} placeholder="عنوان المقال" className="w-full px-3 py-2 mb-3 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
            <textarea value={body} onChange={function (e) { setBody(e.target.value) }} rows={8} placeholder="محتوى المقال" className="w-full px-3 py-2 mb-3 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
            <button onClick={handleSave} disabled={saving} className="w-full py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal'] font-medium hover:bg-[#AD8A4E] transition disabled:opacity-60">
              {saving ? 'جاري الحفظ...' : (editingId ? 'حفظ التعديلات' : 'نشر المقال')}
            </button>
          </div>
        )}

        {articles.length === 0 && !showForm && (
          <p className="font-['Tajawal'] text-center text-[#4A473F]">لم تنشر أي مقال بعد</p>
        )}

        {articles.map(renderArticle)}
      </div>
    </div>
  )
}