'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '../../lib/supabase'

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
}

type Specialty = {
  id: number
  name_ar: string
}

type FirmLawyer = {
  id: number
  full_name: string
  specialty_id: number
  city: string
  years_experience: number
  consultation_fee: number
}

export default function FirmDetailPage() {
  const params = useParams()
  const firmId = Number(params.id)

  const [firm, setFirm] = useState<Firm | null>(null)
  const [specialties, setSpecialties] = useState<Specialty[]>([])
  const [roster, setRoster] = useState<FirmLawyer[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  useEffect(function () {
    async function loadData() {
      const firmResult = await supabase.from('firms').select('*').eq('id', firmId).single()
      setFirm(firmResult.data)

      const specialtiesResult = await supabase.from('specialties').select('*')
      setSpecialties(specialtiesResult.data || [])

      const rosterResult = await supabase
        .from('lawyers')
        .select('id, full_name, specialty_id, city, years_experience, consultation_fee')
        .eq('firm_id', firmId)

      setRoster(rosterResult.data || [])
      setLoading(false)
    }

    loadData()
  }, [firmId])

  function getSpecialtyName(specialtyId: number) {
    const found = specialties.find(function (s) { return s.id === specialtyId })
    return found ? found.name_ar : ''
  }

  function renderLawyerRow(lawyer: FirmLawyer) {
    const link = '/lawyers/' + lawyer.id
    return (
      <a key={lawyer.id} href={link} className="flex justify-between items-center bg-[#F3EEE4] rounded-md p-4 mb-2 hover:bg-[#D8D2C4] transition">
        <div>
          <p className="font-['Tajawal'] font-medium text-[#1B1A17]">{lawyer.full_name}</p>
          <p className="font-['Tajawal'] text-xs text-[#AD8A4E]">{getSpecialtyName(lawyer.specialty_id)} - {lawyer.city}</p>
        </div>
        <span className="font-['Tajawal'] text-sm text-[#4A473F]">{lawyer.consultation_fee} د.أ</span>
      </a>
    )
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

  return (
    <div dir="rtl" className="min-h-screen pattern-bg">
      <div className="bg-[#1B1A17] text-[#F3EEE4] py-14 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-8 font-['Tajawal'] text-sm">
            <a href="/" className="font-['Amiri'] text-xl">حمورابي</a>
            <div className="flex gap-5">
              <a href="/lawyers" className="hover:text-[#AD8A4E] transition">دليل المحامين</a>
              <a href="/my-consultations" className="hover:text-[#AD8A4E] transition">استشاراتي</a>
              <a href="/login" className="hover:text-[#AD8A4E] transition">تسجيل الدخول</a>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-[#F3EEE4] flex items-center justify-center text-[#1B1A17] font-['Amiri'] text-3xl flex-shrink-0">
              {firm.firm_name.charAt(0)}
            </div>
            <div>
              <h1 className="font-['Amiri'] text-3xl md:text-4xl mb-1">{firm.firm_name}</h1>
              <p className="font-['Tajawal'] text-[#AD8A4E]">مكتب محاماة</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10">
        {firm.bio && (
          <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-6">
            <h2 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mb-3">نبذة عن المكتب</h2>
            <p className="font-['Tajawal'] text-[#4A473F] leading-relaxed">{firm.bio}</p>
          </div>
        )}

        <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-6">
          <h2 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mb-4">التفاصيل</h2>
          <div className="flex flex-wrap gap-2">
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

        <div className="bg-white border border-[#D8D2C4] rounded-lg p-6">
          <h2 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mb-4">محامو المكتب</h2>

          {firm.show_lawyer_names ? (
            <div>
              {roster.length === 0 && (
                <p className="font-['Tajawal'] text-sm text-[#4A473F]">لا يوجد محامون مضافون بعد</p>
              )}
              {roster.map(renderLawyerRow)}
            </div>
          ) : (
            <p className="font-['Tajawal'] text-sm text-[#4A473F] bg-[#F3EEE4] rounded-md p-4">
              سيقوم المكتب باختيار المحامي المناسب لقضيتك بعد التواصل معك
            </p>
          )}
        </div>
      </div>
    </div>
  )
}