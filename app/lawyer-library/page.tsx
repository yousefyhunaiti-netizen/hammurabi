'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase'

type LibraryItem = {
  id: number
  title: string
  content: string | null
  link: string | null
  created_at: string
}

export default function LawyerLibraryPage() {
  const [loading, setLoading] = useState(true)
  const [lawyerId, setLawyerId] = useState<number | null>(null)
  const [notAllowed, setNotAllowed] = useState(false)
  const [items, setItems] = useState<LibraryItem[]>([])
  const [search, setSearch] = useState('')

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [link, setLink] = useState('')
  const [saving, setSaving] = useState(false)

  const supabase = createClient()

  async function loadItems(id: number) {
    const result = await supabase.from('library_items').select('*').eq('lawyer_id', id).order('created_at', { ascending: false })
    setItems(result.data || [])
  }

  useEffect(function () {
    async function loadData() {
      const userResult = await supabase.auth.getUser()

      if (!userResult.data.user) {
        setNotAllowed(true)
        setLoading(false)
        return
      }

      const lawyerResult = await supabase.from('lawyers').select('id').eq('user_id', userResult.data.user.id).maybeSingle()

      if (!lawyerResult.data) {
        setNotAllowed(true)
        setLoading(false)
        return
      }

      setLawyerId(lawyerResult.data.id)
      await loadItems(lawyerResult.data.id)
      setLoading(false)
    }

    loadData()
  }, [])

  async function handleAddItem() {
    if (!title.trim() || !lawyerId) return
    setSaving(true)

    await supabase.from('library_items').insert({
      lawyer_id: lawyerId,
      title: title,
      content: content,
      link: link,
    })

    setTitle('')
    setContent('')
    setLink('')
    await loadItems(lawyerId)
    setSaving(false)
  }

  async function handleDeleteItem(itemId: number) {
    if (!lawyerId) return
    await supabase.from('library_items').delete().eq('id', itemId)
    await loadItems(lawyerId)
  }

  const filteredItems = items.filter(function (item) {
    if (!search.trim()) return true
    const searchLower = search.toLowerCase()
    const titleMatch = item.title.toLowerCase().indexOf(searchLower) !== -1
    const contentMatch = item.content ? item.content.toLowerCase().indexOf(searchLower) !== -1 : false
    return titleMatch || contentMatch
  })

  function renderItem(item: LibraryItem) {
    function deleteClick() {
      handleDeleteItem(item.id)
    }

    return (
      <div key={item.id} className="bg-white border border-[#D8D2C4] rounded-lg p-5 mb-3">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-['Tajawal'] font-bold text-[#1B1A17]">{item.title}</h3>
          <button onClick={deleteClick} className="font-['Tajawal'] text-xs text-[#7A2E2E]">حذف</button>
        </div>
        {item.content && (
          <p className="font-['Tajawal'] text-sm text-[#4A473F] mb-2 whitespace-pre-wrap">{item.content}</p>
        )}
        {item.link && (
          <a href={item.link} target="_blank" rel="noopener noreferrer" className="font-['Tajawal'] text-xs text-[#AD8A4E] underline">فتح الرابط</a>
        )}
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

  return (
    <div dir="rtl" className="min-h-screen pattern-bg">
      <div className="bg-[#1B1A17] text-[#F3EEE4] py-12 px-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="font-['Amiri'] text-4xl mb-2">مكتبتي القانونية</h1>
          <div className="w-16 h-[2px] bg-[#AD8A4E]"></div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-6">
          <h2 className="font-['Tajawal'] font-bold text-[#1B1A17] mb-3">إضافة عنصر جديد</h2>
          <div className="space-y-3">
            <input type="text" value={title} onChange={function (e) { setTitle(e.target.value) }} placeholder="العنوان" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
            <textarea value={content} onChange={function (e) { setContent(e.target.value) }} rows={3} placeholder="ملاحظات أو نص القانون" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
            <input type="text" value={link} onChange={function (e) { setLink(e.target.value) }} placeholder="رابط (اختياري)" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
            <button onClick={handleAddItem} disabled={saving} className="w-full py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal'] font-medium hover:bg-[#AD8A4E] transition disabled:opacity-60">
              {saving ? 'جاري الحفظ...' : 'حفظ'}
            </button>
          </div>
        </div>

        <input
          type="text"
          value={search}
          onChange={function (e) { setSearch(e.target.value) }}
          placeholder="ابحث في مكتبتك..."
          className="w-full px-3 py-2 mb-4 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
        />

        {filteredItems.length === 0 && (
          <p className="font-['Tajawal'] text-center text-[#4A473F]">لا توجد عناصر بعد</p>
        )}

        {filteredItems.map(renderItem)}
      </div>
    </div>
  )
}