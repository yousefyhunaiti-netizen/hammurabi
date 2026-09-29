'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'

type Note = {
  id: number
  lawyer_id: number
  title: string
  content: string
  category: string
  case_id: number | null
  is_task: boolean | null
  is_completed: boolean | null
  is_pinned: boolean | null
  reminder_date: string | null
  color: string | null
  created_at: string
}

type LegalCase = {
  id: number
  case_number: string
  client_name: string
}

const categories = ['مهمة', 'تذكير', 'محضر اجتماع', 'مكالمة هاتفية', 'استراتيجية', 'ملاحظة عامة']
const colorOptions = [
  { value: '', label: 'عادي', bg: '#F3EEE4' },
  { value: 'gold', label: 'مهم', bg: '#F0E6D2' },
  { value: 'green', label: 'منجز', bg: '#D9E5DC' },
  { value: 'red', label: 'عاجل', bg: '#F8EAEA' },
]

export default function LawyerNotesPage() {
  const [loading, setLoading] = useState(true)
  const [lawyerId, setLawyerId] = useState<number | null>(null)
  const [notAllowed, setNotAllowed] = useState(false)
  const [notSubscribed, setNotSubscribed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [totalUnread, setTotalUnread] = useState(0)

  const [view, setView] = useState('list')
  const [notes, setNotes] = useState<Note[]>([])
  const [cases, setCases] = useState<LegalCase[]>([])
  const [categoryFilter, setCategoryFilter] = useState('')
  const [draggedNoteId, setDraggedNoteId] = useState<number | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState(categories[0])
  const [caseId, setCaseId] = useState('')
  const [color, setColor] = useState('')
  const [reminderDay, setReminderDay] = useState('')
  const [reminderMonth, setReminderMonth] = useState('')
  const [reminderYear, setReminderYear] = useState('')
  const [saving, setSaving] = useState(false)

  const supabase = createClient()
  const router = useRouter()

  async function loadNotes(id: number) {
    const result = await supabase.from('lawyer_notes').select('*').eq('lawyer_id', id).order('created_at', { ascending: false })
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

      const casesResult = await supabase.from('legal_cases').select('id, case_number, client_name').eq('lawyer_id', lawyerResult.data.id)
      setCases(casesResult.data || [])

      const unreadResult = await supabase.from('lawyer_messages').select('id', { count: 'exact', head: true }).eq('recipient_lawyer_id', lawyerResult.data.id).eq('is_read', false)
      setTotalUnread(unreadResult.count || 0)

      await loadNotes(lawyerResult.data.id)
      setLoading(false)
    }

    loadData()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    setMenuOpen(false)
    router.push('/')
  }

  function toggleMenu() {
    setMenuOpen(!menuOpen)
  }

  function resetForm() {
    setTitle('')
    setContent('')
    setCategory(categories[0])
    setCaseId('')
    setColor('')
    setReminderDay('')
    setReminderMonth('')
    setReminderYear('')
  }

  async function syncReminderToCalendar(dateStr: string, noteTitle: string) {
    if (!lawyerId) return
    await supabase.from('personal_calendar').insert({
      lawyer_id: lawyerId,
      title: 'تذكير: ' + noteTitle,
      event_date: dateStr,
      time_slot: '',
      notes: 'من قسم الملاحظات',
    })
  }

  async function handleAddNote() {
    if (!title.trim() || !lawyerId) return
    setSaving(true)

    const reminderDateStr = (reminderDay && reminderMonth && reminderYear)
      ? reminderYear + '-' + reminderMonth.padStart(2, '0') + '-' + reminderDay.padStart(2, '0')
      : null

    await supabase.from('lawyer_notes').insert({
      lawyer_id: lawyerId,
      title: title,
      content: content,
      category: category,
      case_id: caseId ? Number(caseId) : null,
      is_task: category === 'مهمة',
      is_completed: false,
      is_pinned: false,
      reminder_date: reminderDateStr,
      color: color,
    })

    if (reminderDateStr) {
      await syncReminderToCalendar(reminderDateStr, title)
    }

    resetForm()
    setShowForm(false)
    await loadNotes(lawyerId)
    setSaving(false)
  }

  async function handleDeleteNote(id: number) {
    if (!lawyerId) return
    await supabase.from('lawyer_notes').delete().eq('id', id)
    await loadNotes(lawyerId)
  }

  async function handleTogglePin(note: Note) {
    if (!lawyerId) return
    await supabase.from('lawyer_notes').update({ is_pinned: !note.is_pinned }).eq('id', note.id)
    await loadNotes(lawyerId)
  }

  async function handleToggleComplete(note: Note) {
    if (!lawyerId) return
    await supabase.from('lawyer_notes').update({ is_completed: !note.is_completed }).eq('id', note.id)
    await loadNotes(lawyerId)
  }

  async function handleDropOnCategory(newCategory: string) {
    if (draggedNoteId === null || !lawyerId) return
    await supabase.from('lawyer_notes').update({ category: newCategory, is_task: newCategory === 'مهمة' }).eq('id', draggedNoteId)
    setDraggedNoteId(null)
    await loadNotes(lawyerId)
  }

  function getCaseLabel(id: number | null) {
    if (!id) return ''
    const found = cases.find(function (c) { return c.id === id })
    return found ? 'قضية ' + found.case_number + ' — ' + found.client_name : ''
  }

  function getColorBg(colorValue: string | null) {
    const found = colorOptions.find(function (c) { return c.value === (colorValue || '') })
    return found ? found.bg : '#F3EEE4'
  }

  const visibleNotes = notes
    .filter(function (n) { return categoryFilter ? n.category === categoryFilter : true })
    .sort(function (a, b) {
      const aPinned = a.is_pinned ? 1 : 0
      const bPinned = b.is_pinned ? 1 : 0
      if (aPinned !== bPinned) return bPinned - aPinned
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

  function renderNoteCard(note: Note, draggable: boolean) {
    function dragStart() {
      setDraggedNoteId(note.id)
    }

    function pinClick() {
      handleTogglePin(note)
    }

    function completeClick() {
      handleToggleComplete(note)
    }

    function deleteClick() {
      handleDeleteNote(note.id)
    }

    return (
      <div
        key={note.id}
        draggable={draggable}
        onDragStart={dragStart}
        style={{ backgroundColor: getColorBg(note.color) }}
        className="border border-[#D8D2C4] rounded-lg p-4 mb-3"
      >
        <div className="flex justify-between items-start mb-1">
          <div className="flex items-center gap-2">
            {note.is_task && (
              <input type="checkbox" checked={note.is_completed === true} onChange={completeClick} className="cursor-pointer" />
            )}
            <p className={"font-['Tajawal'] font-bold text-sm text-[#1B1A17] " + (note.is_completed ? 'line-through opacity-60' : '')}>{note.title}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={pinClick} className="cursor-pointer text-sm">{note.is_pinned ? '⭐' : '☆'}</button>
            <button onClick={deleteClick} className="cursor-pointer font-['Tajawal'] text-xs text-[#7A2E2E]">حذف</button>
          </div>
        </div>
        {note.content && <p className="font-['Tajawal'] text-xs text-[#4A473F] mb-2 whitespace-pre-wrap">{note.content}</p>}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2 py-0.5 bg-white/60 text-[#4A473F] text-xs font-['Tajawal'] rounded-full">{note.category}</span>
          {note.case_id && <span className="font-['Tajawal'] text-xs text-[#AD8A4E]">{getCaseLabel(note.case_id)}</span>}
          {note.reminder_date && <span className="font-['Tajawal'] text-xs text-[#7A2E2E]">🔔 {note.reminder_date}</span>}
        </div>
      </div>
    )
  }

  function renderKanban() {
    function dragOver(e: React.DragEvent) {
      e.preventDefault()
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {categories.map(function (cat) {
          const catNotes = visibleNotes.filter(function (n) { return n.category === cat })

          function dropHandler() {
            handleDropOnCategory(cat)
          }

          return (
            <div key={cat} onDragOver={dragOver} onDrop={dropHandler} className="bg-[#F3EEE4] rounded-lg p-3 min-h-[150px]">
              <h3 className="font-['Tajawal'] font-bold text-sm text-[#1B1A17] mb-3 text-center">{cat} ({catNotes.length})</h3>
              {catNotes.map(function (n) { return renderNoteCard(n, true) })}
            </div>
          )
        })}
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
            <h1 className="font-['Tajawal'] font-bold text-2xl text-[#1B1A17] mb-3">يلزم الاشتراك للوصول إلى الملاحظات</h1>
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
          <h1 className="font-['Tajawal'] font-bold text-4xl mb-2">ملاحظاتي ({notes.length})</h1>
          <p className="font-['Tajawal'] text-sm text-[#D8D2C4]">مهام، تذكيرات، محاضر اجتماعات، وأفكار — كلها في مكان واحد ومرتبطة بقضاياك</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
          <div className="flex bg-white border border-[#D8D2C4] rounded-md p-1 w-fit">
            <button onClick={function () { setView('list') }} className={"px-5 py-2 rounded font-['Tajawal'] text-sm font-medium transition " + (view === 'list' ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'text-[#4A473F]')}>قائمة</button>
            <button onClick={function () { setView('kanban') }} className={"px-5 py-2 rounded font-['Tajawal'] text-sm font-medium transition " + (view === 'kanban' ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'text-[#4A473F]')}>كانبان</button>
          </div>

          {view === 'list' && (
            <select value={categoryFilter} onChange={function (e) { setCategoryFilter(e.target.value) }} className="px-4 py-2 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]">
              <option value="">كل التصنيفات</option>
              {categories.map(function (c) { return <option key={c} value={c}>{c}</option> })}
            </select>
          )}

          <button onClick={function () { resetForm(); setShowForm(!showForm) }} className="px-5 py-2 bg-[#AD8A4E] text-white rounded-md font-['Tajawal'] text-sm">
            {showForm ? 'إلغاء' : '+ إضافة'}
          </button>
        </div>

        {showForm && (
          <div className="bg-white border-2 border-[#AD8A4E] rounded-lg p-6 mb-6 space-y-3">
            <input type="text" value={title} onChange={function (e) { setTitle(e.target.value) }} placeholder="العنوان" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
            <select value={category} onChange={function (e) { setCategory(e.target.value) }} className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]">
              {categories.map(function (c) { return <option key={c} value={c}>{c}</option> })}
            </select>
            <textarea value={content} onChange={function (e) { setContent(e.target.value) }} rows={3} placeholder="التفاصيل" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
            <select value={caseId} onChange={function (e) { setCaseId(e.target.value) }} className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]">
              <option value="">ربط بقضية (اختياري)</option>
              {cases.map(function (c) { return <option key={c.id} value={c.id}>قضية {c.case_number} — {c.client_name}</option> })}
            </select>

            <div>
              <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-1">تاريخ التذكير (اختياري، يوم/شهر/سنة)</label>
              <div className="grid grid-cols-3 gap-2">
                <input type="number" value={reminderDay} onChange={function (e) { setReminderDay(e.target.value) }} placeholder="يوم" min="1" max="31" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
                <input type="number" value={reminderMonth} onChange={function (e) { setReminderMonth(e.target.value) }} placeholder="شهر" min="1" max="12" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
                <input type="number" value={reminderYear} onChange={function (e) { setReminderYear(e.target.value) }} placeholder="سنة" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
              </div>
            </div>

            <div>
              <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-1">اللون</label>
              <div className="flex gap-2">
                {colorOptions.map(function (c) {
                  return (
                    <button
                      key={c.value}
                      type="button"
                      onClick={function () { setColor(c.value) }}
                      style={{ backgroundColor: c.bg }}
                      className={"px-3 py-2 rounded-md font-['Tajawal'] text-xs border-2 " + (color === c.value ? 'border-[#1B1A17]' : 'border-transparent')}
                    >
                      {c.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <button onClick={handleAddNote} disabled={saving} className="w-full py-3 bg-[#1B1A17] text-white rounded-md font-['Tajawal'] font-medium">
              {saving ? 'جاري الحفظ...' : 'حفظ'}
            </button>
          </div>
        )}

        {visibleNotes.length === 0 && !showForm && (
          <p className="font-['Tajawal'] text-center text-[#4A473F]">لا توجد ملاحظات مطابقة</p>
        )}

        {view === 'list' && visibleNotes.map(function (n) { return renderNoteCard(n, false) })}
        {view === 'kanban' && renderKanban()}
      </div>
    </div>
  )
}