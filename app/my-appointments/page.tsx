'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'
import Footer from '../components/Footer'
import RatingForm, { RatingStars } from '../components/RatingForm'
import HeaderLines from '../components/HeaderLines'
import Loader from '../components/Loader'

type Appointment = {
  id: number
  lawyer_id: number | null
  firm_id: number | null
  appointment_date: string
  time_slot: string
  status: string
  consultation_type: string | null
  meeting_link: string | null
}

type LawyerName = {
  id: number
  full_name: string
}

type FirmName = {
  id: number
  firm_name: string
}

// An appointment counts as finished one hour after its start time
function hasEnded(a: Appointment) {
  const dateParts = a.appointment_date.split('-').map(Number)
  const timeParts = (a.time_slot || '00:00').split(':').map(Number)
  const start = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], timeParts[0] || 0, timeParts[1] || 0)
  return start.getTime() + 60 * 60 * 1000 < Date.now()
}

function formatDateDisplay(dateStr: string) {
  const parts = dateStr.split('-')
  if (parts.length !== 3) return dateStr
  return parts[2] + '/' + parts[1] + '/' + parts[0]
}

export default function MyAppointmentsPage() {
  const [loading, setLoading] = useState(true)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [lawyerNames, setLawyerNames] = useState<LawyerName[]>([])
  const [firmNames, setFirmNames] = useState<FirmName[]>([])
  const [notAllowed, setNotAllowed] = useState(false)
  const [showCancelled, setShowCancelled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [cancellingId, setCancellingId] = useState<number | null>(null)
  const [customerId, setCustomerId] = useState<number | null>(null)
  const [myRatings, setMyRatings] = useState<{ [appointmentId: number]: number }>({})

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
        router.push('/lawyer-calendar')
        return
      }

      const firmCheck = await supabase.from('firms').select('id').eq('user_id', userResult.data.user.id).maybeSingle()
      if (firmCheck.data) {
        router.push('/firm-appointments')
        return
      }

      const customerResult = await supabase.from('customers').select('id').eq('user_id', userResult.data.user.id).maybeSingle()
      if (customerResult.data) {
        setCustomerId(customerResult.data.id)
        const ratingsResult = await supabase.from('reviews').select('appointment_id, rating').eq('customer_id', customerResult.data.id).not('appointment_id', 'is', null)
        const ratingsMap: { [appointmentId: number]: number } = {}
        ;(ratingsResult.data || []).forEach(function (r) { ratingsMap[r.appointment_id] = r.rating })
        setMyRatings(ratingsMap)
      }

      const apptResult = await supabase
        .from('appointments')
        .select('*')
        .eq('customer_id', userResult.data.user.id)
        .order('appointment_date', { ascending: true })

      const data = apptResult.data || []
      setAppointments(data)

      const lawyerIds = Array.from(new Set(data.map(function (a: Appointment) { return a.lawyer_id }).filter(Boolean)))
      if (lawyerIds.length > 0) {
        const namesResult = await supabase.from('lawyers').select('id, full_name').in('id', lawyerIds)
        setLawyerNames(namesResult.data || [])
      }

      const firmIds = Array.from(new Set(data.map(function (a: Appointment) { return a.firm_id }).filter(Boolean)))
      if (firmIds.length > 0) {
        const firmsResult = await supabase.from('firms').select('id, firm_name').in('id', firmIds)
        setFirmNames(firmsResult.data || [])
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

  async function handleCancel(appointmentId: number) {
    setCancellingId(appointmentId)
    await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', appointmentId)
    setAppointments(appointments.map(function (a) {
      if (a.id === appointmentId) return Object.assign({}, a, { status: 'cancelled' })
      return a
    }))
    setCancellingId(null)
  }

  function getLawyerName(id: number | null) {
    if (!id) return ''
    const found = lawyerNames.find(function (l) { return l.id === id })
    return found ? found.full_name : ''
  }

  function getFirmName(id: number | null) {
    if (!id) return ''
    const found = firmNames.find(function (f) { return f.id === id })
    return found ? found.firm_name : ''
  }

  const visibleAppointments = appointments.filter(function (a) {
    if (showCancelled) return true
    return a.status !== 'cancelled'
  })

  function renderAppointment(a: Appointment) {
    const isCancelled = a.status === 'cancelled'
    const typeLabel = a.consultation_type === 'video' ? 'عبر الفيديو' : 'حضوري'
    const withWho = a.lawyer_id ? getLawyerName(a.lawyer_id) : getFirmName(a.firm_id)
    const ended = hasEnded(a)
    const myRating = myRatings[a.id]
    const canRate = !isCancelled && ended && !myRating && customerId !== null && (a.lawyer_id || a.firm_id)

    function ratingSaved(value: number) {
      const next = Object.assign({}, myRatings)
      next[a.id] = value
      setMyRatings(next)
    }

    function cancelClick() {
      handleCancel(a.id)
    }

    return (
      <div key={a.id} className={"border rounded-lg p-5 mb-3 " + (isCancelled ? 'bg-[#F3EEE4] border-[#D8D2C4] opacity-70' : 'bg-white border-[#D8D2C4]')}>
        <div className="flex justify-between items-start mb-2">
          <p className="font-['Tajawal'] font-bold text-[#1B1A17]">{withWho}</p>
          {isCancelled && <span className="px-2 py-0.5 bg-[#7A2E2E] text-white text-xs font-['Tajawal'] rounded-full">ملغى</span>}
        </div>
        <p className="font-['Tajawal'] text-sm text-[#4A473F] mb-1">{formatDateDisplay(a.appointment_date)} - {a.time_slot} ({typeLabel})</p>
        {!isCancelled && a.consultation_type === 'video' && a.meeting_link && (
          <a href={a.meeting_link} target="_blank" rel="noopener noreferrer" className="font-['Tajawal'] text-sm text-[#AD8A4E] underline block mb-2">
            رابط الاجتماع
          </a>
        )}
        {!isCancelled && !ended && (
          <button onClick={cancelClick} disabled={cancellingId === a.id} className="font-['Tajawal'] text-xs text-[#7A2E2E]">
            {cancellingId === a.id ? 'جاري الإلغاء...' : 'إلغاء الموعد'}
          </button>
        )}
        {myRating && (
          <p className="font-['Tajawal'] text-xs text-[#4A473F] mt-2">تقييمك: <RatingStars rating={myRating} /></p>
        )}
        {canRate && customerId !== null && (
          <div className="mt-2">
            <RatingForm
              customerId={customerId}
              lawyerId={a.lawyer_id ? a.lawyer_id : null}
              firmId={a.lawyer_id ? null : a.firm_id}
              appointmentId={a.id}
              targetLabel={a.lawyer_id ? 'المحامي' : 'المكتب'}
              onSaved={ratingSaved}
            />
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

  if (notAllowed) {
    return (
      <div dir="rtl" className="min-h-screen pattern-bg flex items-center justify-center px-6">
        <div className="text-center">
          <p className="font-['Tajawal'] text-[#4A473F] mb-4">يرجى تسجيل الدخول لعرض مواعيدك</p>
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
              <a href="/my-appointments" className="text-[#AD8A4E]">مواعيدي</a>
              <a href="/my-consultations" className="hover:text-[#AD8A4E] transition">استشاراتي</a>
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
          <h1 className="font-['Tajawal'] font-bold text-4xl mb-2">مواعيدي</h1>
          <div className="w-16 h-[2px] bg-[#AD8A4E]"></div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10 flex-1 w-full">
        <label className="flex items-center gap-2 font-['Tajawal'] text-sm text-[#4A473F] mb-6">
          <input type="checkbox" checked={showCancelled} onChange={function (e) { setShowCancelled(e.target.checked) }} />
          إظهار المواعيد الملغاة
        </label>

        {visibleAppointments.length === 0 && (
          <p className="font-['Tajawal'] text-center text-[#4A473F]">لا توجد مواعيد</p>
        )}

        {visibleAppointments.map(renderAppointment)}
      </div>

      <Footer variant="customer" />
    </div>
  )
}