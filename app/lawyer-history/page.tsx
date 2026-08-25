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
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [customerNames, setCustomerNames] = useState<CustomerName[]>([])
  const [tab, setTab] = useState('appointments')
  const [search, setSearch] = useState('')

  const supabase = createClient()

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

  function getCustomerName(userId: string) {
    const found = customerNames.find(function (c) { return c.user_id === userId })
    return found ? found.full_name : 'عميل'
  }

  const filteredAppointments = appointments.filter(function (a) {
    if (!search.trim()) return true
    return getCustomerName(a.customer_id).toLowerCase().indexOf(search.toLowerCase()) !== -1
  })

  const filteredConsultations = consultations.filter(function (c) {
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

  return (
    <div dir="rtl" className="min-h-screen pattern-bg">
      <div className="bg-[#1B1A17] text-[#F3EEE4] py-12 px-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="font-['Amiri'] text-4xl mb-2">السجل</h1>
          <div className="w-16 h-[2px] bg-[#AD8A4E]"></div>
        </div>
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
          className="w-full px-3 py-2 mb-4 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
        />

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