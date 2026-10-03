'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'
import { getLawyerBadgeCount, getFirmBadgeCount } from '../lib/badges'
import Footer from '../components/Footer'
import WorkspaceSwitch from '../components/WorkspaceSwitch'
import HeaderLines from '../components/HeaderLines'
import Loader from '../components/Loader'
import DateFields from '../components/DateFields'

type PersonalEvent = {
  id: number
  lawyer_id: number
  title: string
  event_date: string
  time_slot: string
  notes: string | null
}

type AppEvent = {
  id: number
  lawyer_id: number | null
  firm_id: number | null
  specialty_id: number | null
  appointment_date: string
  time_slot: string
  status: string
  consultation_type: string | null
  meeting_link: string | null
}

type CombinedEvent = {
  source: string
  title: string
  date: string
  time: string
}

type RosterLawyer = {
  id: number
  full_name: string
  specialty_id: number | null
}

type Specialty = {
  id: number
  name_ar: string
}

const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
const dayLabels = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت']

export default function LawyerCalendarPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [accountType, setAccountType] = useState<'lawyer' | 'firm'>('lawyer')
  const [accountId, setAccountId] = useState<number | null>(null)
  const [lawyerFirmId, setLawyerFirmId] = useState<number | null>(null)
  const [lawyerSpecialtyId, setLawyerSpecialtyId] = useState<number | null>(null)
  const [notAllowed, setNotAllowed] = useState(false)
  const [notSubscribed, setNotSubscribed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [totalUnread, setTotalUnread] = useState(0)
  const [pendingConsultations, setPendingConsultations] = useState(0)
  const [personalEvents, setPersonalEvents] = useState<PersonalEvent[]>([])
  const [appEvents, setAppEvents] = useState<AppEvent[]>([])
  const [roster, setRoster] = useState<RosterLawyer[]>([])
  const [specialties, setSpecialties] = useState<Specialty[]>([])
  const [filter, setFilter] = useState('all')

  const [viewMonth, setViewMonth] = useState(new Date().getMonth())
  const [viewYear, setViewYear] = useState(new Date().getFullYear())
  const [modalDay, setModalDay] = useState('')

  const [title, setTitle] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [timeSlot, setTimeSlot] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const supabase = createClient()
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(function () {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return function () {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  function countConversations(rows: any[]) {
    const senders = new Set(rows.map(function (m) {
      return m.sender_lawyer_id ? 'lawyer-' + m.sender_lawyer_id : 'firm-' + m.sender_firm_id
    }))
    return senders.size
  }

  async function loadAll(type: 'lawyer' | 'firm', id: number, rosterIds: number[], anonFirmId: number | null, anonSpecialtyId: number | null) {
    if (type === 'lawyer') {
      const personalResult = await supabase.from('personal_calendar').select('*').eq('lawyer_id', id).order('event_date', { ascending: true })

      let lawyerAppFilter = 'lawyer_id.eq.' + id
      if (anonFirmId && anonSpecialtyId) {
        lawyerAppFilter = lawyerAppFilter + ',and(lawyer_id.is.null,firm_id.eq.' + anonFirmId + ',specialty_id.eq.' + anonSpecialtyId + ')'
      }
      const appResult = await supabase.from('appointments').select('*').or(lawyerAppFilter).neq('status', 'cancelled').order('appointment_date', { ascending: true })

      setPersonalEvents(personalResult.data || [])
      setAppEvents(appResult.data || [])
      return
    }

    let appFilter = 'firm_id.eq.' + id
    if (rosterIds.length > 0) {
      appFilter = appFilter + ',lawyer_id.in.(' + rosterIds.join(',') + ')'
    }
    const firmAppResult = await supabase.from('appointments').select('*').or(appFilter).neq('status', 'cancelled').order('appointment_date', { ascending: true })
    setAppEvents(firmAppResult.data || [])

    if (rosterIds.length > 0) {
      const firmPersonalResult = await supabase.from('personal_calendar').select('*').in('lawyer_id', rosterIds).order('event_date', { ascending: true })
      setPersonalEvents(firmPersonalResult.data || [])
    } else {
      setPersonalEvents([])
    }
  }

  useEffect(function () {
    async function loadData() {
      const userResult = await supabase.auth.getUser()

      if (!userResult.data.user) {
        setNotAllowed(true)
        setLoading(false)
        return
      }

      const userId = userResult.data.user.id

      const lawyerResult = await supabase.from('lawyers').select('id, is_active, is_comped, firm_id, specialty_id').eq('user_id', userId).maybeSingle()

      if (lawyerResult.data) {
        if (!lawyerResult.data.is_active && !lawyerResult.data.is_comped) {
          setNotSubscribed(true)
          setLoading(false)
          return
        }

        const myFirmId: number | null = lawyerResult.data.firm_id || null
        const mySpecialtyId: number | null = lawyerResult.data.specialty_id || null

        setAccountType('lawyer')
        setAccountId(lawyerResult.data.id)
        setLawyerFirmId(myFirmId)
        setLawyerSpecialtyId(mySpecialtyId)

        const unreadResult = await supabase.from('lawyer_messages').select('sender_lawyer_id, sender_firm_id').eq('recipient_lawyer_id', lawyerResult.data.id).eq('is_read', false)
        setTotalUnread(countConversations(unreadResult.data || []))

        setPendingConsultations(await getLawyerBadgeCount(supabase, lawyerResult.data.id))

        await loadAll('lawyer', lawyerResult.data.id, [], myFirmId, mySpecialtyId)
        setLoading(false)
        return
      }

      const firmResult = await supabase.from('firms').select('*').eq('user_id', userId).maybeSingle()

      if (!firmResult.data) {
        setNotAllowed(true)
        setLoading(false)
        return
      }

      const firmRow: any = firmResult.data

      if (!firmRow.is_active && !firmRow.is_comped) {
        setNotSubscribed(true)
        setLoading(false)
        return
      }

      setAccountType('firm')
      setAccountId(firmRow.id)

      const specialtiesResult = await supabase.from('specialties').select('*')
      setSpecialties(specialtiesResult.data || [])

      const rosterResult = await supabase.from('lawyers').select('id, full_name, specialty_id').eq('firm_id', firmRow.id)
      const rosterRows: RosterLawyer[] = rosterResult.data || []
      setRoster(rosterRows)
      const rosterIds = rosterRows.map(function (l) { return l.id })

      const firmUnreadResult = await supabase.from('lawyer_messages').select('sender_lawyer_id, sender_firm_id').eq('recipient_firm_id', firmRow.id).eq('is_read', false)
      setTotalUnread(countConversations(firmUnreadResult.data || []))

      setPendingConsultations(await getFirmBadgeCount(supabase, firmRow.id))

      await loadAll('firm', firmRow.id, rosterIds, null, null)
      setLoading(false)
    }

    loadData()

    // Switching between firm work and private work reloads this page's data in place.
    function onWorkspaceChange() { loadData() }
    window.addEventListener('hm:workspace', onWorkspaceChange)
    return function () {
      window.removeEventListener('hm:workspace', onWorkspaceChange)
    }
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    setMenuOpen(false)
    router.push('/')
  }

  function toggleMenu() {
    setMenuOpen(!menuOpen)
  }

  async function handleAddEvent() {
    if (!title.trim() || !eventDate || !accountId || accountType !== 'lawyer') return
    setSaving(true)

    await supabase.from('personal_calendar').insert({
      lawyer_id: accountId,
      title: title,
      event_date: eventDate,
      time_slot: timeSlot,
      notes: notes,
    })

    setTitle('')
    setEventDate('')
    setTimeSlot('')
    setNotes('')
    await loadAll('lawyer', accountId, [], lawyerFirmId, lawyerSpecialtyId)
    setSaving(false)
  }

  async function handleDeleteEvent(eventId: number) {
    if (!accountId || accountType !== 'lawyer') return
    await supabase.from('personal_calendar').delete().eq('id', eventId)
    await loadAll('lawyer', accountId, [], lawyerFirmId, lawyerSpecialtyId)
  }

  function getLawyerName(id: number | null) {
    if (!id) return ''
    const found = roster.find(function (l) { return l.id === id })
    return found ? found.full_name : ''
  }

  function getSpecialtyName(id: number | null) {
    if (!id) return ''
    const found = specialties.find(function (s) { return s.id === id })
    return found ? found.name_ar : ''
  }

  function getAppOwnerLabel(a: AppEvent) {
    if (a.lawyer_id) return getLawyerName(a.lawyer_id)

    const matching = roster.filter(function (l) { return !!a.specialty_id && l.specialty_id === a.specialty_id })
    if (matching.length > 0) {
      return matching.map(function (l) { return l.full_name }).join('، ')
    }

    const specialtyName = getSpecialtyName(a.specialty_id)
    return 'لا يوجد محامي بهذا الاختصاص' + (specialtyName ? ' - ' + specialtyName : '')
  }

  function appVisible(a: AppEvent) {
    if (accountType !== 'firm' || filter === 'all') return true
    const selected = roster.find(function (l) { return String(l.id) === filter })
    if (!selected) return true
    if (a.lawyer_id) return a.lawyer_id === selected.id
    return !!selected.specialty_id && a.specialty_id === selected.specialty_id
  }

  function personalVisible(p: PersonalEvent) {
    if (accountType !== 'firm' || filter === 'all') return true
    return p.lawyer_id === Number(filter)
  }

  function formatDateStr(year: number, month: number, day: number) {
    const mm = String(month + 1).padStart(2, '0')
    const dd = String(day).padStart(2, '0')
    return year + '-' + mm + '-' + dd
  }

  function getDayEvents(dateStr: string) {
    const personal = personalEvents.filter(function (e) { return e.event_date === dateStr && personalVisible(e) })
    const app = appEvents.filter(function (e) { return e.appointment_date === dateStr && appVisible(e) })
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
    setModalDay('')
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
    setModalDay(dateStr)
    setEventDate(dateStr)
  }

  function renderDayCell(day: number | null, weekIndex: number, dayIndex: number) {
    const key = weekIndex + '-' + dayIndex

    if (!day) {
      return <div key={key} className="aspect-square"></div>
    }

    const dayValue: number = day
    const dateStr = formatDateStr(viewYear, viewMonth, dayValue)
    const dayEvents = getDayEvents(dateStr)
    const hasPersonal = dayEvents.personal.length > 0
    const hasApp = dayEvents.app.length > 0

    function clickHandler() {
      dayClick(dayValue)
    }

    return (
      <button
        key={key}
        onClick={clickHandler}
        className="aspect-square rounded-md flex flex-col items-center justify-center relative font-['Tajawal'] text-sm transition bg-white border border-[#D8D2C4] text-[#1B1A17] hover:bg-[#F3EEE4]"
      >
        <span>{day}</span>
        {(hasPersonal || hasApp) && (
          <div className="flex gap-1 mt-1">
            {hasApp && <span className="w-2 h-2 rounded-full bg-[#2F4538]"></span>}
            {hasPersonal && <span className="w-2 h-2 rounded-full bg-[#AD8A4E]"></span>}
          </div>
        )}
      </button>
    )
  }

  function buildCombinedList() {
    const combined: CombinedEvent[] = []

    for (let i = 0; i < personalEvents.length; i++) {
      if (!personalVisible(personalEvents[i])) continue
      const personalOwner = accountType === 'firm' ? getLawyerName(personalEvents[i].lawyer_id) : ''
      combined.push({
        source: 'personal',
        title: personalEvents[i].title + (personalOwner ? ' — ' + personalOwner : ''),
        date: personalEvents[i].event_date,
        time: personalEvents[i].time_slot || '',
      })
    }

    for (let i = 0; i < appEvents.length; i++) {
      if (!appVisible(appEvents[i])) continue
      const typeLabel = appEvents[i].consultation_type === 'video' ? 'موعد (فيديو)' : 'موعد (حضوري)'
      const appOwner = accountType === 'firm' ? getAppOwnerLabel(appEvents[i]) : ''
      combined.push({
        source: 'app',
        title: typeLabel + (appOwner ? ' — ' + appOwner : ''),
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

  function renderCombinedRow(item: CombinedEvent, index: number) {
    const isApp = item.source === 'app'
    return (
      <div key={index} className={"flex justify-between items-center rounded-md p-3 mb-2 " + (isApp ? 'bg-[#2F4538] text-white' : 'bg-white border border-[#D8D2C4]')}>
        <p className={"font-['Tajawal'] text-sm " + (isApp ? 'text-white' : 'text-[#1B1A17]')}>{item.title}</p>
        <p className={"font-['Tajawal'] text-xs " + (isApp ? 'text-[#D8D2C4]' : 'text-[#4A473F]')}>{item.date} - {item.time}</p>
      </div>
    )
  }

  function renderDayModal() {
    if (!modalDay) return null

    const dayEvents = getDayEvents(modalDay)

    function closeModal() {
      setModalDay('')
    }

    function stopPropagation(e: React.MouseEvent) {
      e.stopPropagation()
    }

    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4" onClick={closeModal}>
        <div className="bg-white rounded-lg max-w-lg w-full max-h-[85vh] overflow-y-auto p-6" onClick={stopPropagation}>
          <div className="flex justify-between items-center mb-5">
            <h2 className="font-['Tajawal'] font-bold text-xl text-[#1B1A17]">{modalDay}</h2>
            <button type="button" onClick={closeModal} className="cursor-pointer font-['Tajawal'] text-[#4A473F] text-2xl leading-none">×</button>
          </div>

          {dayEvents.app.length === 0 && dayEvents.personal.length === 0 && (
            <p className="font-['Tajawal'] text-sm text-[#4A473F] mb-4">لا توجد مواعيد في هذا اليوم</p>
          )}

          {dayEvents.app.length > 0 && (
            <div className="mb-5">
              <h3 className="font-['Tajawal'] font-bold text-sm text-[#1B1A17] mb-2">مواعيد التطبيق</h3>
              {dayEvents.app.map(function (a) {
                const typeLabel = a.consultation_type === 'video' ? 'عبر الفيديو' : 'حضوري'
                const ownerLabel = accountType === 'firm' ? getAppOwnerLabel(a) : ''
                return (
                  <div key={a.id} className="bg-[#2F4538] text-white rounded-md p-4 mb-2">
                    <p className="font-['Tajawal'] font-bold text-sm mb-1">{typeLabel} - {a.time_slot}</p>
                    {ownerLabel && (
                      <p className="font-['Tajawal'] text-xs text-[#D8D2C4] mb-1">{ownerLabel}</p>
                    )}
                    {a.consultation_type === 'video' && a.meeting_link && (
                      <a href={a.meeting_link} target="_blank" rel="noopener noreferrer" className="font-['Tajawal'] text-xs text-[#D8D2C4] underline break-all">
                        {a.meeting_link}
                      </a>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {dayEvents.personal.length > 0 && (
            <div>
              <h3 className="font-['Tajawal'] font-bold text-sm text-[#1B1A17] mb-2">مواعيد شخصية</h3>
              {dayEvents.personal.map(function (p) {
                function deleteClick() {
                  handleDeleteEvent(p.id)
                }
                const personalOwner = accountType === 'firm' ? getLawyerName(p.lawyer_id) : ''
                return (
                  <div key={p.id} className="flex justify-between items-start bg-[#F3EEE4] rounded-md p-4 mb-2">
                    <div>
                      <p className="font-['Tajawal'] font-bold text-sm text-[#1B1A17]">{p.title}</p>
                      {personalOwner && <p className="font-['Tajawal'] text-xs text-[#4A473F] mb-1">{personalOwner}</p>}
                      <p className="font-['Tajawal'] text-xs text-[#4A473F] mb-1">{p.time_slot}</p>
                      {p.notes && <p className="font-['Tajawal'] text-xs text-[#4A473F]">{p.notes}</p>}
                    </div>
                    {accountType === 'lawyer' && (
                      <button type="button" onClick={deleteClick} className="cursor-pointer font-['Tajawal'] text-xs text-[#7A2E2E] flex-shrink-0">حذف</button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div dir="rtl" className="min-h-screen pattern-bg flex items-center justify-center">
        <Loader />
      </div>
    )
  }

  if (notAllowed) {
    return (
      <div dir="rtl" className="min-h-screen pattern-bg flex items-center justify-center px-6">
        <div className="text-center">
          <p className="font-['Tajawal'] text-[#4A473F] mb-4">هذه الصفحة مخصصة لحسابات المحامين والمكاتب فقط</p>
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
            <h1 className="font-['Tajawal'] font-bold text-2xl text-[#1B1A17] mb-3">يلزم الاشتراك للوصول إلى الأجندة</h1>
            <p className="font-['Tajawal'] text-sm text-[#4A473F] leading-relaxed mb-6">
              يرجى الاشتراك في إحدى الباقات المتاحة أولاً.
            </p>
            <a href="/subscription" className="inline-block px-6 py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal']">
              عرض خطط الاشتراك
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div dir="rtl" className="min-h-screen pattern-bg flex flex-col">
      <div className="hm-header bg-[#1B1A17] text-[#F3EEE4] py-12 px-6">
        <HeaderLines />
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-8 font-['Tajawal'] text-sm">
            <a href="/">
              <img src="/logo.png" alt="حمورابي" className="h-12 w-auto" />
            </a>
            <div className="flex gap-5 items-center">
              {accountType === 'firm' && (
                <a href="/firm-dashboard" className="hover:text-[#AD8A4E] transition">لوحة التحكم</a>
              )}
              <a href="/lawyer-tools" className="hover:text-[#AD8A4E] transition">أدواتي</a>
              <a href="/ai-assistant" className="hover:text-[#AD8A4E] transition">مساعد ذكي</a>
              <a href="/community" className="hover:text-[#AD8A4E] transition">المجتمع</a>
              <a href="/lawyer-messages" className="relative hover:text-[#AD8A4E] transition">
                <svg className="w-5 h-5 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
                {totalUnread > 0 && (
                  <span className="absolute -top-2 -left-2 bg-[#7A2E2E] text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{totalUnread}</span>
                )}
              </a>
              <div className="relative" ref={menuRef}>
                <button onClick={toggleMenu} className="relative w-8 h-8 rounded-full bg-[#AD8A4E] flex items-center justify-center hover:bg-[#c49b58] transition">
                  <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.5c-3.3 0-9.8 1.6-9.8 4.9v2.4h19.6v-2.4c0-3.3-6.5-4.9-9.8-4.9z" />
                  </svg>
                  {pendingConsultations > 0 && (
                    <span className="absolute -top-1 -left-1 bg-[#7A2E2E] text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{pendingConsultations}</span>
                  )}
                </button>
                {menuOpen && (
                  <div className="absolute left-0 top-full mt-2 w-52 bg-white border border-[#D8D2C4] rounded-md shadow-lg overflow-hidden z-20">
                    <a href="/subscription" className="block px-4 py-3 font-['Tajawal'] text-sm text-[#1B1A17] hover:bg-[#F3EEE4] transition">
                      ترقية الاشتراك
                    </a>
                    <a href={accountType === 'firm' ? '/firm-info' : '/lawyer-info'} className="block px-4 py-3 font-['Tajawal'] text-sm text-[#1B1A17] hover:bg-[#F3EEE4] transition border-t border-[#D8D2C4]">
                      معلوماتي الشخصية
                    </a>
                    <a href="/lawyer-history" className="relative block px-4 py-3 font-['Tajawal'] text-sm text-[#1B1A17] hover:bg-[#F3EEE4] transition border-t border-[#D8D2C4]">
                      المواعيد والاستشارات
                      {pendingConsultations > 0 && (
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 bg-[#7A2E2E] text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{pendingConsultations}</span>
                      )}
                    </a>
                    <button onClick={handleLogout} className="w-full text-right px-4 py-3 font-['Tajawal'] text-sm text-[#7A2E2E] hover:bg-[#F3EEE4] transition border-t border-[#D8D2C4]">
                      تسجيل الخروج
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <h1 className="font-['Tajawal'] font-bold text-4xl mb-2">أجندتي</h1>
          <div className="w-16 h-[2px] bg-[#AD8A4E]"></div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10 flex-1 w-full">
        {accountType === 'lawyer' && <WorkspaceSwitch />}

        {accountType === 'firm' && (
          <div className="bg-white border border-[#D8D2C4] rounded-lg p-4 mb-6">
            <select
              value={filter}
              onChange={function (e) { setFilter(e.target.value); setModalDay('') }}
              className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
            >
              <option value="all">جميع المحامين</option>
              {roster.map(function (l) {
                return <option key={l.id} value={String(l.id)}>{l.full_name}</option>
              })}
            </select>
          </div>
        )}

        <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <button onClick={function () { changeMonth(-1) }} className="px-3 py-2 bg-[#F3EEE4] text-[#1B1A17] hover:bg-[#D8D2C4] transition rounded-md font-['Tajawal'] text-sm">السابق</button>
            <p className="font-['Tajawal'] font-bold text-[#1B1A17]">{monthNames[viewMonth]} {viewYear}</p>
            <button onClick={function () { changeMonth(1) }} className="px-3 py-2 bg-[#F3EEE4] text-[#1B1A17] hover:bg-[#D8D2C4] transition rounded-md font-['Tajawal'] text-sm">التالي</button>
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

        {accountType === 'lawyer' && (
          <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-6">
            <h2 className="font-['Tajawal'] font-bold text-[#1B1A17] mb-3">إضافة موعد شخصي</h2>
            <div className="space-y-3">
              <input type="text" value={title} onChange={function (e) { setTitle(e.target.value) }} placeholder="العنوان" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-start">
                <DateFields value={eventDate} onChange={setEventDate} tone="paper" />
                <input type="time" value={timeSlot} onChange={function (e) { setTimeSlot(e.target.value) }} className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
              </div>
              <textarea value={notes} onChange={function (e) { setNotes(e.target.value) }} rows={2} placeholder="ملاحظات" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
              <button onClick={handleAddEvent} disabled={saving} className="w-full py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal'] font-medium hover:bg-[#AD8A4E] transition disabled:opacity-60">
                {saving ? 'جاري الإضافة...' : 'إضافة'}
              </button>
            </div>
          </div>
        )}

        <div className="bg-white border border-[#D8D2C4] rounded-lg p-6">
          <h2 className="font-['Tajawal'] font-bold text-[#1B1A17] mb-4">قائمة جميع المواعيد</h2>
          {combinedList.length === 0 && (
            <p className="font-['Tajawal'] text-sm text-[#4A473F] text-center">لا توجد مواعيد</p>
          )}
          {combinedList.map(renderCombinedRow)}
        </div>
      </div>

      {renderDayModal()}

      <Footer variant={accountType === 'firm' ? 'firm' : 'lawyer'} />
    </div>
  )
}