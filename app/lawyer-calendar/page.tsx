'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase'

type PersonalEvent = {
  id: number
  title: string
  event_date: string
  time_slot: string
  notes: string | null
}

type AppEvent = {
  id: number
  appointment_date: string
  time_slot: string
  status: string
  consultation_type: string | null
}

type CombinedEvent = {
  source: string
  title: string
  date: string
  time: string
}

export default function LawyerCalendarPage() {
  const [loading, setLoading] = useState(true)
  const [lawyerId, setLawyerId] = useState<number | null>(null)
  const [notAllowed, setNotAllowed] = useState(false)
  const [personalEvents, setPersonalEvents] = useState<PersonalEvent[]>([])
  const [appEvents, setAppEvents] = useState<AppEvent[]>([])

  const [title, setTitle] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [timeSlot, setTimeSlot] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const supabase = createClient()

  async function loadAll(id: number) {
    const personalResult = await supabase.from('personal_calendar').select('*').eq('lawyer_id', id).order('event_date', { ascending: true })
    const appResult = await supabase.from('appointments').select('*').eq('lawyer_id', id).neq('status', 'cancelled').order('appointment_date', { ascending: true })
    setPersonalEvents(personalResult.data || [])
    setAppEvents(appResult.data || [])
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
      await loadAll(lawyerResult.data.id)
      setLoading(false)
    }

    loadData()
  }, [])

  async function handleAddEvent() {
    if (!title.trim() || !eventDate || !lawyerId) return
    setSaving(true)

    await supabase.from('personal_calendar').insert({
      lawyer_id: lawyerId,
      title: title,
      event_date: eventDate,
      time_slot: timeSlot,
      notes: notes,
    })

    setTitle('')
    setEventDate('')
    setTimeSlot('')
    setNotes('')
    await loadAll(lawyerId)
    setSaving(false)
  }

  async function handleDeleteEvent(eventId: number) {
    if (!lawyerId) return
    await supabase.from('personal_calendar').delete().eq('id', eventId)
    await loadAll(lawyerId)
  }

  function buildCombinedList() {
    const combined: CombinedEvent[] = []

    for (let i = 0; i < personalEvents.length; i++) {
      combined.push({
        source: 'personal',
        title: personalEvents[i].title,
        date: personalEvents[i].event_date,
        time: personalEvents[i].time_slot || '',
      })
    }

    for (let i = 0; i < appEvents.length; i++) {
      const typeLabel = appEvents[i].consultation_type === 'video' ? 'موعد (فيديو)' : 'موعد (حضوري)'
      combined.push({
        source: 'app',
        title: typeLabel,
        date: appEvents[i].appointment_date,
        time: appEvents[i].time_slot,
      })
    }

    combined.sort(function (a, b) {
      return a.date.localeCompare(b.date)
    })

    return combined
  }

  const combinedList = buildCombinedList()

  function renderPersonalEventRow(event: PersonalEvent) {
    function deleteClick() {
      handleDeleteEvent(event.id)
    }

    return (
      <div key={event.id} className="flex justify-between items-center bg-[#F3EEE4] rounded-md p-3 mb-2">
        <div>
          <p className="font-['Tajawal'] text-sm text-[#1B1A17]">{event.title}</p>
          <p className="font-['Tajawal'] text-xs text-[#4A473F]">{event.event_date} - {event.time_slot}</p>
        </div>
        <button onClick={deleteClick} className="font-['Tajawal'] text-xs text-[#7A2E2E]">حذف</button>
      </div>
    )
  }

  function renderCombinedRow(item: CombinedEvent, index: number) {
    const isApp = item.source === 'app'
    return (
      <div key={index} className={"flex justify-between items-center rounded-md p-3 mb-2 " + (isApp ? 'bg-[#2F4538] text-white' : 'bg-white border border-[#D8D2C4]')}>
        <p className={"font-['Tajawal'] text-sm " + (isApp ? 'text-white' : 'text-[#1B1A17]')}>{item.title}</p>
        <p className={"font-['Tajawal'] text-xs " + (isApp ? 'text-[#D8D2C4]' : 'text-[#4A473F]')}>{item.date} - {item.time}</p>
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
          <h1 className="font-['Amiri'] text-4xl mb-2">أجندتي</h1>
          <div className="w-16 h-[2px] bg-[#AD8A4E]"></div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-6">
          <h2 className="font-['Tajawal'] font-bold text-[#1B1A17] mb-3">إضافة موعد شخصي</h2>
          <div className="space-y-3">
            <input type="text" value={title} onChange={function (e) { setTitle(e.target.value) }} placeholder="العنوان" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
            <div className="grid grid-cols-2 gap-3">
              <input type="date" value={eventDate} onChange={function (e) { setEventDate(e.target.value) }} className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
              <input type="time" value={timeSlot} onChange={function (e) { setTimeSlot(e.target.value) }} className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
            </div>
            <textarea value={notes} onChange={function (e) { setNotes(e.target.value) }} rows={2} placeholder="ملاحظات" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
            <button onClick={handleAddEvent} disabled={saving} className="w-full py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal'] font-medium hover:bg-[#AD8A4E] transition disabled:opacity-60">
              {saving ? 'جاري الإضافة...' : 'إضافة'}
            </button>
          </div>
        </div>

        <div className="bg-white border border-[#D8D2C4] rounded-lg p-6">
          <h2 className="font-['Tajawal'] font-bold text-[#1B1A17] mb-4">جميع المواعيد (تطبيق + شخصية)</h2>
          {combinedList.length === 0 && (
            <p className="font-['Tajawal'] text-sm text-[#4A473F] text-center">لا توجد مواعيد</p>
          )}
          {combinedList.map(renderCombinedRow)}
        </div>
      </div>
    </div>
  )
}