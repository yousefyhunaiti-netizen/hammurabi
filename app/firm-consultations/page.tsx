'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'
import Footer from '../components/Footer'
import HeaderLines from '../components/HeaderLines'
import Loader from '../components/Loader'

type Consultation = {
  id: number
  lawyer_id: number | null
  firm_id: number | null
  customer_id: string
  question: string
  status: string
  answer: string | null
  fee: number | null
}

type LawyerInfo = {
  id: number
  full_name: string
}

type CustomerInfo = {
  user_id: string
  full_name: string
}

const statusLabels: { [key: string]: string } = {
  pending: 'بانتظار الإجابة',
  answered: 'تمت الإجابة',
  needs_meeting: 'يحتاج جلسة كاملة',
  paid: 'مدفوعة',
}

export default function FirmConsultationsPage() {
  const [loading, setLoading] = useState(true)
  const [notFirm, setNotFirm] = useState(false)
  const [firmId, setFirmId] = useState<number | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [totalUnread, setTotalUnread] = useState(0)

  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [lawyerInfos, setLawyerInfos] = useState<LawyerInfo[]>([])
  const [customerInfos, setCustomerInfos] = useState<CustomerInfo[]>([])
  const [lawyerFilter, setLawyerFilter] = useState('')
  const [assignSelections, setAssignSelections] = useState<{ [key: number]: string }>({})

  const supabase = createClient()
  const router = useRouter()

  async function loadConsultations(fId: number, rosterIds: number[]) {
    let result
    if (rosterIds.length > 0) {
      result = await supabase
        .from('consultations')
        .select('*')
        .or('firm_id.eq.' + fId + ',lawyer_id.in.(' + rosterIds.join(',') + ')')
    } else {
      result = await supabase.from('consultations').select('*').eq('firm_id', fId)
    }

    const data = result.data || []
    setConsultations(data)

    const customerIds = Array.from(new Set(data.map(function (c: Consultation) { return c.customer_id })))
    if (customerIds.length > 0) {
      const customersResult = await supabase.from('customers').select('user_id, full_name').in('user_id', customerIds)
      setCustomerInfos(customersResult.data || [])
    }
  }

  useEffect(function () {
    async function loadData() {
      const userResult = await supabase.auth.getUser()

      if (!userResult.data.user) {
        setNotFirm(true)
        setLoading(false)
        return
      }

      const firmResult = await supabase.from('firms').select('id').eq('user_id', userResult.data.user.id).maybeSingle()

      if (!firmResult.data) {
        setNotFirm(true)
        setLoading(false)
        return
      }

      setFirmId(firmResult.data.id)

      const unreadResult = await supabase.from('lawyer_messages').select('sender_lawyer_id, sender_firm_id').eq('recipient_firm_id', firmResult.data.id).eq('is_read', false)
      const uniqueSenders = new Set((unreadResult.data || []).map(function (m) {
        return m.sender_lawyer_id ? 'lawyer-' + m.sender_lawyer_id : 'firm-' + m.sender_firm_id
      }))
      setTotalUnread(uniqueSenders.size)

      const rosterResult = await supabase.from('lawyers').select('id, full_name').eq('firm_id', firmResult.data.id)
      const roster = rosterResult.data || []
      setLawyerInfos(roster)

      await loadConsultations(firmResult.data.id, roster.map(function (l) { return l.id }))

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

  async function handleAssign(consultationId: number) {
    const selectedId = assignSelections[consultationId]
    if (!selectedId || !firmId) return

    await supabase.from('consultations').update({ lawyer_id: Number(selectedId) }).eq('id', consultationId)

    await loadConsultations(firmId, lawyerInfos.map(function (l) { return l.id }))
  }

  function getLawyerName(id: number | null) {
    if (!id) return null
    const found = lawyerInfos.find(function (l) { return l.id === id })
    return found ? found.full_name : null
  }

  function getCustomerName(userId: string) {
    const found = customerInfos.find(function (c) { return c.user_id === userId })
    return found ? found.full_name : 'عميل'
  }

  const filteredConsultations = consultations.filter(function (c) {
    if (!lawyerFilter) return true
    if (lawyerFilter === 'unassigned') return !c.lawyer_id
    return c.lawyer_id === Number(lawyerFilter)
  })

  function renderConsultation(c: Consultation) {
    const lawyerName = getLawyerName(c.lawyer_id)

    function selectChange(e: React.ChangeEvent<HTMLSelectElement>) {
      setAssignSelections(function (prev) {
        return Object.assign({}, prev, { [c.id]: e.target.value })
      })
    }

    function assignClick() {
      handleAssign(c.id)
    }

    return (
      <div key={c.id} className="bg-white border border-[#D8D2C4] rounded-lg p-5 mb-3">
        <div className="flex justify-between items-start mb-2">
          <p className="font-['Tajawal'] font-bold text-[#1B1A17]">{getCustomerName(c.customer_id)}</p>
          <span className="px-2 py-0.5 bg-[#F3EEE4] text-[#AD8A4E] text-xs font-['Tajawal'] rounded-full">{statusLabels[c.status] || c.status}</span>
        </div>
        <p className="font-['Tajawal'] text-sm text-[#4A473F] mb-2">{c.question}</p>
        <p className="font-['Tajawal'] text-xs text-[#AD8A4E] mb-2">
          {lawyerName ? 'المحامي: ' + lawyerName : '⚠️ غير معيّنة لمحامي بعد'}
        </p>

        {!c.lawyer_id && (
          <div className="flex gap-2 mt-2">
            <select value={assignSelections[c.id] || ''} onChange={selectChange} className="flex-1 px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-xs text-[#1B1A17]">
              <option value="">إحالة إلى محامي...</option>
              {lawyerInfos.map(function (l) { return <option key={l.id} value={l.id}>{l.full_name}</option> })}
            </select>
            <button onClick={assignClick} className="px-4 py-2 bg-[#1B1A17] text-white rounded-md font-['Tajawal'] text-xs">إحالة</button>
          </div>
        )}
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

  if (notFirm) {
    return (
      <div dir="rtl" className="min-h-screen pattern-bg flex items-center justify-center px-6">
        <div className="text-center">
          <p className="font-['Tajawal'] text-[#4A473F] mb-4">هذه الصفحة مخصصة لحسابات مكاتب المحاماة فقط</p>
          <a href="/login" className="inline-block px-6 py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal']">تسجيل الدخول</a>
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
            <a href="/"><img src="/logo.png" alt="حمورابي" className="h-12 w-auto" /></a>
            <div className="flex gap-5 items-center">
              <a href="/firm-appointments" className="hover:text-[#AD8A4E] transition">مواعيدي</a>
              <a href="/firm-consultations" className="hover:text-[#AD8A4E] transition">استشاراتي</a>
              <a href="/ai-assistant" className="hover:text-[#AD8A4E] transition">مساعد ذكي</a>
              <a href="/firm-dashboard" className="hover:text-[#AD8A4E] transition">أدواتي</a>
              <a href="/community" className="hover:text-[#AD8A4E] transition">المجتمع</a>
              <a href="/lawyer-messages" className="relative hover:text-[#AD8A4E] transition">
                <svg className="w-5 h-5 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
                {totalUnread > 0 && (
                  <span className="absolute -top-2 -left-2 bg-[#7A2E2E] text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{totalUnread}</span>
                )}
              </a>
              <div className="relative">
                <button onClick={toggleMenu} className="w-8 h-8 rounded-full bg-[#AD8A4E] flex items-center justify-center hover:bg-[#c49b58] transition">
                  <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.5c-3.3 0-9.8 1.6-9.8 4.9v2.4h19.6v-2.4c0-3.3-6.5-4.9-9.8-4.9z" /></svg>
                </button>
                {menuOpen && (
                  <div className="absolute left-0 top-full mt-2 w-52 bg-white border border-[#D8D2C4] rounded-md shadow-lg overflow-hidden z-20">
                    <a href="/firm-info" className="block px-4 py-3 font-['Tajawal'] text-sm text-[#1B1A17] hover:bg-[#F3EEE4] transition">معلومات المكتب</a>
                    <a href="/subscription" className="block px-4 py-3 font-['Tajawal'] text-sm text-[#1B1A17] hover:bg-[#F3EEE4] transition border-t border-[#D8D2C4]">ترقية الاشتراك</a>
                    <button onClick={handleLogout} className="w-full text-right px-4 py-3 font-['Tajawal'] text-sm text-[#7A2E2E] hover:bg-[#F3EEE4] transition border-t border-[#D8D2C4]">تسجيل الخروج</button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <h1 className="font-['Tajawal'] font-bold text-4xl mb-2">استشارات المكتب</h1>
          <p className="font-['Tajawal'] text-sm text-[#D8D2C4]">جميع الاستشارات عبر كل محامي المكتب في مكان واحد</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10 flex-1 w-full">
        <select value={lawyerFilter} onChange={function (e) { setLawyerFilter(e.target.value) }} className="w-full px-4 py-2.5 mb-6 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]">
          <option value="">كل المحامين</option>
          <option value="unassigned">غير معيّنة بعد</option>
          {lawyerInfos.map(function (l) { return <option key={l.id} value={l.id}>{l.full_name}</option> })}
        </select>

        {filteredConsultations.length === 0 && (
          <p className="font-['Tajawal'] text-center text-[#4A473F]">لا توجد استشارات</p>
        )}

        {filteredConsultations.map(renderConsultation)}
      </div>

      <Footer variant="firm" />
    </div>
  )
}