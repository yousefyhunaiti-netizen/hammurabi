'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase'

type Appointment = {
  id: number
  customer_id: string
  appointment_date: string
  time_slot: string
  status: string
  consultation_type: string | null
}

type Consultation = {
  id: number
  customer_id: string
  question: string
  status: string
  created_at: string
}

type CustomerName = {
  user_id: string
  full_name: string
}

export default function LawyerHistoryPage() {
  const [loading, setLoading] = useState(true)
  const [lawyerId, setLawyerId] = useState<number | null>(null)
  const [notAllowed, setNotAllowed] = useState(false)
  const [notSubscribed, setNotSubscribed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [customerNames, setCustomerNames] = useState<CustomerName[]>([])
  const [tab, setTab] = useState('appointments')
  const [search, setSearch] = useState('')
  const [monthFilter, setMonthFilter] = useState('')
  const [dayFilter, setDayFilter] = useState('')

  const supabase = createClient()

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

      const apptResult = await supabase
        .from('appointments')
        .select('*')
        .eq('lawyer_id', lawyerResult.data.id)
        .order('appointment_date', { ascending: false })

      const consultResult = await supabase
        .from('consultations')
        .select('*')
        .eq('lawyer_id', lawyerResult.data.id)
        .order('created_at', { ascending: false })

      const apptData = apptResult.data || []
      const consultData = consultResult.data || []

      setAppointments(apptData)
      setConsultations(consultData)

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
  }

  function toggleMenu() {
    setMenuOpen(!menuOpen)
  }

  function getCustomerName(userId: string) {
    const found = customerNames.find(function (c) { return c.user_id === userId })
    return found ? found.full_name : 'عميل'
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

  const filteredAppointments = appointments.filter(function (a) {
    if (!matchesDateFilter(a.appointment_date)) return false
    if (!search.trim()) return true
    return getCustomerName(a.customer_id).toLowerCase().indexOf(search.toLowerCase()) !== -1
  })

  const filteredConsultations = consultations.filter(function (c) {
    if (!matchesDateFilter(c.created_at)) return false
    if (!search.trim()) return true
    const nameMatch = getCustomerName(c.customer_id).toLowerCase().indexOf(search.toLowerCase()) !== -1
    const questionMatch = c.question.toLowerCase().indexOf(search.toLowerCase()) !== -1
    return nameMatch || questionMatch
  })

  function renderAppointment(a: Appointment) {
    const typeLabel = a.consultation_type === 'video' ? 'فيديو' : 'حضوري'
    return (
      <div key={a.id} className="bg-white border border-[#D8D2C4] rounded-lg p-4 mb-3">
        <p className="font-['Tajawal'] font-bold text-sm text-[#1B1A17] mb-1">{getCustomerName(a.customer_id)}</p>
        <p className="font-['Tajawal'] text-xs text-[#4A473F]">{a.appointment_date} - {a.time_slot} ({typeLabel})</p>
        <p className="font-['Tajawal'] text-xs text-[#AD8A4E] mt-1">{a.status}</p>
      </div>
    )
  }

  function renderConsultation(c: Consultation) {
    return (
      <div key={c.id} className="bg-white border border-[#D8D2C4] rounded-lg p-4 mb-3">
        <p className="font-['Tajawal'] font-bold text-sm text-[#1B1A17] mb-1">{getCustomerName(c.customer_id)}</p>
        <p className="font-['Tajawal'] text-sm text-[#4A473F] mb-1">{c.question}</p>
        <p className="font-['Tajawal'] text-xs text-[#AD8A4E]">{c.status}</p>
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
            <h1 className="font-['Amiri'] text-2xl text-[#1B1A17] mb-3">يلزم الاشتراك للوصول إلى السجل</h1>
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
              <a href="/lawyer-messages" className="hover:text-[#AD8A4E] transition">الرسائل</a>
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
          <h1 className="font-['Tajawal'] font-bold text-4xl mb-2">السجل</h1>
          <p className="font-['Tajawal'] text-sm text-[#D8D2C4]">مرجعك الكامل لكل موعد واستشارة سابقة تمت عبر حمورابي</p>        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10">
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
    </div>
  )
}