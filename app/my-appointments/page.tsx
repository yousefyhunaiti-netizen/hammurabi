'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'

type Appointment = {
  id: number
  lawyer_id: number
  appointment_date: string
  time_slot: string
  status: string
  consultation_type: string | null
  meeting_link: string | null
}

type Lawyer = {
  id: number
  full_name: string
}

const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']

export default function MyAppointmentsPage() {
  const [loading, setLoading] = useState(true)
  const [loggedIn, setLoggedIn] = useState(false)
  const [infoLink, setInfoLink] = useState('')
  const [isLawyerAccount, setIsLawyerAccount] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [lawyers, setLawyers] = useState<Lawyer[]>([])
  const [cancellingId, setCancellingId] = useState<number | null>(null)

  const supabase = createClient()
  const router = useRouter()

  useEffect(function () {
    async function loadData() {
      const userResult = await supabase.auth.getUser()

      if (!userResult.data.user) {
        setLoggedIn(false)
        setLoading(false)
        return
      }

      const user = userResult.data.user
      setLoggedIn(true)

      const customerResult = await supabase.from('customers').select('id').eq('user_id', user.id).maybeSingle()
      if (customerResult.data) {
        setInfoLink('/my-info')
      } else {
        const lawyerAcctResult = await supabase.from('lawyers').select('id').eq('user_id', user.id).maybeSingle()
        if (lawyerAcctResult.data) {
          setInfoLink('/lawyer-info')
          setIsLawyerAccount(true)
        } else {
          const firmResult = await supabase.from('firms').select('id').eq('user_id', user.id).maybeSingle()
          if (firmResult.data) {
            setInfoLink('/firm-info')
          }
        }
      }

      const apptResult = await supabase
        .from('appointments')
        .select('*')
        .eq('customer_id', user.id)
        .neq('status', 'cancelled')
        .order('appointment_date', { ascending: true })

      const apptData = apptResult.data || []
      setAppointments(apptData)

      const lawyerIds = apptData.map(function (a: Appointment) { return a.lawyer_id })

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

  async function handleLogout() {
    await supabase.auth.signOut()
    setMenuOpen(false)
    router.push('/')
  }

  function toggleMenu() {
    setMenuOpen(!menuOpen)
  }

  function getLawyerName(lawyerId: number) {
    const found = lawyers.find(function (l) { return l.id === lawyerId })
    return found ? found.full_name : ''
  }

  function formatDate(dateStr: string) {
    const parts = dateStr.split('-')
    const dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
    return dayNames[dateObj.getDay()] + ' ' + parts[2] + ' ' + monthNames[dateObj.getMonth()] + ' ' + parts[0]
  }

  async function handleCancel(appointmentId: number) {
    setCancellingId(appointmentId)
    await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', appointmentId)
    setAppointments(appointments.filter(function (a) { return a.id !== appointmentId }))
    setCancellingId(null)
  }

  function renderAppointmentCard(appt: Appointment) {
    const lawyerName = getLawyerName(appt.lawyer_id)
    const isVideo = appt.consultation_type === 'video'
    const typeLabel = isVideo ? 'عبر الفيديو' : 'حضوري'

    function cancelClick() {
      handleCancel(appt.id)
    }

    return (
      <div key={appt.id} className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-4">
        <div className="flex justify-between items-start mb-3">
          <h3 className="font-['Tajawal'] font-bold text-[#1B1A17]">{lawyerName}</h3>
          <span className="px-3 py-1 rounded-full text-xs font-['Tajawal'] bg-[#F3EEE4] text-[#4A473F]">
            {typeLabel}
          </span>
        </div>

        <div className="flex items-center justify-between font-['Tajawal'] text-sm text-[#4A473F] mb-3">
          <span>{formatDate(appt.appointment_date)}</span>
          <span className="font-medium text-[#1B1A17]">{appt.time_slot}</span>
        </div>

        {isVideo && appt.meeting_link && (
          <div className="bg-[#2F4538] rounded-md p-3 mb-3">
            <p className="font-['Tajawal'] text-xs text-white mb-1">رابط الاجتماع:</p>
            <a href={appt.meeting_link} target="_blank" rel="noopener noreferrer" className="font-['Tajawal'] text-xs text-white underline break-all">
              {appt.meeting_link}
            </a>
          </div>
        )}

        <button
          onClick={cancelClick}
          disabled={cancellingId === appt.id}
          className="w-full py-2 text-sm font-['Tajawal'] text-[#7A2E2E] hover:underline disabled:opacity-60"
        >
          {cancellingId === appt.id ? 'جاري الإلغاء...' : 'إلغاء الموعد'}
        </button>
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
          <p className="font-['Tajawal'] text-[#4A473F] mb-4">يرجى تسجيل الدخول لعرض مواعيدك</p>
          <a href="/login" className="inline-block px-6 py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal']">تسجيل الدخول</a>
        </div>
      </div>
    )
  }

  return (
    <div dir="rtl" className="min-h-screen pattern-bg">
      <div className="bg-[#1B1A17] text-[#F3EEE4] py-12 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex justify-between items-center mb-8 font-['Tajawal'] text-sm">
            <a href="/" className="font-['Amiri'] text-xl">حمورابي</a>
            <div className="flex gap-5 items-center">
              <a href="/lawyers" className="hover:text-[#AD8A4E] transition">دليل المحامين</a>
              <a href="/my-appointments" className="hover:text-[#AD8A4E] transition">مواعيدي</a>
              <a href="/my-consultations" className="hover:text-[#AD8A4E] transition">استشاراتي</a>
              {isLawyerAccount && (
                <a href="/lawyer-tools" className="hover:text-[#AD8A4E] transition">أدواتي</a>
              )}

              <div className="relative">
                <button
                  onClick={toggleMenu}
                  className="w-8 h-8 rounded-full bg-[#AD8A4E] flex items-center justify-center hover:bg-[#c49b58] transition"
                >
                  <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.5c-3.3 0-9.8 1.6-9.8 4.9v2.4h19.6v-2.4c0-3.3-6.5-4.9-9.8-4.9z" />
                  </svg>
                </button>

                {menuOpen && (
                  <div className="absolute left-0 top-full mt-2 w-52 bg-white border border-[#D8D2C4] rounded-md shadow-lg overflow-hidden z-20">
                    {infoLink && (
                      <a href={infoLink} className="block px-4 py-3 font-['Tajawal'] text-sm text-[#1B1A17] hover:bg-[#F3EEE4] transition">
                        معلوماتي الشخصية
                      </a>
                    )}
                    <button
                      onClick={handleLogout}
                      className="w-full text-right px-4 py-3 font-['Tajawal'] text-sm text-[#7A2E2E] hover:bg-[#F3EEE4] transition border-t border-[#D8D2C4]"
                    >
                      تسجيل الخروج
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <h1 className="font-['Amiri'] text-4xl mb-2">مواعيدي</h1>
          <div className="w-16 h-[2px] bg-[#AD8A4E]"></div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10">
        {appointments.length === 0 && (
          <p className="font-['Tajawal'] text-[#4A473F] text-center">لا توجد مواعيد بعد</p>
        )}

        {appointments.map(renderAppointmentCard)}
      </div>
    </div>
  )
}