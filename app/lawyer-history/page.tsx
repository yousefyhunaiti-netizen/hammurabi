'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'
import { markAppointmentsSeen } from '../lib/badges'
import Footer from '../components/Footer'

type Appointment = {
  id: number
  customer_id: string
  lawyer_id: number | null
  firm_id: number | null
  specialty_id: number | null
  appointment_date: string
  time_slot: string
  status: string
  consultation_type: string | null
  created_at: string
}

type Consultation = {
  id: number
  customer_id: string
  lawyer_id: number | null
  firm_id: number | null
  specialty_id: number | null
  question: string
  status: string
  answer: string | null
  fee: number | null
  created_at: string
}

type CustomerName = {
  user_id: string
  full_name: string
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

export default function LawyerHistoryPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [accountType, setAccountType] = useState<'lawyer' | 'firm'>('lawyer')
  const [accountId, setAccountId] = useState<number | null>(null)
  const [notAllowed, setNotAllowed] = useState(false)
  const [notSubscribed, setNotSubscribed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [totalUnread, setTotalUnread] = useState(0)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [customerNames, setCustomerNames] = useState<CustomerName[]>([])
  const [roster, setRoster] = useState<RosterLawyer[]>([])
  const [specialties, setSpecialties] = useState<Specialty[]>([])
  const [filter, setFilter] = useState('all')
  const [tab, setTab] = useState('appointments')
  const [search, setSearch] = useState('')
  const [monthFilter, setMonthFilter] = useState('')
  const [dayFilter, setDayFilter] = useState('')
  const [lastSeenAppointments, setLastSeenAppointments] = useState<string | null>(null)

  const [selectedConsultation, setSelectedConsultation] = useState<Consultation | null>(null)
  const [answerText, setAnswerText] = useState('')
  const [feeText, setFeeText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')

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

  useEffect(function () {
    async function loadData() {
      const userResult = await supabase.auth.getUser()

      if (!userResult.data.user) {
        setNotAllowed(true)
        setLoading(false)
        return
      }

      const userId = userResult.data.user.id

      let apptData: Appointment[] = []
      let consultData: Consultation[] = []

      const lawyerResult = await supabase.from('lawyers').select('id, is_active, is_comped, firm_id, specialty_id').eq('user_id', userId).maybeSingle()

      if (lawyerResult.data) {
        if (!lawyerResult.data.is_active && !lawyerResult.data.is_comped) {
          setNotSubscribed(true)
          setLoading(false)
          return
        }

        setAccountType('lawyer')
        setAccountId(lawyerResult.data.id)

        const seenResult = await supabase.from('lawyers').select('last_seen_appointments_at').eq('id', lawyerResult.data.id).maybeSingle()
        setLastSeenAppointments(seenResult.data ? seenResult.data.last_seen_appointments_at : null)

        const unreadResult = await supabase.from('lawyer_messages').select('sender_lawyer_id, sender_firm_id').eq('recipient_lawyer_id', lawyerResult.data.id).eq('is_read', false)
        setTotalUnread(countConversations(unreadResult.data || []))

        let lawyerAppFilter = 'lawyer_id.eq.' + lawyerResult.data.id
        if (lawyerResult.data.firm_id && lawyerResult.data.specialty_id) {
          lawyerAppFilter = lawyerAppFilter + ',and(lawyer_id.is.null,firm_id.eq.' + lawyerResult.data.firm_id + ',specialty_id.eq.' + lawyerResult.data.specialty_id + ')'
        }

        const apptResult = await supabase
          .from('appointments')
          .select('*')
          .or(lawyerAppFilter)
          .order('appointment_date', { ascending: false })

        const consultResult = await supabase
          .from('consultations')
          .select('*')
          .eq('lawyer_id', lawyerResult.data.id)
          .order('created_at', { ascending: false })

        apptData = apptResult.data || []
        consultData = consultResult.data || []
      } else {
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
        setLastSeenAppointments(firmRow.last_seen_appointments_at || null)

        const specialtiesResult = await supabase.from('specialties').select('*')
        setSpecialties(specialtiesResult.data || [])

        const rosterResult = await supabase.from('lawyers').select('id, full_name, specialty_id').eq('firm_id', firmRow.id)
        const rosterRows: RosterLawyer[] = rosterResult.data || []
        setRoster(rosterRows)
        const rosterIds = rosterRows.map(function (l) { return l.id })

        const firmUnreadResult = await supabase.from('lawyer_messages').select('sender_lawyer_id, sender_firm_id').eq('recipient_firm_id', firmRow.id).eq('is_read', false)
        setTotalUnread(countConversations(firmUnreadResult.data || []))

        let firmFilter = 'firm_id.eq.' + firmRow.id
        if (rosterIds.length > 0) {
          firmFilter = firmFilter + ',lawyer_id.in.(' + rosterIds.join(',') + ')'
        }

        const apptResult = await supabase
          .from('appointments')
          .select('*')
          .or(firmFilter)
          .order('appointment_date', { ascending: false })

        const consultResult = await supabase
          .from('consultations')
          .select('*')
          .or(firmFilter)
          .order('created_at', { ascending: false })

        apptData = apptResult.data || []
        consultData = consultResult.data || []
      }

      setAppointments(apptData)
      setConsultations(consultData)

      // Opening this page clears the "new booking" part of the badge on every page
      markAppointmentsSeen(supabase)

      const allCustomerIds = Array.from(new Set(
        apptData.map(function (a: Appointment) { return a.customer_id })
          .concat(consultData.map(function (c: Consultation) { return c.customer_id }))
      ))

      if (allCustomerIds.length > 0) {
        const namesResult = await supabase.from('customers').select('user_id, full_name').in('user_id', allCustomerIds)
        setCustomerNames(namesResult.data || [])
      }

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

  function getCustomerName(userId: string) {
    const found = customerNames.find(function (c) { return c.user_id === userId })
    return found ? found.full_name : 'عميل'
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

  function getAppOwnerIds(a: Appointment) {
    if (a.lawyer_id) return [a.lawyer_id]
    if (!a.specialty_id) return []
    return roster.filter(function (l) { return l.specialty_id === a.specialty_id }).map(function (l) { return l.id })
  }

  function getAppOwnerLabel(a: Appointment) {
    const ownerIds = getAppOwnerIds(a)
    if (ownerIds.length > 0) {
      return ownerIds.map(getLawyerName).filter(Boolean).join('، ')
    }
    const specialtyName = getSpecialtyName(a.specialty_id)
    return 'لا يوجد محامي بهذا الاختصاص' + (specialtyName ? ' - ' + specialtyName : '')
  }

  function getConsultOwnerLabel(c: Consultation) {
    if (c.lawyer_id) return getLawyerName(c.lawyer_id)
    return 'غير مُسندة بعد'
  }

  function getStatusLabel(status: string) {
    if (status === 'pending') return 'بانتظار الرد'
    if (status === 'answered') return 'تمت الإجابة'
    if (status === 'paid') return 'مدفوعة'
    if (status === 'needs_meeting') return 'يحتاج موعداً'
    return status
  }

  function getAppointmentStatusLabel(status: string) {
    if (status === 'confirmed') return 'مؤكد'
    if (status === 'completed') return 'مكتمل'
    if (status === 'cancelled') return 'ملغى'
    return status
  }

  function isNewAppointment(a: Appointment) {
    if (!lastSeenAppointments || !a.created_at) return false
    return new Date(a.created_at).getTime() > new Date(lastSeenAppointments).getTime()
  }

  function formatDateDisplay(dateStr: string) {
    const datePart = dateStr.split('T')[0]
    const parts = datePart.split('-')
    if (parts.length !== 3) return dateStr
    return parts[2] + '/' + parts[1] + '/' + parts[0]
  }

  function appVisible(a: Appointment) {
    if (accountType !== 'firm' || filter === 'all') return true
    const ownerIds = getAppOwnerIds(a)
    if (filter === 'unassigned') return ownerIds.length === 0
    return ownerIds.indexOf(Number(filter)) !== -1
  }

  function consultVisible(c: Consultation) {
    if (accountType !== 'firm' || filter === 'all') return true
    if (filter === 'unassigned') return !c.lawyer_id
    return c.lawyer_id === Number(filter)
  }

  function matchesDateFilter(dateStr: string) {
    if (!monthFilter) return true
    const datePart = dateStr.split('T')[0]
    if (!datePart.startsWith(monthFilter)) return false
    if (dayFilter) {
      const dayOfMonth = String(Number(datePart.split('-')[2]))
      if (dayOfMonth !== dayFilter) return false
    }
    return true
  }

  const pendingConsultations = consultations.filter(function (c) { return c.status === 'pending' }).length

  const filteredAppointments = appointments.filter(function (a) {
    if (!appVisible(a)) return false
    if (!matchesDateFilter(a.appointment_date)) return false
    if (!search.trim()) return true
    return getCustomerName(a.customer_id).toLowerCase().indexOf(search.toLowerCase()) !== -1
  })

  const filteredConsultations = consultations.filter(function (c) {
    if (!consultVisible(c)) return false
    if (!matchesDateFilter(c.created_at)) return false
    if (!search.trim()) return true
    const nameMatch = getCustomerName(c.customer_id).toLowerCase().indexOf(search.toLowerCase()) !== -1
    const questionMatch = c.question.toLowerCase().indexOf(search.toLowerCase()) !== -1
    return nameMatch || questionMatch
  })

  function openConsultation(c: Consultation) {
    setSelectedConsultation(c)
    setAnswerText(c.answer || '')
    setFeeText(c.fee ? String(c.fee) : '')
    setSendError('')
  }

  function closeConsultation() {
    setSelectedConsultation(null)
    setSendError('')
  }

  async function handleSend() {
    if (!selectedConsultation || !accountId || accountType !== 'lawyer') return
    setSendError('')

    if (!answerText.trim()) {
      setSendError('يرجى كتابة الإجابة أولاً')
      return
    }

    if (feeText.trim() === '' || isNaN(Number(feeText)) || Number(feeText) < 0) {
      setSendError('يرجى إدخال المبلغ (رقم صحيح أو صفر)')
      return
    }

    setSending(true)

    const feeValue = Number(feeText)
    const answerValue = answerText.trim()
    const consultationId = selectedConsultation.id

    const updateResult = await supabase
      .from('consultations')
      .update({ answer: answerValue, fee: feeValue, status: 'answered' })
      .eq('id', consultationId)
      .eq('lawyer_id', accountId)
      .select('id')

    setSending(false)

    if (updateResult.error || !updateResult.data || updateResult.data.length === 0) {
      setSendError('تعذر إرسال الإجابة، حاول مرة أخرى')
      return
    }

    setConsultations(consultations.map(function (c) {
      if (c.id === consultationId) {
        return { ...c, answer: answerValue, fee: feeValue, status: 'answered' }
      }
      return c
    }))
    setSelectedConsultation(null)
  }

  // The consultation needs more than a written answer: the customer is asked to book
  // an appointment instead and pays nothing for the consultation.
  async function handleRecommendMeeting() {
    if (!selectedConsultation || !accountId || accountType !== 'lawyer') return
    setSendError('')
    setSending(true)

    const noteValue = answerText.trim() || null
    const consultationId = selectedConsultation.id

    const updateResult = await supabase
      .from('consultations')
      .update({ answer: noteValue, fee: 0, status: 'needs_meeting' })
      .eq('id', consultationId)
      .eq('lawyer_id', accountId)
      .select('id')

    setSending(false)

    if (updateResult.error || !updateResult.data || updateResult.data.length === 0) {
      setSendError('تعذر إرسال التوصية، حاول مرة أخرى')
      return
    }

    setConsultations(consultations.map(function (c) {
      if (c.id === consultationId) {
        return { ...c, answer: noteValue, fee: 0, status: 'needs_meeting' }
      }
      return c
    }))
    setSelectedConsultation(null)
  }

  function renderAppointment(a: Appointment) {
    const typeLabel = a.consultation_type === 'video' ? 'فيديو' : 'حضوري'
    return (
      <div key={a.id} className={"bg-white border rounded-lg p-4 mb-3 " + (isNewAppointment(a) ? 'border-[#AD8A4E]' : 'border-[#D8D2C4]')}>
        <div className="flex items-center gap-2 mb-1">
          <p className="font-['Tajawal'] font-bold text-sm text-[#1B1A17]">{getCustomerName(a.customer_id)}</p>
          {isNewAppointment(a) && (
            <span className="px-2 py-0.5 bg-[#AD8A4E] text-white text-[10px] font-['Tajawal'] rounded-full">جديد</span>
          )}
        </div>
        <p className="font-['Tajawal'] text-xs text-[#4A473F]">{formatDateDisplay(a.appointment_date)} - {a.time_slot} ({typeLabel})</p>
        {accountType === 'firm' && (
          <p className="font-['Tajawal'] text-xs text-[#4A473F] mt-1">{getAppOwnerLabel(a)}</p>
        )}
        <p className={"font-['Tajawal'] text-xs mt-1 " + (a.status === 'cancelled' ? 'text-[#7A2E2E]' : 'text-[#AD8A4E]')}>{getAppointmentStatusLabel(a.status)}</p>
      </div>
    )
  }

  function renderConsultation(c: Consultation) {
    function cardClick() {
      openConsultation(c)
    }
    return (
      <div key={c.id} onClick={cardClick} className="cursor-pointer bg-white border border-[#D8D2C4] rounded-lg p-4 mb-3 hover:border-[#AD8A4E] transition">
        <p className="font-['Tajawal'] font-bold text-sm text-[#1B1A17] mb-1">{getCustomerName(c.customer_id)}</p>
        <p className="font-['Tajawal'] text-sm text-[#4A473F] mb-1 line-clamp-2">{c.question}</p>
        {accountType === 'firm' && (
          <p className="font-['Tajawal'] text-xs text-[#4A473F] mb-1">{getConsultOwnerLabel(c)}</p>
        )}
        <p className="font-['Tajawal'] text-xs text-[#AD8A4E]">{getStatusLabel(c.status)}</p>
      </div>
    )
  }

  function renderConsultationModal() {
    if (!selectedConsultation) return null

    const c = selectedConsultation
    const canAnswer = accountType === 'lawyer' && c.lawyer_id === accountId && c.status === 'pending'
    const hasAnswer = c.status === 'answered' || c.status === 'paid'

    function stopPropagation(e: React.MouseEvent) {
      e.stopPropagation()
    }

    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4" onClick={closeConsultation}>
        <div className="bg-white rounded-lg max-w-lg w-full max-h-[85vh] overflow-y-auto p-6" onClick={stopPropagation}>
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="font-['Tajawal'] font-bold text-xl text-[#1B1A17]">{getCustomerName(c.customer_id)}</h2>
              <p className="font-['Tajawal'] text-xs text-[#4A473F] mt-1">{formatDateDisplay(c.created_at)} - {getStatusLabel(c.status)}</p>
              {accountType === 'firm' && (
                <p className="font-['Tajawal'] text-xs text-[#4A473F] mt-1">{getConsultOwnerLabel(c)}</p>
              )}
            </div>
            <button type="button" onClick={closeConsultation} className="cursor-pointer font-['Tajawal'] text-[#4A473F] text-2xl leading-none">×</button>
          </div>

          <div className="bg-[#F3EEE4] rounded-md p-4 mb-4">
            <p className="font-['Tajawal'] font-bold text-sm text-[#1B1A17] mb-2">السؤال</p>
            <p className="font-['Tajawal'] text-sm text-[#4A473F] leading-relaxed whitespace-pre-wrap">{c.question}</p>
          </div>

          {canAnswer && (
            <div>
              <p className="font-['Tajawal'] font-bold text-sm text-[#1B1A17] mb-2">إجابتك</p>
              <textarea
                value={answerText}
                onChange={function (e) { setAnswerText(e.target.value) }}
                rows={6}
                placeholder="اكتب إجابتك هنا..."
                className="w-full px-3 py-2 mb-3 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
              />
              <p className="font-['Tajawal'] font-bold text-sm text-[#1B1A17] mb-2">المبلغ المطلوب من العميل (دينار أردني)</p>
              <input
                type="number"
                min="0"
                value={feeText}
                onChange={function (e) { setFeeText(e.target.value) }}
                placeholder="0"
                className="w-full px-3 py-2 mb-3 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
              />
              {sendError && (
                <p className="font-['Tajawal'] text-sm text-[#7A2E2E] mb-3">{sendError}</p>
              )}
              <button
                onClick={handleSend}
                disabled={sending}
                className="w-full py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal'] font-medium hover:bg-[#AD8A4E] transition disabled:opacity-60"
              >
                {sending ? 'جاري الإرسال...' : 'إرسال الإجابة للعميل'}
              </button>
              <p className="font-['Tajawal'] text-xs text-[#4A473F] mt-2">بعد الإرسال لا يمكن تعديل الإجابة.</p>

              <div className="mt-5 pt-4 border-t border-[#D8D2C4]">
                <p className="font-['Tajawal'] text-xs text-[#4A473F] leading-relaxed mb-3">
                  هل تحتاج المسألة دراسة أعمق من إجابة مكتوبة؟ أوصِ العميل بحجز موعد بدلاً من الإجابة، ولن يدفع رسوم الاستشارة. ما تكتبه في خانة الإجابة يصله كملاحظة.
                </p>
                <button
                  onClick={handleRecommendMeeting}
                  disabled={sending}
                  className="w-full py-3 bg-white border border-[#AD8A4E] text-[#AD8A4E] rounded-md font-['Tajawal'] font-medium hover:bg-[#F3EEE4] transition disabled:opacity-60"
                >
                  التوصية بحجز موعد
                </button>
              </div>
            </div>
          )}

          {!canAnswer && hasAnswer && (
            <div className="bg-[#2F4538] text-white rounded-md p-4">
              <p className="font-['Tajawal'] font-bold text-sm mb-2">الإجابة المرسلة</p>
              <p className="font-['Tajawal'] text-sm leading-relaxed whitespace-pre-wrap mb-3">{c.answer}</p>
              <p className="font-['Tajawal'] text-xs text-[#D8D2C4]">المبلغ: {c.fee || 0} دينار{c.status === 'paid' ? ' - مدفوعة' : ' - بانتظار الدفع'}</p>
            </div>
          )}

          {!canAnswer && c.status === 'needs_meeting' && (
            <div className="bg-[#F3EEE4] border border-[#AD8A4E] rounded-md p-4">
              <p className="font-['Tajawal'] font-bold text-sm text-[#1B1A17] mb-2">تمت التوصية بحجز موعد</p>
              {c.answer && (
                <p className="font-['Tajawal'] text-sm text-[#4A473F] leading-relaxed whitespace-pre-wrap">{c.answer}</p>
              )}
            </div>
          )}

          {!canAnswer && c.status === 'pending' && (
            <div className="bg-[#F3EEE4] border border-[#D8D2C4] rounded-md p-4">
              {!c.lawyer_id ? (
                <p className="font-['Tajawal'] text-sm text-[#4A473F]">
                  لم تُسند هذه الاستشارة إلى محامي بعد. يمكنك إسنادها من <a href="/firm-dashboard" className="text-[#AD8A4E] underline">لوحة التحكم</a>.
                </p>
              ) : (
                <p className="font-['Tajawal'] text-sm text-[#4A473F]">بانتظار إجابة المحامي المسؤول.</p>
              )}
            </div>
          )}
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
            <h1 className="font-['Tajawal'] font-bold text-2xl text-[#1B1A17] mb-3">يلزم الاشتراك للوصول إلى المواعيد والاستشارات</h1>
            <a href="/subscription" className="inline-block mt-4 px-6 py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal']">عرض خطط الاشتراك</a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div dir="rtl" className="min-h-screen pattern-bg flex flex-col">
      <div className="bg-[#1B1A17] text-[#F3EEE4] py-12 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-8 font-['Tajawal'] text-sm">
            <a href="/"><img src="/logo.png" alt="حمورابي" className="h-12 w-auto" /></a>
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
                  <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.5c-3.3 0-9.8 1.6-9.8 4.9v2.4h19.6v-2.4c0-3.3-6.5-4.9-9.8-4.9z" /></svg>
                  {pendingConsultations > 0 && (
                    <span className="absolute -top-1 -left-1 bg-[#7A2E2E] text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{pendingConsultations}</span>
                  )}
                </button>
                {menuOpen && (
                  <div className="absolute left-0 top-full mt-2 w-52 bg-white border border-[#D8D2C4] rounded-md shadow-lg overflow-hidden z-20">
                    <a href="/subscription" className="block px-4 py-3 font-['Tajawal'] text-sm text-[#1B1A17] hover:bg-[#F3EEE4] transition">ترقية الاشتراك</a>
                    <a href={accountType === 'firm' ? '/firm-info' : '/lawyer-info'} className="block px-4 py-3 font-['Tajawal'] text-sm text-[#1B1A17] hover:bg-[#F3EEE4] transition border-t border-[#D8D2C4]">معلوماتي الشخصية</a>
                    <a href="/lawyer-history" className="relative block px-4 py-3 font-['Tajawal'] text-sm text-[#1B1A17] hover:bg-[#F3EEE4] transition border-t border-[#D8D2C4]">
                      المواعيد والاستشارات
                      {pendingConsultations > 0 && (
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 bg-[#7A2E2E] text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{pendingConsultations}</span>
                      )}
                    </a>
                    <button onClick={handleLogout} className="w-full text-right px-4 py-3 font-['Tajawal'] text-sm text-[#7A2E2E] hover:bg-[#F3EEE4] transition border-t border-[#D8D2C4]">تسجيل الخروج</button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <h1 className="font-['Tajawal'] font-bold text-4xl mb-2">المواعيد والاستشارات</h1>
          <p className="font-['Tajawal'] text-sm text-[#D8D2C4]">كل مواعيدك واستشاراتك عبر حمورابي في مكان واحد</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10 flex-1 w-full">
        {accountType === 'firm' && (
          <select
            value={filter}
            onChange={function (e) { setFilter(e.target.value) }}
            className="w-full px-3 py-2 mb-4 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
          >
            <option value="all">جميع المحامين</option>
            {roster.map(function (l) {
              return <option key={l.id} value={String(l.id)}>{l.full_name}</option>
            })}
            <option value="unassigned">غير مُسندة</option>
          </select>
        )}

        <div className="flex bg-white border border-[#D8D2C4] rounded-md p-1 mb-4 w-fit">
          <button
            onClick={function () { setTab('appointments') }}
            className={"px-5 py-2 rounded font-['Tajawal'] text-sm font-medium transition " + (tab === 'appointments' ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'text-[#4A473F]')}
          >
            المواعيد
          </button>
          <button
            onClick={function () { setTab('consultations') }}
            className={"px-5 py-2 rounded font-['Tajawal'] text-sm font-medium transition " + (tab === 'consultations' ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'text-[#4A473F]')}
          >
            الاستشارات
          </button>
        </div>

        <input
          type="text"
          value={search}
          onChange={function (e) { setSearch(e.target.value) }}
          placeholder="ابحث بالاسم..."
          className="w-full px-3 py-2 mb-3 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
        />

        <div className="flex gap-2 mb-4">
          <input
            type="month"
            value={monthFilter}
            onChange={function (e) { setMonthFilter(e.target.value) }}
            className="flex-1 px-3 py-2 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
          />
          <input
            type="number"
            value={dayFilter}
            onChange={function (e) { setDayFilter(e.target.value) }}
            placeholder="يوم (اختياري)"
            min="1"
            max="31"
            className="w-32 px-3 py-2 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
          />
        </div>

        {tab === 'appointments' && (
          <div>
            {filteredAppointments.length === 0 && (
              <p className="font-['Tajawal'] text-center text-[#4A473F]">لا توجد مواعيد</p>
            )}
            {filteredAppointments.map(renderAppointment)}
          </div>
        )}

        {tab === 'consultations' && (
          <div>
            {filteredConsultations.length === 0 && (
              <p className="font-['Tajawal'] text-center text-[#4A473F]">لا توجد استشارات</p>
            )}
            {filteredConsultations.map(renderConsultation)}
          </div>
        )}
      </div>

      {renderConsultationModal()}

      <Footer variant={accountType === 'firm' ? 'firm' : 'lawyer'} />
    </div>
  )
}