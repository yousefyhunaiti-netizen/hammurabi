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
  const [lawyerId, setLawyerId] = useState<number | null>(null)
  const [articles, setArticles] = useState<Article[]>([])
  const [specialties, setSpecialties] = useState<Specialty[]>([])
  const [lawyerNames, setLawyerNames] = useState<LawyerName[]>([])
  const [selectedSpecialty, setSelectedSpecialty] = useState<number | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [specialtyId, setSpecialtyId] = useState('')
  const [posting, setPosting] = useState(false)

  const supabase = createClient()

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
        const lawyerResult = await supabase.from('lawyers').select('id').eq('user_id', userResult.data.user.id).maybeSingle()
        if (lawyerResult.data) {
          setIsLawyer(true)
          setLawyerId(lawyerResult.data.id)
        }
      }

      const specialtiesResult = await supabase.from('specialties').select('*')
      setSpecialties(specialtiesResult.data || [])

      await loadArticles()
      setLoading(false)
    }

    loadData()
  }, [])

  async function handlePost() {
    if (!title.trim() || !body.trim() || !lawyerId) return
    setPosting(true)

    await supabase.from('legal_articles').insert({
      lawyer_id: lawyerId,
      specialty_id: specialtyId ? Number(specialtyId) : null,
      title: title,
      body: body,
    })

    setTitle('')
    setBody('')
    setSpecialtyId('')
    setShowForm(false)
    await loadArticles()
    setPosting(false)
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
    return selectedSpecialty ? a.specialty_id === selectedSpecialty : true
  })

  function renderArticle(article: Article) {
    const lawyerLink = '/lawyers/' + article.lawyer_id
    return (
      <div key={article.id} className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17]">{article.title}</h3>
          {article.specialty_id && (
            <span className="px-3 py-1 bg-[#F3EEE4] text-[#AD8A4E] text-xs font-['Tajawal'] rounded-full whitespace-nowrap">{getSpecialtyName(article.specialty_id)}</span>
          )}
        </div>
        <p className="font-['Tajawal'] text-sm text-[#4A473F] mb-3 whitespace-pre-wrap">{article.body}</p>
        <a href={lawyerLink} className="font-['Tajawal'] text-xs text-[#AD8A4E] hover:underline">بقلم {getLawyerName(article.lawyer_id)} — عرض الملف الشخصي</a>
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
          <h1 className="font-['Amiri'] text-4xl mb-2">مقالات قانونية</h1>
          <div className="w-16 h-[2px] bg-[#AD8A4E] mb-3"></div>
          <p className="font-['Tajawal'] text-sm text-[#D8D2C4]">محتوى تثقيفي كتبه محامون موثوقون</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row gap-4 mb-6 items-start md:items-center justify-between">
          <select
            value={selectedSpecialty ?? ''}
            onChange={function (e) { setSelectedSpecialty(e.target.value ? Number(e.target.value) : null) }}
            className="px-4 py-2 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
          >
            <option value="">كل التخصصات</option>
            {specialties.map(function (s) {
              return <option key={s.id} value={s.id}>{s.name_ar}</option>
            })}
          </select>

          {isLawyer && (
            <button
              onClick={function () { setShowForm(!showForm) }}
              className="px-5 py-2 bg-[#AD8A4E] text-white rounded-md font-['Tajawal'] text-sm hover:bg-[#c49b58] transition"
            >
              {showForm ? 'إلغاء' : 'اكتب مقالاً'}
            </button>
          )}
        </div>

        {showForm && (
          <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-6">
            <input
              type="text"
              value={title}
              onChange={function (e) { setTitle(e.target.value) }}
              placeholder="عنوان المقال"
              className="w-full px-3 py-2 mb-3 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
            />
            <select
              value={specialtyId}
              onChange={function (e) { setSpecialtyId(e.target.value) }}
              className="w-full px-3 py-2 mb-3 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
            >
              <option value="">اختر التخصص</option>
              {specialties.map(function (s) {
                return <option key={s.id} value={s.id}>{s.name_ar}</option>
              })}
            </select>
            <textarea
              value={body}
              onChange={function (e) { setBody(e.target.value) }}
              rows={6}
              placeholder="محتوى المقال"
              className="w-full px-3 py-2 mb-3 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
            />
            <button
              onClick={handlePost}
              disabled={posting}
              className="w-full py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal'] font-medium hover:bg-[#AD8A4E] transition disabled:opacity-60"
            >
              {posting ? 'جاري النشر...' : 'نشر المقال'}
            </button>
          </div>
        )}

        {filteredArticles.length === 0 && (
          <p className="font-['Tajawal'] text-center text-[#4A473F]">لا توجد مقالات بعد</p>
        )}

        {filteredArticles.map(renderArticle)}
      </div>
    </div>
  )
}