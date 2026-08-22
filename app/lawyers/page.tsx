'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase'

type Lawyer = {
  id: number
  full_name: string
  bio: string
  city: string
  years_experience: number
  consultation_fee: number
  photo_url: string | null
  specialty_id: number
  vacation_until: string | null
  firm_id: number | null
}

type Firm = {
  id: number
  firm_name: string
  bio: string | null
  city: string | null
}

type Specialty = {
  id: number
  name_ar: string
}

type Review = {
  lawyer_id: number
  rating: number
}

export default function LawyersPage() {
  const [lawyers, setLawyers] = useState<Lawyer[]>([])
  const [firms, setFirms] = useState<Firm[]>([])
  const [specialties, setSpecialties] = useState<Specialty[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [selectedSpecialty, setSelectedSpecialty] = useState<number | null>(null)
  const [selectedCity, setSelectedCity] = useState<string>('')
  const [viewMode, setViewMode] = useState('individual')
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  useEffect(function () {
    async function loadData() {
      const lawyersResult = await supabase
        .from('lawyers')
        .select('*')
        .eq('is_approved', true)
        .eq('is_active', true)

      const firmsResult = await supabase
        .from('firms')
        .select('*')
        .eq('is_approved', true)
        .eq('is_active', true)

      const specialtiesResult = await supabase.from('specialties').select('*')
      const reviewsResult = await supabase.from('reviews').select('lawyer_id, rating')

      setLawyers(lawyersResult.data || [])
      setFirms(firmsResult.data || [])
      setSpecialties(specialtiesResult.data || [])
      setReviews(reviewsResult.data || [])
      setLoading(false)
    }

    loadData()
  }, [])

  const individualLawyers = lawyers.filter(function (l) { return !l.firm_id })

  const cities = Array.from(new Set(individualLawyers.map(function (l) { return l.city }))).filter(Boolean)

  const filteredLawyers = individualLawyers.filter(function (lawyer) {
    const specialtyMatch = selectedSpecialty ? lawyer.specialty_id === selectedSpecialty : true
    const cityMatch = selectedCity ? lawyer.city === selectedCity : true
    return specialtyMatch && cityMatch
  })

  function getSpecialtyName(specialtyId: number) {
    const specialty = specialties.find(function (s) { return s.id === specialtyId })
    return specialty ? specialty.name_ar : ''
  }

  function getRatingInfo(lawyerId: number) {
    const lawyerReviews = reviews.filter(function (r) { return r.lawyer_id === lawyerId })
    if (lawyerReviews.length === 0) {
      return { average: 0, count: 0 }
    }
    let sum = 0
    for (let i = 0; i < lawyerReviews.length; i++) {
      sum = sum + lawyerReviews[i].rating
    }
    return { average: sum / lawyerReviews.length, count: lawyerReviews.length }
  }

  function isOnVacation(lawyer: Lawyer) {
    if (!lawyer.vacation_until) return false
    const today = new Date()
    const vacationEnd = new Date(lawyer.vacation_until)
    return vacationEnd >= today
  }

  function renderLawyerCard(lawyer: Lawyer) {
    const ratingInfo = getRatingInfo(lawyer.id)
    const profileLink = '/lawyers/' + lawyer.id
    const onVacation = isOnVacation(lawyer)

    return (
      <div key={lawyer.id} className="bg-white border border-[#D8D2C4] rounded-lg p-6 hover:shadow-lg transition relative">
        {onVacation && (
          <div className="absolute top-3 left-3 bg-[#7A2E2E] text-white text-xs font-['Tajawal'] px-2 py-1 rounded-full">
            في إجازة حتى {lawyer.vacation_until}
          </div>
        )}

        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-[#1B1A17] flex items-center justify-center text-[#AD8A4E] font-['Amiri'] text-2xl">
            {lawyer.full_name.charAt(0)}
          </div>
          <div>
            <h3 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17]">{lawyer.full_name}</h3>
            <p className="font-['Tajawal'] text-sm text-[#AD8A4E]">{getSpecialtyName(lawyer.specialty_id)}</p>
          </div>
        </div>

        {ratingInfo.count > 0 && (
          <div className="flex items-center gap-1 mb-4">
            <svg className="w-4 h-4 text-[#AD8A4E]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            <span className="font-['Tajawal'] text-sm font-medium text-[#1B1A17]">{ratingInfo.average.toFixed(1)}</span>
            <span className="font-['Tajawal'] text-sm text-[#4A473F]">({ratingInfo.count} تقييم)</span>
          </div>
        )}

        <p className="font-['Tajawal'] text-sm text-[#4A473F] mb-4 line-clamp-2">{lawyer.bio}</p>

        <div className="flex justify-between items-center text-sm font-['Tajawal'] text-[#4A473F] mb-4">
          <span>{lawyer.city}</span>
          <span>{lawyer.years_experience} سنوات خبرة</span>
        </div>

        <div className="flex justify-between items-center pt-4 border-t border-[#D8D2C4]">
          <span className="font-['Tajawal'] font-bold text-[#1B1A17]">{lawyer.consultation_fee} د.أ</span>
          <a href={profileLink} className="px-4 py-2 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal'] text-sm hover:bg-[#AD8A4E] transition">
            عرض الملف
          </a>
        </div>
      </div>
    )
  }

  function renderFirmCard(firm: Firm) {
    const profileLink = '/firms/' + firm.id

    return (
      <div key={firm.id} className="bg-white border border-[#D8D2C4] rounded-lg p-6 hover:shadow-lg transition">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-[#1B1A17] flex items-center justify-center text-[#AD8A4E] font-['Amiri'] text-2xl">
            {firm.firm_name.charAt(0)}
          </div>
          <div>
            <h3 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17]">{firm.firm_name}</h3>
            <p className="font-['Tajawal'] text-sm text-[#AD8A4E]">مكتب محاماة</p>
          </div>
        </div>

        {firm.bio && (
          <p className="font-['Tajawal'] text-sm text-[#4A473F] mb-4 line-clamp-2">{firm.bio}</p>
        )}

        <div className="flex justify-between items-center pt-4 border-t border-[#D8D2C4]">
          <span className="font-['Tajawal'] text-sm text-[#4A473F]">{firm.city || ''}</span>
          <a href={profileLink} className="px-4 py-2 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal'] text-sm hover:bg-[#AD8A4E] transition">
            عرض الملف
          </a>
        </div>
      </div>
    )
  }

  return (
    <div dir="rtl" className="min-h-screen pattern-bg">
      <div className="bg-[#1B1A17] text-[#F3EEE4] py-12 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex justify-between items-center mb-8 font-['Tajawal'] text-sm">
            <a href="/" className="font-['Amiri'] text-xl">حمورابي</a>
            <div className="flex gap-5">
              <a href="/lawyers" className="hover:text-[#AD8A4E] transition">دليل المحامين</a>
              <a href="/my-consultations" className="hover:text-[#AD8A4E] transition">استشاراتي</a>
              <a href="/login" className="hover:text-[#AD8A4E] transition">تسجيل الدخول</a>
            </div>
          </div>
          <h1 className="font-['Amiri'] text-4xl md:text-5xl mb-3">دليل المحامين</h1>
          <div className="w-16 h-[2px] bg-[#AD8A4E] mb-6"></div>
          <p className="font-['Tajawal'] text-[#D8D2C4]">ابحث عن محامٍ موثوق حسب التخصص والمدينة</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex bg-white border border-[#D8D2C4] rounded-md p-1 mb-6 w-fit">
          <button
            onClick={function () { setViewMode('individual') }}
            className={
              "px-5 py-2 rounded font-['Tajawal'] text-sm font-medium transition " +
              (viewMode === 'individual' ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'text-[#4A473F]')
            }
          >
            محامون أفراد
          </button>
          <button
            onClick={function () { setViewMode('firms') }}
            className={
              "px-5 py-2 rounded font-['Tajawal'] text-sm font-medium transition " +
              (viewMode === 'firms' ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'text-[#4A473F]')
            }
          >
            مكاتب محاماة
          </button>
        </div>

        {viewMode === 'individual' && (
          <div>
            <div className="flex flex-col md:flex-row gap-4 mb-10">
              <div className="relative">
                <select
                  value={selectedSpecialty ?? ''}
                  onChange={function (e) { setSelectedSpecialty(e.target.value ? Number(e.target.value) : null) }}
                  className="w-full appearance-none px-4 py-3 pl-10 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-[#1B1A17] focus:outline-none focus:ring-2 focus:ring-[#AD8A4E]"
                >
                  <option value="">كل التخصصات</option>
                  {specialties.map(function (s) {
                    return <option key={s.id} value={s.id}>{s.name_ar}</option>
                  })}
                </select>
                <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4A473F]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>

              <div className="relative">
                <select
                  value={selectedCity}
                  onChange={function (e) { setSelectedCity(e.target.value) }}
                  className="w-full appearance-none px-4 py-3 pl-10 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-[#1B1A17] focus:outline-none focus:ring-2 focus:ring-[#AD8A4E]"
                >
                  <option value="">كل المدن</option>
                  {cities.map(function (city) {
                    return <option key={city} value={city}>{city}</option>
                  })}
                </select>
                <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4A473F]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>

            {loading && <p className="font-['Tajawal'] text-[#4A473F]">جاري التحميل...</p>}

            {!loading && filteredLawyers.length === 0 && (
              <p className="font-['Tajawal'] text-[#4A473F]">لا يوجد محامون مطابقون لهذا البحث حالياً</p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredLawyers.map(renderLawyerCard)}
            </div>
          </div>
        )}

        {viewMode === 'firms' && (
          <div>
            {loading && <p className="font-['Tajawal'] text-[#4A473F]">جاري التحميل...</p>}

            {!loading && firms.length === 0 && (
              <p className="font-['Tajawal'] text-[#4A473F]">لا يوجد مكاتب محاماة مسجلة حالياً</p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {firms.map(renderFirmCard)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}