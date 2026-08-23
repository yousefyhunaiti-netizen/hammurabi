'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
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
  const router = useRouter()
  const firmId = Number(params.id)

  const [firm, setFirm] = useState<Firm | null>(null)
  const [specialties, setSpecialties] = useState<Specialty[]>([])
  const [roster, setRoster] = useState<FirmLawyer[]>([])
  const [loading, setLoading] = useState(true)
  const [loggedIn, setLoggedIn] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [infoLink, setInfoLink] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)

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
            <div className="flex gap-5 items-center">
              <a href="/lawyers" className="hover:text-[#AD8A4E] transition">دليل المحامين</a>
              <a href="/my-appointments" className="hover:text-[#AD8A4E] transition">مواعيدي</a>
              <a href="/my-consultations" className="hover:text-[#AD8A4E] transition">استشاراتي</a>

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