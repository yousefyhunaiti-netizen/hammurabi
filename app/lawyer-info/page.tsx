'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'

type Lawyer = {
  id: number
  full_name: string
  bio: string | null
  specialty_id: number | null
  city: string | null
  address: string | null
  phone: string | null
  email: string | null
  consultation_fee: number | null
  hourly_rate_range: string | null
  years_experience: number | null
  bar_certificate_number: string | null
  working_days: string | null
  working_hours_start: string | null
  working_hours_end: string | null
  vacation_until: string | null
  firm_id: number | null
  pending_firm_id: number | null
}

type Specialty = {
  id: number
  name_ar: string
}

const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

export default function LawyerInfoPage() {
  const [loading, setLoading] = useState(true)
  const [lawyer, setLawyer] = useState<Lawyer | null>(null)
  const [specialty, setSpecialty] = useState<Specialty | null>(null)
  const [notLawyer, setNotLawyer] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [firmName, setFirmName] = useState('')
  const [pendingFirmName, setPendingFirmName] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)

  const supabase = createClient()
  const router = useRouter()

  async function loadLawyerData() {
    const userResult = await supabase.auth.getUser()

    if (!userResult.data.user) {
      setNotLawyer(true)
      setLoading(false)
      return
    }

    const lawyerResult = await supabase
      .from('lawyers')
      .select('*')
      .eq('user_id', userResult.data.user.id)
      .single()

    if (!lawyerResult.data) {
      setNotLawyer(true)
      setLoading(false)
      return
    }

    setLawyer(lawyerResult.data)

    if (lawyerResult.data.specialty_id) {
      const specialtyResult = await supabase
        .from('specialties')
        .select('*')
        .eq('id', lawyerResult.data.specialty_id)
        .single()
      setSpecialty(specialtyResult.data)
    }

    if (lawyerResult.data.firm_id) {
      const firmResult = await supabase.from('firms').select('firm_name').eq('id', lawyerResult.data.firm_id).single()
      setFirmName(firmResult.data ? firmResult.data.firm_name : '')
    }

    if (lawyerResult.data.pending_firm_id) {
      const pendingFirmResult = await supabase.from('firms').select('firm_name').eq('id', lawyerResult.data.pending_firm_id).single()
      setPendingFirmName(pendingFirmResult.data ? pendingFirmResult.data.firm_name : '')
    }

    setLoading(false)
  }

  useEffect(function () {
    loadLawyerData()
  }, [])

  async function handleAcceptInvite() {
    if (!lawyer || !lawyer.pending_firm_id) return
    setInviteLoading(true)

    await supabase.from('lawyers').update({ firm_id: lawyer.pending_firm_id, pending_firm_id: null }).eq('id', lawyer.id)

    setInviteLoading(false)
    await loadLawyerData()
  }

  async function handleDeclineInvite() {
    if (!lawyer) return
    setInviteLoading(true)

    await supabase.from('lawyers').update({ pending_firm_id: null }).eq('id', lawyer.id)

    setInviteLoading(false)
    await loadLawyerData()
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setMenuOpen(false)
    router.push('/')
  }

  function toggleMenu() {
    setMenuOpen(!menuOpen)
  }

  function formatWorkingDays(daysString: string | null) {
    if (!daysString) return '-'
    const nums = daysString.split(',').map(function (d) { return Number(d) })
    const labels = nums.map(function (n) { return dayNames[n] })
    return labels.join('، ')
  }

  if (loading) {
    return (
      <div dir="rtl" className="min-h-screen pattern-bg flex items-center justify-center">
        <p className="font-['Tajawal'] text-[#4A473F]">جاري التحميل...</p>
      </div>
    )
  }

  if (notLawyer || !lawyer) {
    return (
      <div dir="rtl" className="min-h-screen pattern-bg flex items-center justify-center px-6">
        <div className="text-center">
          <p className="font-['Tajawal'] text-[#4A473F] mb-4">يرجى تسجيل الدخول لعرض معلوماتك</p>
          <a href="/login" className="inline-block px-6 py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal']">تسجيل الدخول</a>
        </div>
      </div>
    )
  }

  const specialtyName = specialty ? specialty.name_ar : '-'
  const workingDaysDisplay = formatWorkingDays(lawyer.working_days)

  return (
    <div dir="rtl" className="min-h-screen pattern-bg">
      <div className="bg-[#1B1A17] text-[#F3EEE4] py-12 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-8 font-['Tajawal'] text-sm">
            <a href="/"><img src="/logo.png" alt="حمورابي" className="h-12 w-auto" /></a>
            <div className="flex gap-5 items-center">
              <a href="/my-appointments" className="hover:text-[#AD8A4E] transition">مواعيدي</a>
              <a href="/my-consultations" className="hover:text-[#AD8A4E] transition">استشاراتي</a>
              <a href="/ai-assistant" className="hover:text-[#AD8A4E] transition">مساعد ذكي</a>
              <a href="/lawyer-tools" className="hover:text-[#AD8A4E] transition">أدواتي</a>
              <a href="/community" className="hover:text-[#AD8A4E] transition">المجتمع</a>
              <a href="/lawyer-messages" className="hover:text-[#AD8A4E] transition">الرسائل</a>
              <div className="relative">
                <button onClick={toggleMenu} className="w-8 h-8 rounded-full bg-[#AD8A4E] flex items-center justify-center hover:bg-[#c49b58] transition">
                  <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.5c-3.3 0-9.8 1.6-9.8 4.9v2.4h19.6v-2.4c0-3.3-6.5-4.9-9.8-4.9z" /></svg>
                </button>
                {menuOpen && (
                  <div className="absolute left-0 top-full mt-2 w-52 bg-white border border-[#D8D2C4] rounded-md shadow-lg overflow-hidden z-20">
                    <a href="/lawyer-info" className="block px-4 py-3 font-['Tajawal'] text-sm text-[#1B1A17] hover:bg-[#F3EEE4] transition">معلوماتي الشخصية</a>
                    <button onClick={handleLogout} className="w-full text-right px-4 py-3 font-['Tajawal'] text-sm text-[#7A2E2E] hover:bg-[#F3EEE4] transition border-t border-[#D8D2C4]">تسجيل الخروج</button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <h1 className="font-['Tajawal'] font-bold text-4xl mb-2">معلوماتي الشخصية</h1>
          <div className="w-16 h-[2px] bg-[#AD8A4E]"></div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10">
        {lawyer.pending_firm_id && (
          <div className="bg-white border-2 border-[#AD8A4E] rounded-lg p-6 mb-6">
            <h2 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mb-2">دعوة انضمام</h2>
            <p className="font-['Tajawal'] text-sm text-[#4A473F] mb-4">
              دعاك مكتب <strong>{pendingFirmName}</strong> للانضمام إليه على منصة حمورابي. عند القبول، سيظهر اسم المكتب مع اسمك، وستستمر بإدارة مواعيدك وأدواتك كالمعتاد.
            </p>
            <div className="flex gap-2">
              <button onClick={handleAcceptInvite} disabled={inviteLoading} className="flex-1 py-2 bg-[#2F4538] text-white rounded-md font-['Tajawal'] text-sm">قبول</button>
              <button onClick={handleDeclineInvite} disabled={inviteLoading} className="flex-1 py-2 bg-[#D8D2C4] text-[#4A473F] rounded-md font-['Tajawal'] text-sm">رفض</button>
            </div>
          </div>
        )}

        {lawyer.firm_id && (
          <div className="bg-[#F3EEE4] border border-[#D8D2C4] rounded-lg p-4 mb-6 text-center">
            <p className="font-['Tajawal'] text-sm text-[#1B1A17]">أنت جزء من مكتب <strong>{firmName}</strong></p>
          </div>
        )}

        <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-6">
          <div className="grid grid-cols-2 gap-4 font-['Tajawal'] text-sm">
            <div>
              <p className="text-[#4A473F] mb-1">الاسم الكامل</p>
              <p className="text-[#1B1A17] font-medium">{lawyer.full_name}</p>
            </div>
            <div>
              <p className="text-[#4A473F] mb-1">التخصص</p>
              <p className="text-[#1B1A17] font-medium">{specialtyName}</p>
            </div>
            <div>
              <p className="text-[#4A473F] mb-1">البريد الإلكتروني</p>
              <p className="text-[#1B1A17] font-medium">{lawyer.email || '-'}</p>
            </div>
            <div>
              <p className="text-[#4A473F] mb-1">رقم الهاتف</p>
              <p className="text-[#1B1A17] font-medium">{lawyer.phone || '-'}</p>
            </div>
            <div>
              <p className="text-[#4A473F] mb-1">المدينة</p>
              <p className="text-[#1B1A17] font-medium">{lawyer.city || '-'}</p>
            </div>
            <div>
              <p className="text-[#4A473F] mb-1">العنوان</p>
              <p className="text-[#1B1A17] font-medium">{lawyer.address || '-'}</p>
            </div>
            <div>
              <p className="text-[#4A473F] mb-1">رسوم الاستشارة السريعة</p>
              <p className="text-[#1B1A17] font-medium">{lawyer.consultation_fee ? lawyer.consultation_fee + ' د.أ' : 'غير محدد'}</p>
            </div>
            <div>
              <p className="text-[#4A473F] mb-1">نطاق الأجرة بالساعة</p>
              <p className="text-[#1B1A17] font-medium">{lawyer.hourly_rate_range || '-'}</p>
            </div>
            <div>
              <p className="text-[#4A473F] mb-1">سنوات الخبرة</p>
              <p className="text-[#1B1A17] font-medium">{lawyer.years_experience || 0}</p>
            </div>
            <div>
              <p className="text-[#4A473F] mb-1">رقم النقابة</p>
              <p className="text-[#1B1A17] font-medium">{lawyer.bar_certificate_number || '-'}</p>
            </div>
            <div>
              <p className="text-[#4A473F] mb-1">في إجازة حتى</p>
              <p className="text-[#1B1A17] font-medium">{lawyer.vacation_until || 'غير محدد'}</p>
            </div>
            <div className="col-span-2">
              <p className="text-[#4A473F] mb-1">أيام العمل</p>
              <p className="text-[#1B1A17] font-medium">{workingDaysDisplay}</p>
            </div>
            <div>
              <p className="text-[#4A473F] mb-1">من الساعة</p>
              <p className="text-[#1B1A17] font-medium">{lawyer.working_hours_start || '-'}</p>
            </div>
            <div>
              <p className="text-[#4A473F] mb-1">إلى الساعة</p>
              <p className="text-[#1B1A17] font-medium">{lawyer.working_hours_end || '-'}</p>
            </div>
            <div className="col-span-2">
              <p className="text-[#4A473F] mb-1">نبذة</p>
              <p className="text-[#1B1A17] font-medium">{lawyer.bio || '-'}</p>
            </div>
          </div>
        </div>

        <a href="/lawyer-dashboard" className="block w-full text-center py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal'] font-medium hover:bg-[#AD8A4E] transition mb-4">
          تعديل المعلومات
        </a>

        <div className="text-center">
          <a href="/change-password" className="font-['Tajawal'] text-sm text-[#AD8A4E] hover:underline">تغيير كلمة المرور</a>
        </div>
      </div>
    </div>
  )
}