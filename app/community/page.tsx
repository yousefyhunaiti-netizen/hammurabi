'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase'

type Question = {
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

type AnswerCount = {
  question_id: number
}

type Repost = {
  post_id: number
  lawyer_id: number
}

export default function CommunityPage() {
  const [loading, setLoading] = useState(true)
  const [isLawyer, setIsLawyer] = useState(false)
  const [lawyerId, setLawyerId] = useState<number | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [specialties, setSpecialties] = useState<Specialty[]>([])
  const [lawyerNames, setLawyerNames] = useState<LawyerName[]>([])
  const [answerCounts, setAnswerCounts] = useState<AnswerCount[]>([])
  const [reposts, setReposts] = useState<Repost[]>([])
  const [selectedSpecialty, setSelectedSpecialty] = useState<number | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [specialtyId, setSpecialtyId] = useState('')
  const [posting, setPosting] = useState(false)

  const supabase = createClient()

  async function loadQuestions() {
    const result = await supabase.from('community_questions').select('*').order('created_at', { ascending: false })
    const qData = result.data || []
    setQuestions(qData)

    const lawyerIds = Array.from(new Set(qData.map(function (q: Question) { return q.lawyer_id })))
    if (lawyerIds.length > 0) {
      const namesResult = await supabase.from('lawyers').select('id, full_name').in('id', lawyerIds)
      setLawyerNames(namesResult.data || [])
    }

    const answersResult = await supabase.from('community_answers').select('question_id')
    setAnswerCounts(answersResult.data || [])

    const repostsResult = await supabase.from('reposts').select('post_id, lawyer_id').eq('post_type', 'question')
    setReposts(repostsResult.data || [])
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

      await loadQuestions()
      setLoading(false)
    }

    loadData()
  }, [])

  async function handlePost() {
    if (!title.trim() || !body.trim() || !lawyerId) return
    setPosting(true)

    await supabase.from('community_questions').insert({
      lawyer_id: lawyerId,
      specialty_id: specialtyId ? Number(specialtyId) : null,
      title: title,
      body: body,
    })

    setTitle('')
    setBody('')
    setSpecialtyId('')
    setShowForm(false)
    await loadQuestions()
    setPosting(false)
  }

  async function handleRepost(questionId: number) {
    if (!lawyerId) return

    const existing = reposts.find(function (r) { return r.post_id === questionId && r.lawyer_id === lawyerId })

    if (existing) {
      await supabase.from('reposts').delete().eq('post_type', 'question').eq('post_id', questionId).eq('lawyer_id', lawyerId)
    } else {
      await supabase.from('reposts').insert({ post_type: 'question', post_id: questionId, lawyer_id: lawyerId })
    }

    await loadQuestions()
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

  function getAnswerCount(questionId: number) {
    return answerCounts.filter(function (a) { return a.question_id === questionId }).length
  }

  function getRepostCount(questionId: number) {
    return reposts.filter(function (r) { return r.post_id === questionId }).length
  }

  function isRepostedByMe(questionId: number) {
    if (!lawyerId) return false
    return reposts.some(function (r) { return r.post_id === questionId && r.lawyer_id === lawyerId })
  }

  const filteredQuestions = questions.filter(function (q) {
    return selectedSpecialty ? q.specialty_id === selectedSpecialty : true
  })

  function renderQuestion(q: Question) {
    const link = '/community/' + q.id
    const answerCount = getAnswerCount(q.id)
    const repostCount = getRepostCount(q.id)
    const reposted = isRepostedByMe(q.id)

    function repostClick(e: React.MouseEvent) {
      e.preventDefault()
      handleRepost(q.id)
    }

    return (
      <div key={q.id} className="bg-white border border-[#D8D2C4] rounded-lg mb-4 overflow-hidden">
        <div className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-full bg-[#1B1A17] flex items-center justify-center text-[#AD8A4E] font-['Amiri'] text-lg flex-shrink-0">
              {getLawyerName(q.lawyer_id).charAt(0)}
            </div>
            <div>
              <p className="font-['Tajawal'] font-bold text-sm text-[#1B1A17]">{getLawyerName(q.lawyer_id)}</p>
              {q.specialty_id && (
                <span className="font-['Tajawal'] text-xs text-[#AD8A4E]">{getSpecialtyName(q.specialty_id)}</span>
              )}
            </div>
          </div>

          <a href={link} className="block">
            <h3 className="font-['Tajawal'] font-bold text-[#1B1A17] mb-2">{q.title}</h3>
            <p className="font-['Tajawal'] text-sm text-[#4A473F] line-clamp-3">{q.body}</p>
          </a>
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-[#D8D2C4] bg-[#F3EEE4]">
          <a href={link} className="font-['Tajawal'] text-xs text-[#4A473F]">{answerCount} إجابة</a>
          <button
            onClick={repostClick}
            className={"flex items-center gap-1 font-['Tajawal'] text-xs px-3 py-1.5 rounded-md transition " + (reposted ? 'bg-[#AD8A4E] text-white' : 'bg-white text-[#4A473F] border border-[#D8D2C4]')}
          >
            🔁 {reposted ? 'تمت إعادة النشر' : 'إعادة نشر'} {repostCount > 0 ? '(' + repostCount + ')' : ''}
          </button>
        </div>
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
        <div className="max-w-2xl mx-auto">
          <h1 className="font-['Amiri'] text-4xl mb-2">مجتمع المحامين</h1>
          <div className="w-16 h-[2px] bg-[#AD8A4E] mb-3"></div>
          <p className="font-['Tajawal'] text-sm text-[#D8D2C4]">أسئلة وإجابات بين المحامين</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
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
              {showForm ? 'إلغاء' : 'اطرح سؤالاً'}
            </button>
          )}
        </div>

        {showForm && (
          <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-6">
            <input
              type="text"
              value={title}
              onChange={function (e) { setTitle(e.target.value) }}
              placeholder="عنوان السؤال"
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
              rows={4}
              placeholder="تفاصيل السؤال"
              className="w-full px-3 py-2 mb-3 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
            />
            <button
              onClick={handlePost}
              disabled={posting}
              className="w-full py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal'] font-medium hover:bg-[#AD8A4E] transition disabled:opacity-60"
            >
              {posting ? 'جاري النشر...' : 'نشر السؤال'}
            </button>
          </div>
        )}

        {filteredQuestions.length === 0 && (
          <p className="font-['Tajawal'] text-center text-[#4A473F]">لا توجد أسئلة بعد</p>
        )}

        {filteredQuestions.map(renderQuestion)}
      </div>
    </div>
  )
}