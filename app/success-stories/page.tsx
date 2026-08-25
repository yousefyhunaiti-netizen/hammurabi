'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase'

type Story = {
  id: number
  lawyer_id: number
  title: string
  body: string
  created_at: string
}

type LawyerName = {
  id: number
  full_name: string
}

export default function SuccessStoriesPage() {
  const [loading, setLoading] = useState(true)
  const [isLawyer, setIsLawyer] = useState(false)
  const [lawyerId, setLawyerId] = useState<number | null>(null)
  const [stories, setStories] = useState<Story[]>([])
  const [lawyerNames, setLawyerNames] = useState<LawyerName[]>([])

  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [posting, setPosting] = useState(false)

  const supabase = createClient()

  async function loadStories() {
    const result = await supabase.from('success_stories').select('*').order('created_at', { ascending: false })
    const data = result.data || []
    setStories(data)

    const lawyerIds = Array.from(new Set(data.map(function (s: Story) { return s.lawyer_id })))
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

      await loadStories()
      setLoading(false)
    }

    loadData()
  }, [])

  async function handlePost() {
    if (!title.trim() || !body.trim() || !lawyerId) return
    setPosting(true)

    await supabase.from('success_stories').insert({
      lawyer_id: lawyerId,
      title: title,
      body: body,
    })

    setTitle('')
    setBody('')
    setShowForm(false)
    await loadStories()
    setPosting(false)
  }

  function getLawyerName(id: number) {
    const found = lawyerNames.find(function (l) { return l.id === id })
    return found ? found.full_name : ''
  }

  function renderStory(story: Story) {
    return (
      <div key={story.id} className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-4">
        <h3 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mb-2">{story.title}</h3>
        <p className="font-['Tajawal'] text-sm text-[#4A473F] mb-3 whitespace-pre-wrap">{story.body}</p>
        <p className="font-['Tajawal'] text-xs text-[#AD8A4E]">بواسطة {getLawyerName(story.lawyer_id)}</p>
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
          <h1 className="font-['Amiri'] text-4xl mb-2">قصص نجاح</h1>
          <div className="w-16 h-[2px] bg-[#AD8A4E] mb-3"></div>
          <p className="font-['Tajawal'] text-sm text-[#D8D2C4]">شارك المحامون تجاربهم ونجاحاتهم</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {isLawyer && (
          <button
            onClick={function () { setShowForm(!showForm) }}
            className="mb-6 px-5 py-2 bg-[#AD8A4E] text-white rounded-md font-['Tajawal'] text-sm hover:bg-[#c49b58] transition"
          >
            {showForm ? 'إلغاء' : 'شارك قصتك'}
          </button>
        )}

        {showForm && (
          <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-6">
            <input
              type="text"
              value={title}
              onChange={function (e) { setTitle(e.target.value) }}
              placeholder="عنوان القصة"
              className="w-full px-3 py-2 mb-3 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
            />
            <textarea
              value={body}
              onChange={function (e) { setBody(e.target.value) }}
              rows={5}
              placeholder="شارك تجربتك أو نجاحك..."
              className="w-full px-3 py-2 mb-3 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
            />
            <button
              onClick={handlePost}
              disabled={posting}
              className="w-full py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal'] font-medium hover:bg-[#AD8A4E] transition disabled:opacity-60"
            >
              {posting ? 'جاري النشر...' : 'نشر'}
            </button>
          </div>
        )}

        {stories.length === 0 && (
          <p className="font-['Tajawal'] text-center text-[#4A473F]">لا توجد قصص بعد</p>
        )}

        {stories.map(renderStory)}
      </div>
    </div>
  )
}