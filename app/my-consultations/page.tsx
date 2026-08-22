'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase'

type Consultation = {
  id: number
  lawyer_id: number
  question: string
  status: string
  answer: string | null
  fee: number
  created_at: string
}

type Lawyer = {
  id: number
  full_name: string
}

export default function MyConsultationsPage() {
  const [loading, setLoading] = useState(true)
  const [loggedIn, setLoggedIn] = useState(false)
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [lawyers, setLawyers] = useState<Lawyer[]>([])
  const [payingId, setPayingId] = useState<number | null>(null)

  const supabase = createClient()

  useEffect(function () {
    async function loadData() {
      const userResult = await supabase.auth.getUser()

      if (!userResult.data.user) {
        setLoggedIn(false)
        setLoading(false)
        return
      }

      setLoggedIn(true)

      const consultResult = await supabase
        .from('consultations')
        .select('*')
        .eq('customer_id', userResult.data.user.id)
        .order('created_at', { ascending: false })

      const consultationsData = consultResult.data || []
      setConsultations(consultationsData)

      const lawyerIds = consultationsData.map(function (c: Consultation) {
        return c.lawyer_id
      })

      if (lawyerIds.length > 0) {
        const lawyersResult = await supabase
          .from('lawyers')
          .select('id, full_name')
          .in('id', lawyerIds)

        setLawyers(lawyersResult.data || [])
      }

      setLoading(false)
    }

    loadData()
  }, [])

  function getLawyerName(lawyerId: number) {
    const found = lawyers.find(function (l) { return l.id === lawyerId })
    return found ? found.full_name : ''
  }

  function getStatusLabel(status: string) {
    if (status === 'pending') return 'بانتظار رد المحامي'
    if (status === 'answered') return 'تم الرد - بانتظار الدفع'
    if (status === 'needs_meeting') return 'يوصى بحجز موعد'
    if (status === 'paid') return 'مكتملة'
    return status
  }

  function getStatusColor(status: string) {
    if (status === 'pending') return 'bg-[#D8D2C4] text-[#4A473F]'
    if (status === 'answered') return 'bg-[#AD8A4E] text-white'
    if (status === 'needs_meeting') return 'bg-[#2F4538] text-white'
    if (status === 'paid') return 'bg-[#2F4538] text-white'
    return 'bg-[#D8D2C4] text-[#4A473F]'
  }

  async function handleFakePayment(consultationId: number) {
    setPayingId(consultationId)

    await supabase.from('consultations').update({ status: 'paid' }).eq('id', consultationId)

    setConsultations(
      consultations.map(function (c) {
        if (c.id === consultationId) {
          return Object.assign({}, c, { status: 'paid' })
        }
        return c
      })
    )

    setPayingId(null)
  }

  function renderConsultationCard(c: Consultation) {
    const lawyerName = getLawyerName(c.lawyer_id)
    const statusLabel = getStatusLabel(c.status)
    const statusColorClass = "px-3 py-1 rounded-full text-xs font-['Tajawal'] " + getStatusColor(c.status)
    const meetingLink = '/lawyers/' + c.lawyer_id
    const payButtonText = payingId === c.id ? 'جاري الدفع...' : 'ادفع ' + c.fee + ' د.أ لعرض الإجابة'

    function payClick() {
      handleFakePayment(c.id)
    }

    return (
      <div key={c.id} className="bg-white border border-[#D8D2C4] rounded-lg p-6">
        <div className="flex justify-between items-start mb-3">
          <h3 className="font-['Tajawal'] font-bold text-[#1B1A17]">{lawyerName}</h3>
          <span className={statusColorClass}>{statusLabel}</span>
        </div>

        <p className="font-['Tajawal'] text-sm text-[#4A473F] mb-4">{c.question}</p>

        {c.status === 'pending' && (
          <p className="font-['Tajawal'] text-sm text-[#4A473F] bg-[#F3EEE4] rounded-md p-3">
            سيقوم المحامي بمراجعة سؤالك قريباً
          </p>
        )}

        {c.status === 'needs_meeting' && (
          <a href={meetingLink} className="inline-block px-4 py-2 bg-[#2F4538] text-white rounded-md font-['Tajawal'] text-sm">
            احجز موعداً مع المحامي
          </a>
        )}

        {c.status === 'answered' && (
          <div>
            <div className="bg-[#F3EEE4] rounded-md p-4 mb-3 blur-sm select-none">
              <p className="font-['Tajawal'] text-sm text-[#4A473F]">الإجابة جاهزة، سيتم عرضها بعد إتمام الدفع...</p>
            </div>
            <button onClick={payClick} disabled={payingId === c.id} className="w-full py-3 bg-[#AD8A4E] text-white rounded-md font-['Tajawal'] font-medium hover:bg-[#c49b58] transition disabled:opacity-60">
              {payButtonText}
            </button>
          </div>
        )}

        {c.status === 'paid' && (
          <div className="bg-[#F3EEE4] rounded-md p-4">
            <p className="font-['Tajawal'] text-xs text-[#AD8A4E] mb-2">إجابة المحامي:</p>
            <p className="font-['Tajawal'] text-sm text-[#1B1A17]">{c.answer}</p>
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

  if (!loggedIn) {
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
    <div dir="rtl" className="min-h-screen pattern-bg">
      <div className="bg-[#1B1A17] text-[#F3EEE4] py-12 px-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-['Amiri'] text-4xl mb-2">استشاراتي</h1>
          <div className="w-16 h-[2px] bg-[#AD8A4E]"></div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10">
        {consultations.length === 0 && (
          <p className="font-['Tajawal'] text-[#4A473F] text-center">لا توجد استشارات بعد</p>
        )}

        <div className="space-y-4">
          {consultations.map(renderConsultationCard)}
        </div>
      </div>
    </div>
  )
}