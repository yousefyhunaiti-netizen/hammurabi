'use client'

import { useEffect, useState } from 'react'
import { createClient } from './lib/supabase'

type Lawyer = {
  id: number
  full_name: string
  city: string
  consultation_fee: number
  specialty_id: number
}

type Specialty = {
  id: number
  name_ar: string
}

export default function HomePage() {
  const [lawyers, setLawyers] = useState<Lawyer[]>([])
  const [specialties, setSpecialties] = useState<Specialty[]>([])

  const supabase = createClient()

  useEffect(function () {
    async function loadPreview() {
      const lawyersResult = await supabase
        .from('lawyers')
        .select('id, full_name, city, consultation_fee, specialty_id')
        .eq('is_approved', true)
        .eq('is_active', true)
        .limit(6)

      const specialtiesResult = await supabase.from('specialties').select('*')

      setLawyers(lawyersResult.data || [])
      setSpecialties(specialtiesResult.data || [])
    }

    loadPreview()
  }, [])

  function getSpecialtyName(specialtyId: number) {
    const found = specialties.find(function (s) { return s.id === specialtyId })
    return found ? found.name_ar : ''
  }

  const navLoginClass = "px-5 py-2 font-['Tajawal'] text-sm border border-[#F3EEE4] rounded-md hover:bg-[#F3EEE4] hover:text-[#1B1A17] transition"
  const navSignupClass = "px-5 py-2 font-['Tajawal'] text-sm bg-[#AD8A4E] rounded-md hover:bg-[#c49b58] transition"
  const heroCtaClass = "inline-block px-8 py-4 bg-[#AD8A4E] text-white font-['Tajawal'] font-medium rounded-md hover:bg-[#c49b58] transition"
  const cardClass = "bg-white border border-[#D8D2C4] rounded-lg p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 block opacity-0"
  const viewAllClass = "inline-block px-6 py-3 border border-[#1B1A17] text-[#1B1A17] font-['Tajawal'] rounded-md hover:bg-[#1B1A17] hover:text-[#F3EEE4] transition"

  function renderLawyerCard(lawyer: Lawyer, index: number) {
    const link = '/lawyers/' + lawyer.id
    const delay = (index * 0.1) + 's'
    const cardStyle = { animation: 'fadeInUp 0.6s ease-out ' + delay + ' forwards' }

    return (
      <a key={lawyer.id} href={link} className={cardClass} style={cardStyle}>
        <div className="flex items-center gap-4 mb-3">
          <div className="w-12 h-12 rounded-full bg-[#1B1A17] flex items-center justify-center text-[#AD8A4E] font-['Amiri'] text-xl">
            {lawyer.full_name.charAt(0)}
          </div>
          <div>
            <h4 className="font-['Tajawal'] font-bold text-[#1B1A17]">{lawyer.full_name}</h4>
            <p className="font-['Tajawal'] text-xs text-[#AD8A4E]">{getSpecialtyName(lawyer.specialty_id)}</p>
          </div>
        </div>
        <div className="flex justify-between text-sm font-['Tajawal'] text-[#4A473F]">
          <span>{lawyer.city}</span>
          <span>{lawyer.consultation_fee} د.أ</span>
        </div>
      </a>
    )
  }

  return (
    <div dir="rtl" className="min-h-screen pattern-bg">
      <div className="bg-[#1B1A17] text-[#F3EEE4]">
        <div className="max-w-6xl mx-auto px-6 py-5 flex justify-between items-center">
          <h1 className="font-['Amiri'] text-2xl">حمورابي</h1>
          <div className="flex gap-3">
            <a href="/login" className={navLoginClass}>تسجيل الدخول</a>
            <a href="/signup" className={navSignupClass}>إنشاء حساب</a>
          </div>
        </div>

        <div className="relative max-w-6xl mx-auto px-6 py-20 md:py-28 text-center overflow-hidden">
          <div className="relative z-10">
            <h2 className="font-['Amiri'] text-4xl md:text-6xl leading-tight mb-6">
              محاموك الموثوق، بضغطة واحدة
            </h2>
            <div className="w-20 h-[2px] shimmer-line mx-auto mb-6"></div>
            <p className="font-['Tajawal'] text-lg text-[#D8D2C4] max-w-2xl mx-auto mb-10 leading-relaxed">
              منصة حمورابي تربطك بمحامين موثوقين في الأردن، حسب التخصص والمدينة، مع إمكانية حجز موعد أو طلب استشارة سريعة مباشرة من هاتفك.
            </p>
            <a href="/lawyers" className={heroCtaClass}>تصفح المحامين</a>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <h3 className="font-['Amiri'] text-3xl text-[#1B1A17] mb-2">محامون على المنصة</h3>
          <p className="font-['Tajawal'] text-[#4A473F]">نخبة من المحامين الموثوقين جاهزون لمساعدتك</p>
        </div>

        {lawyers.length === 0 && (
          <p className="font-['Tajawal'] text-center text-[#4A473F]">لا يوجد محامون حالياً</p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
          {lawyers.map(renderLawyerCard)}
        </div>

        <div className="text-center">
          <a href="/lawyers" className={viewAllClass}>عرض جميع المحامين</a>
        </div>
      </div>

      <div className="bg-[#1B1A17] text-[#D8D2C4] py-8 text-center">
        <p className="font-['Tajawal'] text-sm">© حمورابي 2026 — جميع الحقوق محفوظة</p>
      </div>
    </div>
  )
}