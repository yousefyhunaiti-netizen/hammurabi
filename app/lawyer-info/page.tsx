'use client'

import { useEffect, useState } from 'react'
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
  years_experience: number | null
  bar_certificate_number: string | null
  working_days: string | null
  working_hours_start: string | null
  working_hours_end: string | null
  vacation_until: string | null
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

  const supabase = createClient()

  useEffect(function () {
    async function loadData() {
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

      setLoading(false)
    }

    loadData()
  }, [])

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
          <h1 className="font-['Amiri'] text-4xl mb-2">معلوماتي الشخصية</h1>
          <div className="w-16 h-[2px] bg-[#AD8A4E]"></div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10">
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
              <p className="text-[#4A473F] mb-1">رسوم الاستشارة</p>
              <p className="text-[#1B1A17] font-medium">{lawyer.consultation_fee || 0} د.أ</p>
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