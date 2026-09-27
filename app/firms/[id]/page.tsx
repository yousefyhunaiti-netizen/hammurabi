'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'
import Footer from '../../components/Footer'
import BookingGuide, { ConsultationFeeNote } from '../../components/BookingGuide'

type Firm = {
  id: number
  firm_name: string
  bio: string | null
  city: string | null
  address: string | null
  phone: string | null
  email: string | null
  google_maps_link: string | null
  website_url: string | null
  show_lawyer_names: boolean | null
  founded_year: number | null
}

type Specialty = {
  id: number
  name_ar: string
}

type FirmReview = {
  id: number
  rating: number
  comment: string | null
}

type FirmLawyer = {
  id: number
  full_name: string
  specialty_id: number
  city: string
  years_experience: number
  consultation_fee: number
  working_days: string | null
  working_hours_start: string | null
  working_hours_end: string | null
  vacation_until: string | null
}

const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
const genericTimeSlots = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00']

export default function FirmDetailPage() {
  const params = useParams()
  const router = useRouter()
  const firmId = Number(params.id)

  const [firm, setFirm] = useState<Firm | null>(null)
  const [specialties, setSpecialties] = useState<Specialty[]>([])
  const [roster, setRoster] = useState<FirmLawyer[]>([])
  const [reviews, setReviews] = useState<FirmReview[]>([])
  const [loading, setLoading] = useState(true)
  const [loggedIn, setLoggedIn] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [infoLink, setInfoLink] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)

  const [selectedLawyerId, setSelectedLawyerId] = useState('')
  const [selectedSpecialtyId, setSelectedSpecialtyId] = useState('')
  const [availableDates, setAvailableDates] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState('')
  const [bookedSlots, setBookedSlots] = useState<string[]>([])
  const [timeSlots, setTimeSlots] = useState<string[]>(genericTimeSlots)
  const [bookingMessage, setBookingMessage] = useState('')
  const [bookingLoading, setBookingLoading] = useState(false)
  const [myBookingId, setMyBookingId] = useState<number | null>(null)
  const [consultationType, setConsultationType] = useState('in_person')

  const [questionText, setQuestionText] = useState('')
  const [consultMessage, setConsultMessage] = useState('')
  const [consultLoading, setConsultLoading] = useState(false)
  const [consultSubmitted, setConsultSubmitted] = useState(false)

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
  useEffect(function () {
    async function loadData() {
      const userResult = await supabase.auth.getUser()
      const user = userResult.data.user

      if (user) {
        setLoggedIn(true)

        const customerResult = await supabase.from('customers').select('id').eq('user_id', user.id).maybeSingle()
        if (customerResult.data) {
          setInfoLink('/my-info')
        } else {
          const lawyerResult = await supabase.from('lawyers').select('id').eq('user_id', user.id).maybeSingle()
          if (lawyerResult.data) {
            setInfoLink('/lawyer-info')
          } else {
            const firmAcctResult = await supabase.from('firms').select('id').eq('user_id', user.id).maybeSingle()
            if (firmAcctResult.data) {
              setInfoLink('/firm-info')
            }
          }
        }
      }

      setCheckingAuth(false)

      const firmResult = await supabase.from('firms').select('*').eq('id', firmId).single()
      setFirm(firmResult.data)

      const reviewsResult = await supabase.from('reviews').select('id, rating, comment').eq('firm_id', firmId).order('created_at', { ascending: false })
      setReviews(reviewsResult.data || [])

      const specialtiesResult = await supabase.from('specialties').select('*')
      setSpecialties(specialtiesResult.data || [])

      const rosterResult = await supabase
        .from('lawyers')
        .select('id, full_name, specialty_id, city, years_experience, consultation_fee, working_days, working_hours_start, working_hours_end, vacation_until')
        .eq('firm_id', firmId)

      setRoster(rosterResult.data || [])
      setLoading(false)
    }

    loadData()
  }, [firmId])

  function buildGenericDates() {
    const dates: string[] = []
    const today = new Date()
    let daysChecked = 0
    let daysFound = 0

    while (daysFound < 10 && daysChecked < 30) {
      const checkDate = new Date(today)
      checkDate.setDate(today.getDate() + daysChecked)
      const dayOfWeek = checkDate.getDay()

      if (dayOfWeek >= 0 && dayOfWeek <= 4) {
        const yyyy = checkDate.getFullYear()
        const mm = String(checkDate.getMonth() + 1).padStart(2, '0')
        const dd = String(checkDate.getDate()).padStart(2, '0')
        dates.push(yyyy + '-' + mm + '-' + dd)
        daysFound = daysFound + 1
      }
      daysChecked = daysChecked + 1
    }

    return dates
  }

  function buildLawyerDates(lawyer: FirmLawyer) {
    const workingDaysList = (lawyer.working_days || '0,1,2,3,4').split(',').map(function (d) { return Number(d) })
    const vacationUntil = lawyer.vacation_until

    const dates: string[] = []
    const today = new Date()
    let daysChecked = 0
    let daysFound = 0

    while (daysFound < 10 && daysChecked < 45) {
      const checkDate = new Date(today)
      checkDate.setDate(today.getDate() + daysChecked)
      const dayOfWeek = checkDate.getDay()

      if (workingDaysList.indexOf(dayOfWeek) !== -1) {
        const yyyy = checkDate.getFullYear()
        const mm = String(checkDate.getMonth() + 1).padStart(2, '0')
        const dd = String(checkDate.getDate()).padStart(2, '0')
        const dateStr = yyyy + '-' + mm + '-' + dd
        const isVacation = vacationUntil ? dateStr <= vacationUntil : false
        if (!isVacation) {
          dates.push(dateStr)
          daysFound = daysFound + 1
        }
      }
      daysChecked = daysChecked + 1
    }

    return dates
  }

  function buildLawyerTimeSlots(lawyer: FirmLawyer) {
    const startHour = Number((lawyer.working_hours_start || '09:00').split(':')[0])
    const endHour = Number((lawyer.working_hours_end || '17:00').split(':')[0])
    const slots: string[] = []
    for (let h = startHour; h < endHour; h++) {
      slots.push(String(h).padStart(2, '0') + ':00')
    }
    return slots
  }

  useEffect(function () {
    if (!firm) return

    if (firm.show_lawyer_names) {
      if (!selectedLawyerId) {
        setAvailableDates([])
        return
      }
      const lawyer = roster.find(function (l) { return String(l.id) === selectedLawyerId })
      if (!lawyer) return

      const dates = buildLawyerDates(lawyer)
      setAvailableDates(dates)
      setTimeSlots(buildLawyerTimeSlots(lawyer))
      if (dates.length > 0) {
        setSelectedDate(dates[0])
      }
    } else {
      if (!selectedSpecialtyId) {
        setAvailableDates([])
        return
      }
      const dates = buildGenericDates()
      setAvailableDates(dates)
      setTimeSlots(genericTimeSlots)
      if (dates.length > 0) {
        setSelectedDate(dates[0])
      }
    }
  }, [selectedLawyerId, selectedSpecialtyId, firm, roster])

  useEffect(function () {
    async function loadBookedSlots() {
      if (!selectedDate) {
        setBookedSlots([])
        return
      }

      if (firm && firm.show_lawyer_names && selectedLawyerId) {
        const result = await supabase
          .from('appointments')
          .select('time_slot')
          .eq('lawyer_id', Number(selectedLawyerId))
          .eq('appointment_date', selectedDate)
        setBookedSlots((result.data || []).map(function (a) { return a.time_slot }))
        return
      }

      if (firm && !firm.show_lawyer_names && selectedSpecialtyId) {
        const result = await supabase
          .from('appointments')
          .select('time_slot')
          .eq('firm_id', firmId)
          .eq('specialty_id', Number(selectedSpecialtyId))
          .eq('appointment_date', selectedDate)
        setBookedSlots((result.data || []).map(function (a) { return a.time_slot }))
      }
    }

    loadBookedSlots()
  }, [selectedDate, selectedLawyerId, selectedSpecialtyId, firm, firmId])

  async function handleLogout() {
    await supabase.auth.signOut()
    setLoggedIn(false)
    setMenuOpen(false)
    router.push('/')
  }

  function toggleMenu() {
    setMenuOpen(!menuOpen)
  }

  function getSpecialtyName(specialtyId: number) {
    const found = specialties.find(function (s) { return s.id === specialtyId })
    return found ? found.name_ar : ''
  }

  function formatDayButton(dateStr: string) {
    const parts = dateStr.split('-')
    const dateObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
    return dayNames[dateObj.getDay()] + ' ' + parts[2]
  }

  async function handleBookSlot(slot: string) {
    setBookingMessage('')
    setBookingLoading(true)

    const userResult = await supabase.auth.getUser()

    if (!userResult.data.user) {
      setBookingLoading(false)
      setBookingMessage('يرجى تسجيل الدخول أولاً لحجز موعد')
      return
    }

    let generatedLink = ''
    if (consultationType === 'video') {
      const roomName = 'hammurabi-firm-' + firmId + '-' + Date.now()
      generatedLink = 'https://meet.jit.si/' + roomName
    }

    const insertData: any = {
      customer_id: userResult.data.user.id,
      appointment_date: selectedDate,
      time_slot: slot,
      status: 'confirmed',
      consultation_type: consultationType,
      meeting_link: generatedLink,
    }

    if (firm && firm.show_lawyer_names && selectedLawyerId) {
      insertData.lawyer_id = Number(selectedLawyerId)
    } else if (firm && !firm.show_lawyer_names && selectedSpecialtyId) {
      insertData.firm_id = firmId
      insertData.specialty_id = Number(selectedSpecialtyId)
    } else {
      setBookingLoading(false)
      return
    }

    const insertResult = await supabase.from('appointments').insert(insertData).select().single()

    setBookingLoading(false)

    if (insertResult.error) {
      setBookingMessage('حدث خطأ أثناء الحجز، حاول مرة أخرى')
      return
    }

    setBookingMessage('تم حجز موعدك بنجاح! يمكنك متابعته من صفحة "مواعيدي"')
    setBookedSlots(bookedSlots.concat([slot]))
    setMyBookingId(insertResult.data.id)
  }

  async function handleSubmitConsultation() {
    setConsultMessage('')

    if (!questionText.trim()) {
      setConsultMessage('يرجى كتابة سؤالك أولاً')
      return
    }

    if (firm && firm.show_lawyer_names && !selectedLawyerId) {
      setConsultMessage('يرجى اختيار المحامي أولاً')
      return
    }

    setConsultLoading(true)

    const userResult = await supabase.auth.getUser()

    if (!userResult.data.user) {
      setConsultLoading(false)
      setConsultMessage('يرجى تسجيل الدخول أولاً لإرسال استشارة')
      return
    }

    const insertData: any = {
      customer_id: userResult.data.user.id,
      question: questionText,
      status: 'pending',
      fee: 0,
    }

    if (firm && firm.show_lawyer_names && selectedLawyerId) {
      insertData.lawyer_id = Number(selectedLawyerId)
    } else {
      insertData.firm_id = firmId
    }

    const insertResult = await supabase.from('consultations').insert(insertData)

    setConsultLoading(false)

    if (insertResult.error) {
      setConsultMessage('حدث خطأ أثناء الإرسال، حاول مرة أخرى')
      return
    }

    setConsultSubmitted(true)
    setQuestionText('')
  }

  if (loading) {
    return (
      <div dir="rtl" className="min-h-screen pattern-bg flex items-center justify-center">
        <p className="font-['Tajawal'] text-[#4A473F]">جاري التحميل...</p>
      </div>
    )
  }

  if (!firm) {
    return (
      <div dir="rtl" className="min-h-screen pattern-bg flex items-center justify-center">
        <p className="font-['Tajawal'] text-[#4A473F]">لم يتم العثور على هذا المكتب</p>
      </div>
    )
  }

  const phoneLink = 'tel:' + (firm.phone || '')
  const dropdownReady = firm.show_lawyer_names ? Boolean(selectedLawyerId) : Boolean(selectedSpecialtyId)

  const firmSpecialtyIds = Array.from(new Set(roster.map(function (l) { return l.specialty_id })))
  const firmSpecialtyNames = firmSpecialtyIds.map(getSpecialtyName).filter(Boolean).join('، ')
  const yearsSinceFounded = firm.founded_year ? new Date().getFullYear() - firm.founded_year : null
  const avgRating = reviews.length > 0 ? (reviews.reduce(function (sum, r) { return sum + r.rating }, 0) / reviews.length).toFixed(1) : null

  return (
    <div dir="rtl" className="min-h-screen pattern-bg flex flex-col">
      <div className="bg-[#1B1A17] text-[#F3EEE4] py-14 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-8 font-['Tajawal'] text-sm">
            <a href="/">
              <img src="/logo.png" alt="حمورابي" className="h-12 w-auto" />
            </a>
            <div className="flex gap-5 items-center">
              <a href="/my-appointments" className="hover:text-[#AD8A4E] transition">مواعيدي</a>
              <a href="/my-consultations" className="hover:text-[#AD8A4E] transition">استشاراتي</a>
              <a href="/lawyers" className="hover:text-[#AD8A4E] transition">دليل المحامين</a>
              <a href="/ai-assistant" className="hover:text-[#AD8A4E] transition">مساعد ذكي</a>
              <a href="/legal-articles" className="hover:text-[#AD8A4E] transition">مقالات قانونية</a>

              {!checkingAuth && !loggedIn && (
                <a href="/login" className="hover:text-[#AD8A4E] transition">تسجيل الدخول</a>
              )}

              {!checkingAuth && loggedIn && (
                <div className="relative" ref={menuRef}>
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
              )}
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-[#F3EEE4] flex items-center justify-center text-[#1B1A17] font-['Tajawal'] font-bold text-3xl flex-shrink-0">
              {firm.firm_name.charAt(0)}
            </div>
            <div>
              <h1 className="font-['Tajawal'] font-bold text-3xl md:text-4xl mb-1">{firm.firm_name}</h1>
              <p className="font-['Tajawal'] text-[#AD8A4E]">مكتب محاماة{firm.city ? ' - ' + firm.city : ''}</p>
              {avgRating && (
                <p className="font-['Tajawal'] text-sm text-[#D8D2C4] mt-1">⭐ {avgRating} ({reviews.length} تقييم)</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10 grid grid-cols-1 md:grid-cols-3 gap-8 flex-1 w-full">
                <div className="md:col-span-2">
          {firm.bio && (
            <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-6">
              <h2 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mb-3">نبذة عن المكتب</h2>
              <p className="font-['Tajawal'] text-[#4A473F] leading-relaxed">{firm.bio}</p>
            </div>
          )}

          <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-6">
            <h2 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mb-4">معلومات المكتب</h2>

            <div className="flex flex-col md:flex-row gap-6 mb-4 font-['Tajawal'] text-sm">
              <div className="flex-[3] space-y-3">
                <div>
                  <p className="text-[#4A473F] mb-1">عدد المحامين</p>
                  <p className="text-[#1B1A17] font-medium">{roster.length}</p>
                </div>
                {yearsSinceFounded !== null && (
                  <div>
                    <p className="text-[#4A473F] mb-1">سنوات الخبرة</p>
                    <p className="text-[#1B1A17] font-medium">{yearsSinceFounded} سنة (تأسس عام {firm.founded_year})</p>
                  </div>
                )}
                {firm.city && (
                  <div>
                    <p className="text-[#4A473F] mb-1">المدينة</p>
                    <p className="text-[#1B1A17] font-medium">{firm.city}</p>
                  </div>
                )}
              </div>

              <div className="flex-[2] space-y-3">
                {firm.address && (
                  <div>
                    <p className="text-[#4A473F] mb-1">العنوان</p>
                    <p className="text-[#1B1A17] font-medium">{firm.address}</p>
                  </div>
                )}
                {firmSpecialtyNames && (
                  <div>
                    <p className="text-[#4A473F] mb-1">الاختصاصات المتوفرة</p>
                    <p className="text-[#1B1A17] font-medium">{firmSpecialtyNames}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-4 border-t border-[#D8D2C4]">
              {firm.phone && (
                <a href={phoneLink} className="px-4 py-2 bg-[#F3EEE4] text-[#1B1A17] rounded-md font-['Tajawal'] text-sm hover:bg-[#D8D2C4] transition">
                  📞 {firm.phone}
                </a>
              )}
              {firm.google_maps_link && (
                <a href={firm.google_maps_link} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-[#F3EEE4] text-[#1B1A17] rounded-md font-['Tajawal'] text-sm hover:bg-[#D8D2C4] transition">
                  📍 الموقع على الخريطة
                </a>
              )}
              {firm.website_url && (
                <a href={firm.website_url} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-[#F3EEE4] text-[#1B1A17] rounded-md font-['Tajawal'] text-sm hover:bg-[#D8D2C4] transition">
                  🌐 الموقع الإلكتروني
                </a>
              )}
            </div>
          </div>

          {reviews.length > 0 && (
            <div className="bg-white border border-[#D8D2C4] rounded-lg p-6">
              <h2 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mb-4">التقييمات</h2>
              {reviews.map(function (r) {
                return (
                  <div key={r.id} className="border-b border-[#D8D2C4] last:border-0 pb-3 mb-3 last:pb-0 last:mb-0">
                    <p className="font-['Tajawal'] text-sm text-[#AD8A4E] mb-1">{'⭐'.repeat(r.rating)}</p>
                    {r.comment && <p className="font-['Tajawal'] text-sm text-[#4A473F]">{r.comment}</p>}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div>
          <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 sticky top-6">
            <h2 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mb-4">حجز موعد أو استشارة</h2>

            <BookingGuide />

            {firm.show_lawyer_names ? (
              <select
                value={selectedLawyerId}
                onChange={function (e) { setSelectedLawyerId(e.target.value) }}
                className="w-full px-3 py-2 mb-4 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
              >
                <option value="">اختر المحامي</option>
                {roster.map(function (l) {
                  return <option key={l.id} value={l.id}>{l.full_name} — {getSpecialtyName(l.specialty_id)}</option>
                })}
              </select>
            ) : (
              <select
                value={selectedSpecialtyId}
                onChange={function (e) { setSelectedSpecialtyId(e.target.value) }}
                className="w-full px-3 py-2 mb-4 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
              >
                <option value="">اختر الاختصاص</option>
                {specialties
                  .filter(function (s) { return roster.some(function (l) { return l.specialty_id === s.id }) })
                  .map(function (s) {
                    return <option key={s.id} value={s.id}>{s.name_ar}</option>
                  })}
              </select>
            )}

            {dropdownReady && (
              <div className="mb-6">
                <h3 className="font-['Tajawal'] font-bold text-sm text-[#1B1A17] mb-2">حجز موعد</h3>

                <div className="flex bg-[#F3EEE4] border border-[#D8D2C4] rounded-md p-1 mb-3">
                  <button
                    type="button"
                    onClick={function () { setConsultationType('in_person') }}
                    className={"flex-1 py-2 rounded font-['Tajawal'] text-xs font-medium transition " + (consultationType === 'in_person' ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'text-[#4A473F]')}
                  >
                    حضوري
                  </button>
                  <button
                    type="button"
                    onClick={function () { setConsultationType('video') }}
                    className={"flex-1 py-2 rounded font-['Tajawal'] text-xs font-medium transition " + (consultationType === 'video' ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'text-[#4A473F]')}
                  >
                    عبر الفيديو
                  </button>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
                  {availableDates.map(function (date) {
                    const isSelected = date === selectedDate
                    return (
                      <button
                        key={date}
                        onClick={function () { setSelectedDate(date) }}
                        className={"flex-shrink-0 px-3 py-2 rounded-md font-['Tajawal'] text-xs whitespace-nowrap transition " + (isSelected ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'bg-[#F3EEE4] text-[#4A473F]')}
                      >
                        {formatDayButton(date)}
                      </button>
                    )
                  })}
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  {timeSlots.map(function (slot) {
                    const isBooked = bookedSlots.indexOf(slot) !== -1
                    return (
                      <button
                        key={slot}
                        disabled={isBooked || bookingLoading}
                        onClick={function () { handleBookSlot(slot) }}
                        className={"px-3 py-2 rounded-md font-['Tajawal'] text-sm transition " + (isBooked ? 'bg-[#E5E0D5] text-[#B0AA9C] cursor-not-allowed line-through' : 'bg-[#F3EEE4] text-[#1B1A17] hover:bg-[#AD8A4E] hover:text-white border border-[#D8D2C4]')}
                      >
                        {slot}
                      </button>
                    )
                  })}
                </div>

                {bookingMessage && (
                  <p className="font-['Tajawal'] text-sm text-[#2F4538]">{bookingMessage}</p>
                )}
              </div>
            )}

            <div className="pt-4 border-t border-[#D8D2C4]">
              <h3 className="font-['Tajawal'] font-bold text-sm text-[#1B1A17] mb-2">استشارة سريعة</h3>
              <div className="mb-3">
                <ConsultationFeeNote />
              </div>

              {!consultSubmitted && (
                <div>
                  <textarea
                    value={questionText}
                    onChange={function (e) { setQuestionText(e.target.value) }}
                    placeholder="اكتب سؤالك القانوني هنا..."
                    rows={3}
                    className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17] mb-2"
                  />
                  <button
                    onClick={handleSubmitConsultation}
                    disabled={consultLoading}
                    className="w-full py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal'] font-medium hover:bg-[#AD8A4E] transition disabled:opacity-60"
                  >
                    {consultLoading ? 'جاري الإرسال...' : 'إرسال السؤال'}
                  </button>
                  {consultMessage && (
                    <p className="font-['Tajawal'] text-sm text-[#7A2E2E] mt-2">{consultMessage}</p>
                  )}
                </div>
              )}

              {consultSubmitted && (
                <div className="bg-[#F3EEE4] border border-[#D8D2C4] rounded-md p-4">
                  <p className="font-['Tajawal'] text-sm text-[#2F4538]">تم إرسال سؤالك بنجاح!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Footer variant="customer" />
    </div>
  )
}