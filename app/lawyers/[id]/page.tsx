'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'

type Lawyer = {
  id: number
  full_name: string
  bio: string
  city: string
  address: string
  years_experience: number
  consultation_fee: number
  photo_url: string | null
  specialty_id: number
  bar_certificate_number: string
  phone: string
  email: string
  working_days: string
  working_hours_start: string
  working_hours_end: string
  vacation_until: string | null
  google_maps_link: string | null
  website_url: string | null
}

type Specialty = {
  id: number
  name_ar: string
}

type Review = {
  id: number
  rating: number
  comment: string
  created_at: string
}

type SlotRow = {
  time_slot: string
}

const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']

export default function LawyerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const lawyerId = Number(params.id)

  const [lawyer, setLawyer] = useState<Lawyer | null>(null)
  const [specialty, setSpecialty] = useState<Specialty | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [loggedIn, setLoggedIn] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [infoLink, setInfoLink] = useState('')
  const [isLawyerAccount, setIsLawyerAccount] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const [availableDates, setAvailableDates] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [bookedSlots, setBookedSlots] = useState<string[]>([])
  const [bookingMessage, setBookingMessage] = useState('')
  const [bookingLoading, setBookingLoading] = useState(false)
  const [myBookingId, setMyBookingId] = useState<number | null>(null)
  const [mySlot, setMySlot] = useState<string>('')
  const [myMeetingLink, setMyMeetingLink] = useState('')
  const [consultationType, setConsultationType] = useState('in_person')

  const [showConsultForm, setShowConsultForm] = useState(false)
  const [questionText, setQuestionText] = useState('')
  const [consultMessage, setConsultMessage] = useState('')
  const [consultLoading, setConsultLoading] = useState(false)
  const [consultSubmitted, setConsultSubmitted] = useState(false)

  const supabase = createClient()

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
      }

      setCheckingAuth(false)

      const lawyerResult = await supabase.from('lawyers').select('*').eq('id', lawyerId).single()

      if (lawyerResult.data) {
        setLawyer(lawyerResult.data)

        const workingDaysList = lawyerResult.data.working_days.split(',').map(function (d: string) {
          return Number(d)
        })

        const vacationUntil = lawyerResult.data.vacation_until

        const specialtyResult = await supabase
          .from('specialties')
          .select('*')
          .eq('id', lawyerResult.data.specialty_id)
          .single()

        setSpecialty(specialtyResult.data)

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
            dates.push(yyyy + '-' + mm + '-' + dd)
            daysFound = daysFound + 1
          }
          daysChecked = daysChecked + 1
        }

        setAvailableDates(dates)

        let defaultDate = ''
        for (let i = 0; i < dates.length; i++) {
          const isVacationDate = vacationUntil ? dates[i] <= vacationUntil : false
          if (!isVacationDate) {
            defaultDate = dates[i]
            break
          }
        }
        if (!defaultDate && dates.length > 0) {
          defaultDate = dates[0]
        }
        setSelectedDate(defaultDate)
      }

      const reviewsResult = await supabase
        .from('reviews')
        .select('*')
        .eq('lawyer_id', lawyerId)
        .order('created_at', { ascending: false })

      setReviews(reviewsResult.data || [])
      setLoading(false)
    }

    loadData()
  }, [lawyerId])

  useEffect(function () {
    async function loadBookedSlots() {
      if (!selectedDate) return

      const result = await supabase
        .from('appointments')
        .select('time_slot')
        .eq('lawyer_id', lawyerId)
        .eq('appointment_date', selectedDate)

      const rows: SlotRow[] = result.data || []
      const slots: string[] = rows.map(function (a) {
        return a.time_slot
      })
      setBookedSlots(slots)
      setBookingMessage('')
      setMyBookingId(null)
      setMyMeetingLink('')
    }

    loadBookedSlots()
  }, [selectedDate, lawyerId])

  async function handleLogout() {
    await supabase.auth.signOut()
    setLoggedIn(false)
    setMenuOpen(false)
    router.push('/')
  }

  function toggleMenu() {
    setMenuOpen(!menuOpen)
  }

  function getTimeSlots() {
    if (!lawyer) return []
    const startHour = Number(lawyer.working_hours_start.split(':')[0])
    const endHour = Number(lawyer.working_hours_end.split(':')[0])
    const slots: string[] = []
    for (let h = startHour; h < endHour; h++) {
      slots.push(String(h).padStart(2, '0') + ':00')
    }
    return slots
  }

  function parseDate(dateStr: string) {
    const parts = dateStr.split('-')
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
  }

  function formatDayButton(dateStr: string) {
    const parts = dateStr.split('-')
    const dateObj = parseDate(dateStr)
    return dayNames[dateObj.getDay()] + ' ' + parts[2]
  }

  function formatFullHeader(dateStr: string) {
    const parts = dateStr.split('-')
    const dateObj = parseDate(dateStr)
    return dayNames[dateObj.getDay()] + ' ' + parts[2] + ' ' + monthNames[dateObj.getMonth()] + ' ' + parts[0]
  }

  function isOnVacation() {
    if (!lawyer || !lawyer.vacation_until) return false
    const today = new Date()
    const vacationEnd = new Date(lawyer.vacation_until)
    return vacationEnd >= today
  }

  function isDateBlocked(dateStr: string) {
    if (!lawyer || !lawyer.vacation_until) return false
    return dateStr <= lawyer.vacation_until
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
      const roomName = 'hammurabi-' + lawyerId + '-' + Date.now()
      generatedLink = 'https://meet.jit.si/' + roomName
    }

    const insertResult = await supabase
      .from('appointments')
      .insert({
        lawyer_id: lawyerId,
        customer_id: userResult.data.user.id,
        appointment_date: selectedDate,
        time_slot: slot,
        status: 'confirmed',
        consultation_type: consultationType,
        meeting_link: generatedLink,
      })
      .select()
      .single()

    setBookingLoading(false)

    if (insertResult.error) {
      setBookingMessage('حدث خطأ أثناء الحجز، حاول مرة أخرى')
      return
    }

    setBookingMessage('تم حجز موعدك بنجاح!')
    setBookedSlots(bookedSlots.concat([slot]))
    setMyBookingId(insertResult.data.id)
    setMySlot(slot)
    setMyMeetingLink(generatedLink)
  }

  async function handleCancelBooking() {
    if (!myBookingId) return
    setBookingLoading(true)

    await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', myBookingId)

    setBookedSlots(bookedSlots.filter(function (s) { return s !== mySlot }))
    setMyBookingId(null)
    setMySlot('')
    setMyMeetingLink('')
    setBookingMessage('تم إلغاء الحجز')
    setBookingLoading(false)
  }

  async function handleSubmitConsultation() {
    setConsultMessage('')

    if (!questionText.trim()) {
      setConsultMessage('يرجى كتابة سؤالك أولاً')
      return
    }

    setConsultLoading(true)

    const userResult = await supabase.auth.getUser()

    if (!userResult.data.user) {
      setConsultLoading(false)
      setConsultMessage('يرجى تسجيل الدخول أولاً لإرسال استشارة')
      return
    }

    const insertResult = await supabase.from('consultations').insert({
      lawyer_id: lawyerId,
      customer_id: userResult.data.user.id,
      question: questionText,
      status: 'pending',
      fee: lawyer ? lawyer.consultation_fee : 0,
    })

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

  if (!lawyer) {
    return (
      <div dir="rtl" className="min-h-screen pattern-bg flex items-center justify-center">
        <p className="font-['Tajawal'] text-[#4A473F]">لم يتم العثور على هذا المحامي</p>
      </div>
    )
  }

  let averageRating = 0
  for (let i = 0; i < reviews.length; i++) {
    averageRating = averageRating + reviews[i].rating
  }
  if (reviews.length > 0) {
    averageRating = averageRating / reviews.length
  }

  const timeSlots = getTimeSlots()
  const onVacation = isOnVacation()
  const phoneLink = 'tel:' + lawyer.phone
  const selectedDateBlocked = isDateBlocked(selectedDate)

  return (
    <div dir="rtl" className="min-h-screen pattern-bg">
      <div className="bg-[#1B1A17] text-[#F3EEE4] py-14 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-8 font-['Tajawal'] text-sm">
            <a href="/" className="font-['Amiri'] text-xl">حمورابي</a>
            <div className="flex gap-5 items-center">
              <a href="/lawyers" className="hover:text-[#AD8A4E] transition">دليل المحامين</a>
              <a href="/my-appointments" className="hover:text-[#AD8A4E] transition">مواعيدي</a>
              <a href="/my-consultations" className="hover:text-[#AD8A4E] transition">استشاراتي</a>
              {isLawyerAccount && (
                <a href="/lawyer-tools" className="hover:text-[#AD8A4E] transition">أدواتي</a>
              )}

              {!checkingAuth && !loggedIn && (
                <a href="/login" className="hover:text-[#AD8A4E] transition">تسجيل الدخول</a>
              )}

              {!checkingAuth && loggedIn && (
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
              )}
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-[#F3EEE4] flex items-center justify-center text-[#1B1A17] font-['Amiri'] text-4xl flex-shrink-0">
              {lawyer.full_name.charAt(0)}
            </div>
            <div>
              <h1 className="font-['Amiri'] text-3xl md:text-4xl mb-2">{lawyer.full_name}</h1>
              <p className="font-['Tajawal'] text-[#AD8A4E] mb-2">{specialty ? specialty.name_ar : ''}</p>
              {reviews.length > 0 && (
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4 text-[#AD8A4E]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                  <span className="font-['Tajawal'] text-sm">{averageRating.toFixed(1)}</span>
                  <span className="font-['Tajawal'] text-sm text-[#D8D2C4]">({reviews.length} تقييم)</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {onVacation && (
        <div className="max-w-4xl mx-auto px-6 pt-6">
          <div className="bg-[#7A2E2E] text-white rounded-lg px-4 py-3 font-['Tajawal'] text-sm">
            هذا المحامي في إجازة حتى {lawyer.vacation_until} — قد يتأخر الرد على الاستشارات، والمواعيد غير متاحة حتى هذا التاريخ
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-6 py-10 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2">
          <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-6">
            <h2 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mb-3">نبذة</h2>
            <p className="font-['Tajawal'] text-[#4A473F] leading-relaxed">{lawyer.bio}</p>
          </div>

          <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-6">
            <h2 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mb-3">التفاصيل</h2>
            <div className="grid grid-cols-2 gap-4 font-['Tajawal'] text-sm mb-4">
              <div>
                <p className="text-[#4A473F] mb-1">رقم النقابة</p>
                <p className="text-[#1B1A17] font-medium">{lawyer.bar_certificate_number}</p>
              </div>
              <div>
                <p className="text-[#4A473F] mb-1">سنوات الخبرة</p>
                <p className="text-[#1B1A17] font-medium">{lawyer.years_experience}</p>
              </div>
              <div>
                <p className="text-[#4A473F] mb-1">المدينة</p>
                <p className="text-[#1B1A17] font-medium">{lawyer.city}</p>
              </div>
              <div>
                <p className="text-[#4A473F] mb-1">العنوان</p>
                <p className="text-[#1B1A17] font-medium">{lawyer.address}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-4 border-t border-[#D8D2C4]">
              <a href={phoneLink} className="px-4 py-2 bg-[#F3EEE4] text-[#1B1A17] rounded-md font-['Tajawal'] text-sm hover:bg-[#D8D2C4] transition">
                📞 {lawyer.phone}
              </a>
              {lawyer.google_maps_link && (
                <a href={lawyer.google_maps_link} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-[#F3EEE4] text-[#1B1A17] rounded-md font-['Tajawal'] text-sm hover:bg-[#D8D2C4] transition">
                  📍 الموقع على الخريطة
                </a>
              )}
              {lawyer.website_url && (
                <a href={lawyer.website_url} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-[#F3EEE4] text-[#1B1A17] rounded-md font-['Tajawal'] text-sm hover:bg-[#D8D2C4] transition">
                  🌐 الموقع الإلكتروني
                </a>
              )}
            </div>
          </div>

          <div className="bg-white border border-[#D8D2C4] rounded-lg p-6">
            <h2 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mb-4">التقييمات</h2>
            {reviews.length === 0 && (
              <p className="font-['Tajawal'] text-sm text-[#4A473F]">لا توجد تقييمات بعد</p>
            )}
            {reviews.map(function (review) {
              return (
                <div key={review.id} className="border-b border-[#D8D2C4] last:border-0 py-4 first:pt-0">
                  <div className="flex items-center gap-1 mb-2">
                    <svg className="w-4 h-4 text-[#AD8A4E]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    <span className="font-['Tajawal'] text-sm font-medium text-[#1B1A17]">{review.rating}/5</span>
                  </div>
                  <p className="font-['Tajawal'] text-sm text-[#4A473F]">{review.comment}</p>
                </div>
              )
            })}
          </div>
        </div>

        <div>
          <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 sticky top-6">
            <p className="font-['Tajawal'] text-sm text-[#4A473F] mb-1">رسوم الاستشارة</p>
            <p className="font-['Tajawal'] font-bold text-2xl text-[#1B1A17] mb-5">{lawyer.consultation_fee} د.أ</p>

            <div className="mb-5">
              <h3 className="font-['Tajawal'] font-bold text-[#1B1A17] mb-1">حجز موعد</h3>
              <p className="font-['Tajawal'] text-xs text-[#4A473F] mb-3">مناسب للقضايا التي تحتاج جلسة كاملة</p>

              <div className="flex bg-[#F3EEE4] border border-[#D8D2C4] rounded-md p-1 mb-4">
                <button
                  type="button"
                  onClick={function () { setConsultationType('in_person') }}
                  className={
                    "flex-1 py-2 rounded font-['Tajawal'] text-xs font-medium transition " +
                    (consultationType === 'in_person' ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'text-[#4A473F]')
                  }
                >
                  حضوري
                </button>
                <button
                  type="button"
                  onClick={function () { setConsultationType('video') }}
                  className={
                    "flex-1 py-2 rounded font-['Tajawal'] text-xs font-medium transition " +
                    (consultationType === 'video' ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'text-[#4A473F]')
                  }
                >
                  عبر الفيديو
                </button>
              </div>

              {selectedDate && (
                <p className="font-['Tajawal'] text-xs text-[#AD8A4E] mb-2">{formatFullHeader(selectedDate)}</p>
              )}

              <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
                {availableDates.map(function (date) {
                  const isSelected = date === selectedDate
                  const isBlocked = isDateBlocked(date)
                  return (
                    <button
                      key={date}
                      disabled={isBlocked}
                      onClick={function () { if (!isBlocked) { setSelectedDate(date) } }}
                      className={
                        "flex-shrink-0 px-3 py-2 rounded-md font-['Tajawal'] text-xs whitespace-nowrap transition " +
                        (isBlocked
                          ? 'bg-[#E5E0D5] text-[#B0AA9C] line-through cursor-not-allowed'
                          : isSelected
                          ? 'bg-[#1B1A17] text-[#F3EEE4]'
                          : 'bg-[#F3EEE4] text-[#4A473F] hover:bg-[#D8D2C4]')
                      }
                    >
                      {formatDayButton(date)}
                    </button>
                  )
                })}
              </div>

              {selectedDateBlocked && (
                <p className="font-['Tajawal'] text-sm text-[#7A2E2E] mb-3">المحامي في إجازة في هذا التاريخ</p>
              )}

              {!selectedDateBlocked && (
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {timeSlots.map(function (slot) {
                    const isBooked = bookedSlots.indexOf(slot) !== -1
                    const isMine = slot === mySlot && myBookingId !== null
                    return (
                      <button
                        key={slot}
                        disabled={(isBooked && !isMine) || bookingLoading}
                        onClick={function () {
                          if (isMine) {
                            handleCancelBooking()
                          } else if (!isBooked) {
                            handleBookSlot(slot)
                          }
                        }}
                        className={
                          "px-3 py-2 rounded-md font-['Tajawal'] text-sm transition " +
                          (isMine
                            ? 'bg-[#2F4538] text-white'
                            : isBooked
                            ? 'bg-[#E5E0D5] text-[#B0AA9C] cursor-not-allowed line-through'
                            : 'bg-[#F3EEE4] text-[#1B1A17] hover:bg-[#AD8A4E] hover:text-white border border-[#D8D2C4]')
                        }
                      >
                        {isMine ? slot + ' ✓' : slot}
                      </button>
                    )
                  })}
                </div>
              )}

              {myBookingId && myMeetingLink && (
                <div className="bg-[#2F4538] rounded-md p-3 mb-2">
                  <p className="font-['Tajawal'] text-xs text-white mb-1">رابط الاجتماع:</p>
                  <a href={myMeetingLink} target="_blank" rel="noopener noreferrer" className="font-['Tajawal'] text-xs text-white underline break-all">
                    {myMeetingLink}
                  </a>
                </div>
              )}

              {myBookingId && (
                <button
                  onClick={handleCancelBooking}
                  disabled={bookingLoading}
                  className="w-full py-2 mb-2 text-sm font-['Tajawal'] text-[#7A2E2E] hover:underline"
                >
                  إلغاء الحجز
                </button>
              )}

              {bookingMessage && (
                <p className="font-['Tajawal'] text-sm text-[#2F4538] mb-2">{bookingMessage}</p>
              )}
            </div>

            <div className="pt-5 border-t border-[#D8D2C4]">
              <h3 className="font-['Tajawal'] font-bold text-[#1B1A17] mb-1">استشارة سريعة</h3>
              <p className="font-['Tajawal'] text-xs text-[#4A473F] mb-3">للأسئلة البسيطة التي لا تحتاج جلسة كاملة</p>

              {!showConsultForm && !consultSubmitted && (
                <button
                  onClick={function () { setShowConsultForm(true) }}
                  className="w-full py-3 border border-[#1B1A17] text-[#1B1A17] rounded-md font-['Tajawal'] font-medium hover:bg-[#1B1A17] hover:text-[#F3EEE4] transition"
                >
                  تواصل للاستشارة
                </button>
              )}

              {showConsultForm && !consultSubmitted && (
                <div>
                  <textarea
                    value={questionText}
                    onChange={function (e) { setQuestionText(e.target.value) }}
                    placeholder="اكتب سؤالك القانوني هنا..."
                    rows={4}
                    className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17] focus:outline-none focus:ring-2 focus:ring-[#AD8A4E] mb-3"
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
                  <p className="font-['Tajawal'] text-sm text-[#2F4538]">
                    تم إرسال سؤالك بنجاح! سيقوم المحامي بمراجعته والرد عليك قريباً. يمكنك متابعة حالة استشارتك من صفحة "استشاراتي".
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}