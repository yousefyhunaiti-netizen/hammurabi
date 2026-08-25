'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '../../lib/supabase'

type Question = {
  id: number
  lawyer_id: number
  specialty_id: number | null
  title: string
  body: string
  created_at: string
}

type Answer = {
  id: number
  question_id: number
  lawyer_id: number
  body: string
  upvotes: number
  created_at: string
}

type Specialty = {
  id: number
  name_ar: string
}

type LawyerInfo = {
  id: number
  full_name: string
  specialty_id: number | null
}

export default function QuestionDetailPage() {
  const params = useParams()
  const questionId = Number(params.id)

  const [loading, setLoading] = useState(true)
  const [question, setQuestion] = useState<Question | null>(null)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [specialties, setSpecialties] = useState<Specialty[]>([])
  const [lawyers, setLawyers] = useState<LawyerInfo[]>([])
  const [isLawyer, setIsLawyer] = useState(false)
  const [lawyerId, setLawyerId] = useState<number | null>(null)

  const [answerText, setAnswerText] = useState('')
  const [posting, setPosting] = useState(false)

  const supabase = createClient()

  async function loadAnswers() {
    const result = await supabase
      .from('community_answers')
      .select('*')
      .eq('question_id', questionId)
      .order('upvotes', { ascending: false })
    const aData = result.data || []
    setAnswers(aData)

    const lawyerIds = Array.from(new Set(aData.map(function (a: Answer) { return a.lawyer_id })))
    if (lawyerIds.length > 0) {
      const lawyersResult = await supabase.from('lawyers').select('id, full_name, specialty_id').in('id', lawyerIds)
      setLawyers(lawyersResult.data || [])
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

      const questionResult = await supabase.from('community_questions').select('*').eq('id', questionId).single()
      setQuestion(questionResult.data)

      const specialtiesResult = await supabase.from('specialties').select('*')
      setSpecialties(specialtiesResult.data || [])

      await loadAnswers()
      setLoading(false)
    }

    loadData()
  }, [questionId])

  async function handlePostAnswer() {
    if (!answerText.trim() || !lawyerId) return
    setPosting(true)

    await supabase.from('community_answers').insert({
      question_id: questionId,
      lawyer_id: lawyerId,
      body: answerText,
      upvotes: 0,
    })

    setAnswerText('')
    await loadAnswers()
    setPosting(false)
  }

  async function handleUpvote(answer: Answer) {
    await supabase.from('community_answers').update({ upvotes: answer.upvotes + 1 }).eq('id', answer.id)
    await loadAnswers()
  }

  function getSpecialtyName(id: number | null) {
    if (!id) return ''
    const found = specialties.find(function (s) { return s.id === id })
    return found ? found.name_ar : ''
  }

  function getLawyerInfo(id: number) {
    return lawyers.find(function (l) { return l.id === id })
  }

  function renderAnswer(answer: Answer) {
    const lawyerInfo = getLawyerInfo(answer.lawyer_id)
    const lawyerName = lawyerInfo ? lawyerInfo.full_name : ''
    const isVerified = question && lawyerInfo && lawyerInfo.specialty_id === question.specialty_id && question.specialty_id !== null

    function upvoteClick() {
      handleUpvote(answer)
    }

    return (
      <div key={answer.id} className="bg-white border border-[#D8D2C4] rounded-lg p-5 mb-3">
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2">
            <p className="font-['Tajawal'] font-medium text-sm text-[#1B1A17]">{lawyerName}</p>
            {isVerified && (
              <span className="px-2 py-0.5 bg-[#2F4538] text-white text-xs font-['Tajawal'] rounded-full">إجابة موثقة</span>
            )}
          </div>
          <button onClick={upvoteClick} className="flex items-center gap-1 px-3 py-1 bg-[#F3EEE4] rounded-md font-['Tajawal'] text-xs text-[#4A473F]">
            👍 {answer.upvotes}
          </button>
        </div>
        <p className="font-['Tajawal'] text-sm text-[#4A473F]">{answer.body}</p>
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

  if (!question) {
    return (
      <div dir="rtl" className="min-h-screen pattern-bg flex items-center justify-center">
        <p className="font-['Tajawal'] text-[#4A473F]">لم يتم العثور على هذا السؤال</p>
      </div>
    )
  }

  return (
    <div dir="rtl" className="min-h-screen pattern-bg">
      <div className="bg-[#1B1A17] text-[#F3EEE4] py-12 px-6">
        <div className="max-w-3xl mx-auto">
          <a href="/community" className="font-['Tajawal'] text-sm text-[#AD8A4E] hover:underline mb-4 inline-block">← العودة للمجتمع</a>
          <h1 className="font-['Amiri'] text-3xl mb-3">{question.title}</h1>
          {question.specialty_id && (
            <span className="px-3 py-1 bg-[#AD8A4E] text-white text-xs font-['Tajawal'] rounded-full">{getSpecialtyName(question.specialty_id)}</span>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-8">
          <p className="font-['Tajawal'] text-[#1B1A17] leading-relaxed">{question.body}</p>
        </div>

        <h2 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mb-4">الإجابات ({answers.length})</h2>

        {answers.length === 0 && (
          <p className="font-['Tajawal'] text-sm text-[#4A473F] mb-6">لا توجد إجابات بعد</p>
        )}

        {answers.map(renderAnswer)}

        {isLawyer && (
          <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mt-6">
            <h3 className="font-['Tajawal'] font-bold text-[#1B1A17] mb-3">أضف إجابة</h3>
            <textarea
              value={answerText}
              onChange={function (e) { setAnswerText(e.target.value) }}
              rows={4}
              placeholder="اكتب إجابتك..."
              className="w-full px-3 py-2 mb-3 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
            />
            <button
              onClick={handlePostAnswer}
              disabled={posting}
              className="w-full py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal'] font-medium hover:bg-[#AD8A4E] transition disabled:opacity-60"
            >
              {posting ? 'جاري النشر...' : 'نشر الإجابة'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}