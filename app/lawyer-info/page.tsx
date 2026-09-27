'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'
import Footer from '../components/Footer'

type Lawyer = {
  id: number
  full_name: string
  bio: string | null
  specialty_id: number | null
  city: string | null
  address: string | null
  phone: string | null
  email: string | null
  consultation_fee: number | null
  hourly_rate_range: string | null
  years_experience: number | null
  bar_certificate_number: string | null
  working_days: string | null
  working_hours_start: string | null
  working_hours_end: string | null
  vacation_until: string | null
  firm_id: number | null
  pending_firm_id: number | null
}

type Specialty = {
  id: number
  name_ar: string
}

const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

export default function LawyerInfoPage() {
  const [loading, setLoading] = useState(true)
  const [lawyer, setLawyer] = useState<Lawyer | null>(null)
  const [specialty, setSpecialty] = useState<Specialty | null>(null)
  const [notLawyer, setNotLawyer] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [firmName, setFirmName] = useState('')
  const [pendingFirmName, setPendingFirmName] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [totalUnread, setTotalUnread] = useState(0)
  const [pendingConsultations, setPendingConsultations] = useState(0)

  const supabase = createClient()
  const router = useRouter()
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

  async function loadLawyerData() {
    const userResult = await supabase.auth.getUser()

    if (!userResult.data.user) {
      setNotLawyer(true)
      setLoading(false)
      return
    }

    const lawyerResult = await supabase
      .from('lawyers')
      .select('*')
      .eq('user_id', userResult.data.user.id)
      .maybeSingle()

    if (!lawyerResult.data) {
      setNotLawyer(true)
      setLoading(false)
      return
    }

    setLawyer(lawyerResult.data)

    const unreadResult = await supabase.from('lawyer_messages').select('sender_lawyer_id, sender_firm_id').eq('recipient_lawyer_id', lawyerResult.data.id).eq('is_read', false)
    setTotalUnread(countConversations(unreadResult.data || []))

    const pendingResult = await supabase.from('consultations').select('id', { count: 'exact', head: true }).eq('lawyer_id', lawyerResult.data.id).eq('status', 'pending')
    setPendingConsultations(pendingResult.count || 0)

    if (lawyerResult.data.specialty_id) {
      const specialtyResult = await supabase
        .from('specialties')
        .select('*')
        .eq('id', lawyerResult.data.specialty_id)
        .single()
      setSpecialty(specialtyResult.data)
    }

    if (lawyerResult.data.firm_id) {
      const firmResult = await supabase.from('firms').select('firm_name').eq('id', lawyerResult.data.firm_id).single()
      setFirmName(firmResult.data ? firmResult.data.firm_name : '')
    } else {
      setFirmName('')
    }

    if (lawyerResult.data.pending_firm_id) {
      const pendingFirmResult = await supabase.from('firms').select('firm_name').eq('id', lawyerResult.data.pending_firm_id).single()
      setPendingFirmName(pendingFirmResult.data ? pendingFirmResult.data.firm_name : '')
    } else {
      setPendingFirmName('')
    }

    setLoading(false)
  }

  useEffect(function () {
    loadLawyerData()
  }, [])

  async function handleAcceptInvite() {
    if (!lawyer || !lawyer.pending_firm_id) return
    setInviteLoading(true)

    await supabase.from('lawyers').update({ firm_id: lawyer.pending_firm_id, pending_firm_id: null }).eq('id', lawyer.id)

    setInviteLoading(false)
    await loadLawyerData()
  }

  async function handleDeclineInvite() {
    if (!lawyer) return
    setInviteLoading(true)

    await supabase.from('lawyers').update({ pending_firm_id: null }).eq('id', lawyer.id)

    setInviteLoading(false)
    await loadLawyerData()
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setMenuOpen(false)
    router.push('/')
  }

  function toggleMenu() {
    setMenuOpen(!menuOpen)
  }

  function formatDateDisplay(dateStr: string) {
    const datePart = dateStr.split('T')[0]
    const parts = datePart.split('-')
    if (parts.length !== 3) return dateStr
    return parts[2] + '/' + parts[1] + '/' + parts[0]
  }

  function renderSectionTitle(text: string) {
    return (
      <div className="flex items-center gap-2 mb-3">
        <span className="w-1 h-5 bg-[#AD8A4E] rounded"></span>
        <h2 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17]">{text}</h2>
      </div>
    )
  }

  function renderRow(label: string, value: string, ltr?: boolean) {
    return (
      <div className="flex justify-between items-start gap-4 py-3 border-b border-[#F3EEE4] last:border-b-0">
        <p className="font-['Tajawal'] text-sm text-[#4A473F] flex-shrink-0">{label}</p>
        <p dir={ltr ? 'ltr' : undefined} className={"font-['Tajawal'] text-sm text-[#1B1A17] font-medium " + (ltr ? 'text-left' : 'text-right')}>{value}</p>
      </div>
    )
  }

  function renderStat(label: string, value: string, ltr?: boolean) {
    return (
      <div className="bg-[#F3EEE4] rounded-md p-3 text-center">
        <p dir={ltr ? 'ltr' : undefined} className="font-['Tajawal'] font-bold text-[#1B1A17] break-all">{value}</p>
        <p className="font-['Tajawal'] text-xs text-[#4A473F] mt-1">{label}</p>
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

  if (notLawyer || !lawyer) {
    return (
      <div dir="rtl" className="min-h-screen pattern-bg flex items-center justify-center px-6">
        <div className="text-center">
          <p className="font-['Tajawal'] text-[#4A473F] mb-4">هذه الصفحة مخصصة لحسابات المحامين فقط</p>
          <a href="/login" className="inline-block px-6 py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal']">تسجيل الدخول</a>
        </div>
      </div>
    )
  }

  const specialtyName = specialty ? specialty.name_ar : ''
  const workingDaysList = (lawyer.working_days || '').split(',').filter(function (d) { return d !== '' }).map(function (d) { return Number(d) })
  const hoursStart = lawyer.working_hours_start ? lawyer.working_hours_start.slice(0, 5) : ''
  const hoursEnd = lawyer.working_hours_end ? lawyer.working_hours_end.slice(0, 5) : ''

  return (
    <div dir="rtl" className="min-h-screen pattern-bg flex flex-col">
      <div className="bg-[#1B1A17] text-[#F3EEE4] py-12 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-8 font-['Tajawal'] text-sm">
            <a href="/"><img src="/logo.png" alt="حمورابي" className="h-12 w-auto" /></a>
            <div className="flex gap-5 items-center">
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
                    <a href="/lawyer-info" className="block px-4 py-3 font-['Tajawal'] text-sm text-[#1B1A17] hover:bg-[#F3EEE4] transition border-t border-[#D8D2C4]">معلوماتي الشخصية</a>
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
          <h1 className="font-['Tajawal'] font-bold text-4xl mb-2">معلوماتي الشخصية</h1>
          <div className="w-16 h-[2px] bg-[#AD8A4E]"></div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10 flex-1 w-full">
        {lawyer.pending_firm_id && (
          <div className="bg-white border-2 border-[#AD8A4E] rounded-lg p-6 mb-6">
            <h2 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mb-2">دعوة انضمام</h2>
            <p className="font-['Tajawal'] text-sm text-[#4A473F] mb-4">
              دعاك مكتب <strong>{pendingFirmName}</strong> للانضمام إليه على منصة حمورابي. عند القبول، سيظهر اسم المكتب مع اسمك، وستستمر بإدارة مواعيدك وأدواتك كالمعتاد.
            </p>
            <div className="flex gap-2">
              <button onClick={handleAcceptInvite} disabled={inviteLoading} className="flex-1 py-2 bg-[#2F4538] text-white rounded-md font-['Tajawal'] text-sm disabled:opacity-60">قبول</button>
              <button onClick={handleDeclineInvite} disabled={inviteLoading} className="flex-1 py-2 bg-[#D8D2C4] text-[#4A473F] rounded-md font-['Tajawal'] text-sm disabled:opacity-60">رفض</button>
            </div>
          </div>
        )}

        <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-6">
          <div className="flex items-center gap-5 mb-5">
            <div className="w-20 h-20 rounded-full bg-[#1B1A17] text-[#F3EEE4] flex items-center justify-center font-['Amiri'] text-3xl flex-shrink-0">
              {lawyer.full_name.charAt(0)}
            </div>
            <div>
              <h2 className="font-['Tajawal'] font-bold text-2xl text-[#1B1A17] mb-1">{lawyer.full_name}</h2>
              {specialtyName && (
                <p className="font-['Tajawal'] text-[#AD8A4E]">{specialtyName}</p>
              )}
              {lawyer.firm_id && firmName && (
                <p className="font-['Tajawal'] text-sm text-[#4A473F] mt-1">أنت جزء من مكتب <strong>{firmName}</strong></p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {renderStat('سنوات الخبرة', (lawyer.years_experience || 0) + ' سنة')}
            {renderStat('رسوم الاستشارة السريعة', lawyer.consultation_fee ? lawyer.consultation_fee + ' د.أ' : 'غير محدد')}
            {renderStat('الأجرة بالساعة', lawyer.hourly_rate_range || '-')}
            {renderStat('الرقم النقابي', lawyer.bar_certificate_number || '-', true)}
          </div>
        </div>

        <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-6">
          {renderSectionTitle('نبذة عني')}
          {lawyer.bio ? (
            <p className="font-['Tajawal'] text-sm text-[#4A473F] leading-relaxed whitespace-pre-wrap">{lawyer.bio}</p>
          ) : (
            <p className="font-['Tajawal'] text-sm text-[#B0AA9C]">لم تضف نبذة بعد</p>
          )}
        </div>

        <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-6">
          {renderSectionTitle('بيانات التواصل')}
          {renderRow('البريد الإلكتروني', lawyer.email || '-', true)}
          {renderRow('رقم الهاتف', lawyer.phone || '-', true)}
          {renderRow('المدينة', lawyer.city || '-')}
          {renderRow('العنوان', lawyer.address || '-')}
        </div>

        <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-6">
          {renderSectionTitle('أوقات العمل')}

          <div className="flex flex-wrap gap-2 mb-4">
            {dayNames.map(function (name, index) {
              const isWorking = workingDaysList.indexOf(index) !== -1
              return (
                <span
                  key={index}
                  className={"px-3 py-1 rounded-full font-['Tajawal'] text-xs " + (isWorking ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'bg-[#F3EEE4] text-[#B0AA9C]')}
                >
                  {name}
                </span>
              )
            })}
          </div>

          {renderRow('ساعات العمل', hoursStart && hoursEnd ? 'من ' + hoursStart + ' إلى ' + hoursEnd : '-')}

        </div>

        <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-6">
          {renderSectionTitle('الإجازة')}
          <div className={"flex items-center gap-3 rounded-md p-4 " + (lawyer.vacation_until ? 'bg-[#F3EEE4] border border-[#AD8A4E]' : 'bg-[#F3EEE4] border border-[#D8D2C4]')}>
            <span className={"w-3 h-3 rounded-full flex-shrink-0 " + (lawyer.vacation_until ? 'bg-[#AD8A4E]' : 'bg-[#B0AA9C]')}></span>
            <p className="font-['Tajawal'] text-sm text-[#1B1A17] font-medium">
              {lawyer.vacation_until ? 'في إجازة حتى ' + formatDateDisplay(lawyer.vacation_until) : 'غير محدد'}
            </p>
          </div>
          <p className="font-['Tajawal'] text-xs text-[#4A473F] mt-3">
            لتحديد إجازتك أو تعديلها، اضغط على <a href="/lawyer-dashboard" className="text-[#AD8A4E] underline">تعديل المعلومات</a>.
          </p>
        </div>

        <a href="/lawyer-dashboard" className="block w-full text-center py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal'] font-medium hover:bg-[#AD8A4E] transition mb-4">
          تعديل المعلومات
        </a>

        <div className="text-center">
          <a href="/change-password" className="font-['Tajawal'] text-sm text-[#AD8A4E] hover:underline">تغيير كلمة المرور</a>
        </div>
      </div>

      <Footer variant="lawyer" />
    </div>
  )
}