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

const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
const dayLabels = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت']

export default function LawyerCalendarPage() {
  const [loading, setLoading] = useState(true)
  const [lawyerId, setLawyerId] = useState<number | null>(null)
  const [notAllowed, setNotAllowed] = useState(false)
  const [personalEvents, setPersonalEvents] = useState<PersonalEvent[]>([])
  const [appEvents, setAppEvents] = useState<AppEvent[]>([])

  const [viewMonth, setViewMonth] = useState(new Date().getMonth())
  const [viewYear, setViewYear] = useState(new Date().getFullYear())
  const [selectedDay, setSelectedDay] = useState('')

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

  function formatDateStr(year: number, month: number, day: number) {
    const mm = String(month + 1).padStart(2, '0')
    const dd = String(day).padStart(2, '0')
    return year + '-' + mm + '-' + dd
  }

  function getDayEvents(dateStr: string) {
    const personal = personalEvents.filter(function (e) { return e.event_date === dateStr })
    const app = appEvents.filter(function (e) { return e.appointment_date === dateStr })
    return { personal: personal, app: app }
  }

  function changeMonth(direction: number) {
    let newMonth = viewMonth + direction
    let newYear = viewYear
    if (newMonth < 0) {
      newMonth = 11
      newYear = newYear - 1
    }
    if (newMonth > 11) {
      newMonth = 0
      newYear = newYear + 1
    }
    setViewMonth(newMonth)
    setViewYear(newYear)
    setSelectedDay('')
  }

  function buildCalendarGrid() {
    const firstOfMonth = new Date(viewYear, viewMonth, 1)
    const startWeekday = firstOfMonth.getDay()
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

    const cells: (number | null)[] = []
    for (let i = 0; i < startWeekday; i++) {
      cells.push(null)
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(d)
    }
    while (cells.length % 7 !== 0) {
      cells.push(null)
    }

    const weeks: (number | null)[][] = []
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7))
    }
    return weeks
  }

  const weeks = buildCalendarGrid()

  function dayClick(day: number) {
    const dateStr = formatDateStr(viewYear, viewMonth, day)
    setSelectedDay(dateStr)
    setEventDate(dateStr)
  }

  function renderDayCell(day: number | null, weekIndex: number, dayIndex: number) {
    const key = weekIndex + '-' + dayIndex

    if (!day) {
      return <div key={key} className="aspect-square"></div>
    }

    const dateStr = formatDateStr(viewYear, viewMonth, day)
    const dayEvents = getDayEvents(dateStr)
    const hasPersonal = dayEvents.personal.length > 0
    const hasApp = dayEvents.app.length > 0
    const isSelected = selectedDay === dateStr

    function clickHandler() {
      dayClick(day)
    }

    return (
      <button
        key={key}
        onClick={clickHandler}
        className={
          "aspect-square rounded-md flex flex-col items-center justify-center relative font-['Tajawal'] text-sm transition " +
          (isSelected ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'bg-white hover:bg-[#F3EEE4] text-[#1B1A17] border border-[#D8D2C4]')
        }
      >
        <span>{day}</span>
        {(hasPersonal || hasApp) && (
          <div className="flex gap-1 mt-1">
            {hasApp && <span className="w-1.5 h-1.5 rounded-full bg-[#2F4538]"></span>}
            {hasPersonal && <span className="w-1.5 h-1.5 rounded-full bg-[#AD8A4E]"></span>}
          </div>
        )}
      </button>
    )
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
  const selectedDayEvents = selectedDay ? getDayEvents(selectedDay) : null

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
          <div className="flex items-center justify-between mb-4">
            <button onClick={function () { changeMonth(-1) }} className="px-3 py-2 bg-[#F3EEE4] rounded-md font-['Tajawal'] text-sm">السابق</button>
            <p className="font-['Tajawal'] font-bold text-[#1B1A17]">{monthNames[viewMonth]} {viewYear}</p>
            <button onClick={function () { changeMonth(1) }} className="px-3 py-2 bg-[#F3EEE4] rounded-md font-['Tajawal'] text-sm">التالي</button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {dayLabels.map(function (label) {
              return <p key={label} className="text-center font-['Tajawal'] text-xs text-[#4A473F]">{label}</p>
            })}
          </div>

          <div className="space-y-1">
            {weeks.map(function (week, weekIndex) {
              return (
                <div key={weekIndex} className="grid grid-cols-7 gap-1">
                  {week.map(function (day, dayIndex) {
                    return renderDayCell(day, weekIndex, dayIndex)
                  })}
                </div>
              )
            })}
          </div>

          <div className="flex gap-4 mt-4 pt-4 border-t border-[#D8D2C4]">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#2F4538]"></span>
              <span className="font-['Tajawal'] text-xs text-[#4A473F]">مواعيد التطبيق</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#AD8A4E]"></span>
              <span className="font-['Tajawal'] text-xs text-[#4A473F]">مواعيد شخصية</span>
            </div>
          </div>
        </div>

        {selectedDay && selectedDayEvents && (
          <div className="bg-white border-2 border-[#AD8A4E] rounded-lg p-6 mb-6">
            <h2 className="font-['Tajawal'] font-bold text-[#1B1A17] mb-3">{selectedDay}</h2>

            {selectedDayEvents.app.length === 0 && selectedDayEvents.personal.length === 0 && (
              <p className="font-['Tajawal'] text-sm text-[#4A473F] mb-3">لا توجد مواعيد في هذا اليوم</p>
            )}

            {selectedDayEvents.app.map(function (a) {
              const typeLabel = a.consultation_type === 'video' ? 'موعد (فيديو)' : 'موعد (حضوري)'
              return (
                <div key={a.id} className="bg-[#2F4538] text-white rounded-md p-3 mb-2">
                  <p className="font-['Tajawal'] text-sm">{typeLabel} - {a.time_slot}</p>
                </div>
              )
            })}

            {selectedDayEvents.personal.map(function (p) {
              function deleteClick() {
                handleDeleteEvent(p.id)
              }
              return (
                <div key={p.id} className="flex justify-between items-center bg-[#F3EEE4] rounded-md p-3 mb-2">
                  <div>
                    <p className="font-['Tajawal'] text-sm text-[#1B1A17]">{p.title}</p>
                    <p className="font-['Tajawal'] text-xs text-[#4A473F]">{p.time_slot}</p>
                  </div>
                  <button onClick={deleteClick} className="font-['Tajawal'] text-xs text-[#7A2E2E]">حذف</button>
                </div>
              )
            })}
          </div>
        )}

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
          <h2 className="font-['Tajawal'] font-bold text-[#1B1A17] mb-4">قائمة جميع المواعيد</h2>
          {combinedList.length === 0 && (
            <p className="font-['Tajawal'] text-sm text-[#4A473F] text-center">لا توجد مواعيد</p>
          )}
          {combinedList.map(renderCombinedRow)}
        </div>
      </div>
    </div>
  )
}