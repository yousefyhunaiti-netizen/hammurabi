'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase'

type Note = {
  id: number
  content: string
  created_at: string
}

export default function LawyerNotesPage() {
  const [loading, setLoading] = useState(true)
  const [lawyerId, setLawyerId] = useState<number | null>(null)
  const [notAllowed, setNotAllowed] = useState(false)
  const [notes, setNotes] = useState<Note[]>([])
  const [newNote, setNewNote] = useState('')
  const [saving, setSaving] = useState(false)

  const supabase = createClient()

  async function loadNotes(id: number) {
    const result = await supabase
      .from('lawyer_notes')
      .select('*')
      .eq('lawyer_id', id)
      .order('created_at', { ascending: false })
    setNotes(result.data || [])
  }

  useEffect(function () {
    async function loadData() {
      const userResult = await supabase.auth.getUser()

      if (!userResult.data.user) {
        setNotAllowed(true)
        setLoading(false)
        return
      }

      const lawyerResult = await supabase
        .from('lawyers')
        .select('id')
        .eq('user_id', userResult.data.user.id)
        .maybeSingle()

      if (!lawyerResult.data) {
        setNotAllowed(true)
        setLoading(false)
        return
      }

      setLawyerId(lawyerResult.data.id)
      await loadNotes(lawyerResult.data.id)
      setLoading(false)
    }

    loadData()
  }, [])

  async function handleAddNote() {
    if (!newNote.trim() || !lawyerId) return
    setSaving(true)

    await supabase.from('lawyer_notes').insert({
      lawyer_id: lawyerId,
      content: newNote,
    })

    setNewNote('')
    await loadNotes(lawyerId)
    setSaving(false)
  }

  async function handleDeleteNote(noteId: number) {
    if (!lawyerId) return
    await supabase.from('lawyer_notes').delete().eq('id', noteId)
    await loadNotes(lawyerId)
  }

  function renderNote(note: Note) {
    function deleteClick() {
      handleDeleteNote(note.id)
    }

    return (
      <div key={note.id} className="bg-white border border-[#D8D2C4] rounded-lg p-4 mb-3">
        <p className="font-['Tajawal'] text-sm text-[#1B1A17] mb-2 whitespace-pre-wrap">{note.content}</p>
        <button onClick={deleteClick} className="font-['Tajawal'] text-xs text-[#7A2E2E] hover:underline">
          حذف
        </button>
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
          <h1 className="font-['Amiri'] text-4xl mb-2">ملاحظاتي</h1>
          <div className="w-16 h-[2px] bg-[#AD8A4E]"></div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-6">
          <textarea
            value={newNote}
            onChange={function (e) { setNewNote(e.target.value) }}
            rows={3}
            placeholder="اكتب ملاحظة جديدة..."
            className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17] mb-3"
          />
          <button
            onClick={handleAddNote}
            disabled={saving}
            className="w-full py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal'] font-medium hover:bg-[#AD8A4E] transition disabled:opacity-60"
          >
            {saving ? 'جاري الحفظ...' : 'إضافة ملاحظة'}
          </button>
        </div>

        {notes.length === 0 && (
          <p className="font-['Tajawal'] text-center text-[#4A473F]">لا توجد ملاحظات بعد</p>
        )}

        {notes.map(renderNote)}
      </div>
    </div>
  )
}