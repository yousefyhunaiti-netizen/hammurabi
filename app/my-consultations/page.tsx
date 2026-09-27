'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'
import Footer from '../components/Footer'
import RatingForm, { RatingStars } from '../components/RatingForm'

type Consultation = {
  id: number
  lawyer_id: number | null
  firm_id: number | null
  question: string
  status: string
  answer: string | null
  fee: number | null
  created_at: string
}

type LawyerInfo = {
  id: number
  full_name: string
  firm_id: number | null
}

type Firm = {
  id: number
  firm_name: string
  show_lawyer_names: boolean | null
}

export default function MyConsultationsPage() {
  const [loading, setLoading] = useState(true)
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [lawyerInfos, setLawyerInfos] = useState<LawyerInfo[]>([])
  const [firms, setFirms] = useState<Firm[]>([])
  const [notAllowed, setNotAllowed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [payingId, setPayingId] = useState<number | null>(null)
  const [customerId, setCustomerId] = useState<number | null>(null)
  const [myRatings, setMyRatings] = useState<{ [consultationId: number]: number }>({})

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

  useEffect(function () {
    async function loadData() {
      const userResult = await supabase.auth.getUser()

      if (!userResult.data.user) {
        setNotAllowed(true)
        setLoading(false)
        return
      }

      const lawyerCheck = await supabase.from('lawyers').select('id').eq('user_id', userResult.data.user.id).maybeSingle()
      if (lawyerCheck.data) {
        router.push('/lawyer-tools')
        return
      }

      const firmCheck = await supabase.from('firms').select('id').eq('user_id', userResult.data.user.id).maybeSingle()
      if (firmCheck.data) {
        router.push('/firm-consultations')
        return
      }

      const customerResult = await supabase.from('customers').select('id').eq('user_id', userResult.data.user.id).maybeSingle()
      if (customerResult.data) {
        setCustomerId(customerResult.data.id)
        const ratingsResult = await supabase.from('reviews').select('consultation_id, rating').eq('customer_id', customerResult.data.id).not('consultation_id', 'is', null)
        const ratingsMap: { [consultationId: number]: number } = {}
        ;(ratingsResult.data || []).forEach(function (r) { ratingsMap[r.consultation_id] = r.rating })
        setMyRatings(ratingsMap)
      }

      const result = await supabase
        .from('consultations')
        .select('*')
        .eq('customer_id', userResult.data.user.id)
        .order('created_at', { ascending: false })

      const data = result.data || []
      setConsultations(data)

      const lawyerIds = Array.from(new Set(data.map(function (c: Consultation) { return c.lawyer_id }).filter(Boolean)))
      let lawyersData: LawyerInfo[] = []
      if (lawyerIds.length > 0) {
        const namesResult = await supabase.from('lawyers').select('id, full_name, firm_id').in('id', lawyerIds)
        lawyersData = namesResult.data || []
        setLawyerInfos(lawyersData)
      }

      const directFirmIds = data.map(function (c: Consultation) { return c.firm_id }).filter(Boolean)
      const lawyerFirmIds = lawyersData.map(function (l) { return l.firm_id }).filter(Boolean)
      const allFirmIds = Array.from(new Set(directFirmIds.concat(lawyerFirmIds)))

      if (allFirmIds.length > 0) {
        const firmsResult = await supabase.from('firms').select('id, firm_name, show_lawyer_names').in('id', allFirmIds)
        setFirms(firmsResult.data || [])
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

  async function handlePay(id: number) {
    setPayingId(id)
    await new Promise(function (resolve) { setTimeout(resolve, 1000) })
    await supabase.from('consultations').update({ status: 'paid' }).eq('id', id)
    setConsultations(consultations.map(function (c) {
      if (c.id === id) return Object.assign({}, c, { status: 'paid' })
      return c
    }))
    setPayingId(null)
  }

  function getAttributionLabel(c: Consultation) {
    if (c.lawyer_id) {
      const lawyer = lawyerInfos.find(function (l) { return l.id === c.lawyer_id })
      if (lawyer && lawyer.firm_id) {
        const firm = firms.find(function (f) { return f.id === lawyer.firm_id })
        if (firm) {
          return firm.show_lawyer_names ? firm.firm_name + ' — ' + lawyer.full_name : firm.firm_name
        }
      }
      return lawyer ? lawyer.full_name : ''
    }
    if (c.firm_id) {
      const firm = firms.find(function (f) { return f.id === c.firm_id })
      return firm ? firm.firm_name : ''
    }
    return ''
  }

  // Who the customer rates: the lawyer when the customer can see who answered,
  // otherwise the firm (a firm that hides its lawyers' names).
  function getRatingTarget(c: Consultation) {
    if (c.lawyer_id) {
      const lawyer = lawyerInfos.find(function (l) { return l.id === c.lawyer_id })
      if (lawyer && lawyer.firm_id) {
        const firm = firms.find(function (f) { return f.id === lawyer.firm_id })
        if (firm && !firm.show_lawyer_names) return { lawyerId: null, firmId: firm.id, label: 'المكتب' }
      }
      return { lawyerId: c.lawyer_id, firmId: null, label: 'المحامي' }
    }
    if (c.firm_id) return { lawyerId: null, firmId: c.firm_id, label: 'المكتب' }
    return null
  }

  const statusLabels: { [key: string]: string } = {
    pending: 'بانتظار الإجابة',
    answered: 'تمت الإجابة',
    needs_meeting: 'يحتاج موعداً',
    paid: 'مدفوعة',
  }

  function renderConsultation(c: Consultation) {
    function payClick() {
      handlePay(c.id)
    }

    const myRating = myRatings[c.id]
    const ratingTarget = getRatingTarget(c)

    function ratingSaved(value: number) {
      const next = Object.assign({}, myRatings)
      next[c.id] = value
      setMyRatings(next)
    }

    return (
      <div key={c.id} className="bg-white border border-[#D8D2C4] rounded-lg p-5 mb-3">
        <div className="flex justify-between items-start mb-2">
          <p className="font-['Tajawal'] font-bold text-sm text-[#1B1A17]">{getAttributionLabel(c)}</p>
          <span className="px-2 py-0.5 bg-[#F3EEE4] text-[#AD8A4E] text-xs font-['Tajawal'] rounded-full">{statusLabels[c.status] || c.status}</span>
        </div>
        <p className="font-['Tajawal'] text-sm text-[#4A473F] mb-3">{c.question}</p>

        {c.status === 'answered' && c.answer && (
          <div>
            <div className="relative bg-[#F3EEE4] rounded-md p-4 mb-3">
              <p className="font-['Tajawal'] text-sm text-[#1B1A17] blur-sm select-none">{c.answer}</p>
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="font-['Tajawal'] text-xs text-[#4A473F] bg-white/80 px-3 py-1 rounded-full">ادفع لعرض الإجابة</p>
              </div>
            </div>
            <button onClick={payClick} disabled={payingId === c.id} className="w-full py-2.5 bg-[#1B1A17] text-white rounded-md font-['Tajawal'] text-sm">
              {payingId === c.id ? 'جاري الدفع...' : 'ادفع ' + (c.fee || 0) + ' د.أ لعرض الإجابة'}
            </button>
          </div>
        )}

        {c.status === 'paid' && c.answer && (
          <div className="bg-[#F3EEE4] rounded-md p-4">
            <p className="font-['Tajawal'] text-sm text-[#1B1A17] whitespace-pre-wrap">{c.answer}</p>
          </div>
        )}

        {c.status === 'paid' && myRating && (
          <p className="font-['Tajawal'] text-xs text-[#4A473F] mt-3">تقييمك: <RatingStars rating={myRating} /></p>
        )}

        {c.status === 'paid' && !myRating && ratingTarget && customerId !== null && (
          <div className="mt-3">
            <RatingForm
              customerId={customerId}
              lawyerId={ratingTarget.lawyerId}
              firmId={ratingTarget.firmId}
              consultationId={c.id}
              targetLabel={ratingTarget.label}
              onSaved={ratingSaved}
            />
          </div>
        )}

        {c.status === 'needs_meeting' && (
          <div className="bg-[#F3EEE4] border border-[#D8D2C4] rounded-md p-4">
            <p className="font-['Tajawal'] text-sm text-[#1B1A17] mb-2">يرى المحامي أن مسألتك تحتاج دراسة أعمق من إجابة مكتوبة، ويوصيك بحجز موعد. لن تُحتسب عليك رسوم الاستشارة، ويُتفق على الأتعاب في الموعد.</p>
            {c.answer && (
              <p className="font-['Tajawal'] text-sm text-[#4A473F] whitespace-pre-wrap mb-3">ملاحظة المحامي: {c.answer}</p>
            )}
            <a href={c.lawyer_id ? '/lawyers/' + c.lawyer_id : '/firms/' + c.firm_id} className="inline-block px-4 py-2 bg-[#AD8A4E] text-white rounded-md font-['Tajawal'] text-sm">
              احجز موعداً
            </a>
          </div>
        )}
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
          <p className="font-['Tajawal'] text-[#4A473F] mb-4">يرجى تسجيل الدخول لعرض استشاراتك</p>
          <a href="/login" className="inline-block px-6 py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal']">تسجيل الدخول</a>
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
              <a href="/my-appointments" className="hover:text-[#AD8A4E] transition">مواعيدي</a>
              <a href="/my-consultations" className="text-[#AD8A4E]">استشاراتي</a>
              <a href="/lawyers" className="hover:text-[#AD8A4E] transition">دليل المحامين</a>
              <a href="/ai-assistant" className="hover:text-[#AD8A4E] transition">مساعد ذكي</a>
              <a href="/legal-articles" className="hover:text-[#AD8A4E] transition">مقالات قانونية</a>
              <div className="relative" ref={menuRef}>
                <button onClick={toggleMenu} className="w-8 h-8 rounded-full bg-[#AD8A4E] flex items-center justify-center hover:bg-[#c49b58] transition">
                  <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.5c-3.3 0-9.8 1.6-9.8 4.9v2.4h19.6v-2.4c0-3.3-6.5-4.9-9.8-4.9z" /></svg>
                </button>
                {menuOpen && (
                  <div className="absolute left-0 top-full mt-2 w-52 bg-white border border-[#D8D2C4] rounded-md shadow-lg overflow-hidden z-20">
                    <a href="/my-info" className="block px-4 py-3 font-['Tajawal'] text-sm text-[#1B1A17] hover:bg-[#F3EEE4] transition">معلوماتي الشخصية</a>
                    <button onClick={handleLogout} className="w-full text-right px-4 py-3 font-['Tajawal'] text-sm text-[#7A2E2E] hover:bg-[#F3EEE4] transition border-t border-[#D8D2C4]">تسجيل الخروج</button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <h1 className="font-['Tajawal'] font-bold text-4xl mb-2">استشاراتي</h1>
          <div className="w-16 h-[2px] bg-[#AD8A4E]"></div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10 flex-1 w-full">
        {consultations.length === 0 && (
          <p className="font-['Tajawal'] text-center text-[#4A473F]">لا توجد استشارات</p>
        )}

        {consultations.map(renderConsultation)}
      </div>

      <Footer variant="customer" />
    </div>
  )
}