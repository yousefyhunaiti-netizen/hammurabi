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
  years_experience: number | null
  bar_certificate_number: string | null
  working_days: string | null
  working_hours_start: string | null
  working_hours_end: string | null
  vacation_until: string | null
  google_maps_link: string | null
  website_url: string | null
  firm_id: number | null
}

type Specialty = {
  id: number
  name_ar: string
}

const dayOptions = [
  { value: 0, label: 'الأحد' },
  { value: 1, label: 'الاثنين' },
  { value: 2, label: 'الثلاثاء' },
  { value: 3, label: 'الأربعاء' },
  { value: 4, label: 'الخميس' },
  { value: 5, label: 'الجمعة' },
  { value: 6, label: 'السبت' },
]

export default function LawyerDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [lawyer, setLawyer] = useState<Lawyer | null>(null)
  const [notLawyer, setNotLawyer] = useState(false)
  const [belongsToFirm, setBelongsToFirm] = useState(false)
  const [specialties, setSpecialties] = useState<Specialty[]>([])

  const [fullName, setFullName] = useState('')
  const [bio, setBio] = useState('')
  const [specialtyId, setSpecialtyId] = useState('')
  const [city, setCity] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [fee, setFee] = useState('')
  const [experience, setExperience] = useState('')
  const [barNumber, setBarNumber] = useState('')
  const [selectedDays, setSelectedDays] = useState<number[]>([])
  const [hoursStart, setHoursStart] = useState('')
  const [hoursEnd, setHoursEnd] = useState('')
  const [vacationUntil, setVacationUntil] = useState('')
  const [mapsLink, setMapsLink] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')

  const [saveMessage, setSaveMessage] = useState('')
  const [saving, setSaving] = useState(false)

  const supabase = createClient()
  const router = useRouter()

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

      if (lawyerResult.data.firm_id) {
        setBelongsToFirm(true)
        setLoading(false)
        return
      }

      const l: Lawyer = lawyerResult.data
      setLawyer(l)

      setFullName(l.full_name || '')
      setBio(l.bio || '')
      setSpecialtyId(l.specialty_id ? String(l.specialty_id) : '')
      setCity(l.city || '')
      setAddress(l.address || '')
      setPhone(l.phone || '')
      setFee(l.consultation_fee ? String(l.consultation_fee) : '')
      setExperience(l.years_experience ? String(l.years_experience) : '')
      setBarNumber(l.bar_certificate_number || '')
      setHoursStart(l.working_hours_start || '09:00')
      setHoursEnd(l.working_hours_end || '17:00')
      setVacationUntil(l.vacation_until || '')
      setMapsLink(l.google_maps_link || '')
      setWebsiteUrl(l.website_url || '')

      if (l.working_days) {
        const dayNumbers = l.working_days.split(',').map(function (d) { return Number(d) })
        setSelectedDays(dayNumbers)
      }

      const specialtiesResult = await supabase.from('specialties').select('*')
      setSpecialties(specialtiesResult.data || [])

      setLoading(false)
    }

    loadData()
  }, [])

  function toggleDay(dayValue: number) {
    if (selectedDays.indexOf(dayValue) !== -1) {
      setSelectedDays(selectedDays.filter(function (d) { return d !== dayValue }))
    } else {
      setSelectedDays(selectedDays.concat([dayValue]))
    }
  }

  async function handleSave() {
    if (!lawyer) return
    setSaveMessage('')
    setSaving(true)

    const sortedDays = selectedDays.slice().sort()
    const workingDaysString = sortedDays.join(',')

    const updateResult = await supabase
      .from('lawyers')
      .update({
        full_name: fullName,
        bio: bio,
        specialty_id: specialtyId ? Number(specialtyId) : null,
        city: city,
        address: address,
        phone: phone,
        consultation_fee: fee ? Number(fee) : 0,
        years_experience: experience ? Number(experience) : 0,
        bar_certificate_number: barNumber,
        working_days: workingDaysString,
        working_hours_start: hoursStart,
        working_hours_end: hoursEnd,
        vacation_until: vacationUntil ? vacationUntil : null,
        google_maps_link: mapsLink,
        website_url: websiteUrl,
      })
      .eq('id', lawyer.id)

    setSaving(false)

    if (updateResult.error) {
      setSaveMessage('حدث خطأ أثناء الحفظ، حاول مرة أخرى')
      return
    }

    setSaveMessage('تم حفظ التغييرات بنجاح')

    setTimeout(function () {
      router.push('/')
    }, 1200)
  }

  if (loading) {
    return (
      <div dir="rtl" className="min-h-screen pattern-bg flex items-center justify-center">
        <p className="font-['Tajawal'] text-[#4A473F]">جاري التحميل...</p>
      </div>
    )
  }

  if (notLawyer) {
    return (
      <div dir="rtl" className="min-h-screen pattern-bg flex items-center justify-center px-6">
        <div className="text-center">
          <p className="font-['Tajawal'] text-[#4A473F] mb-4">هذه الصفحة مخصصة لحسابات المحامين فقط</p>
          <a href="/login" className="inline-block px-6 py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal']">تسجيل الدخول</a>
        </div>
      </div>
    )
  }

  if (belongsToFirm) {
    return (
      <div dir="rtl" className="min-h-screen pattern-bg flex items-center justify-center px-6">
        <div className="text-center">
          <p className="font-['Tajawal'] text-[#4A473F]">ملفك الشخصي يُدار من قبل المكتب الذي تعمل به</p>
        </div>
      </div>
    )
  }

  return (
    <div dir="rtl" className="min-h-screen pattern-bg">
      <div className="bg-[#1B1A17] text-[#F3EEE4] py-12 px-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-['Amiri'] text-4xl mb-2">لوحة التحكم</h1>
          <div className="w-16 h-[2px] bg-[#AD8A4E]"></div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-6">
          <h2 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mb-4">المعلومات الأساسية</h2>

          <div className="space-y-3">
            <div>
              <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-1">الاسم الكامل</label>
              <input
                type="text"
                value={fullName}
                onChange={function (e) { setFullName(e.target.value) }}
                className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
              />
            </div>

            <div>
              <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-1">نبذة</label>
              <textarea
                value={bio}
                onChange={function (e) { setBio(e.target.value) }}
                rows={3}
                className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
              />
            </div>

            <div>
              <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-1">التخصص</label>
              <select
                value={specialtyId}
                onChange={function (e) { setSpecialtyId(e.target.value) }}
                className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
              >
                <option value="">اختر التخصص</option>
                {specialties.map(function (s) {
                  return <option key={s.id} value={s.id}>{s.name_ar}</option>
                })}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-1">المدينة</label>
                <input
                  type="text"
                  value={city}
                  onChange={function (e) { setCity(e.target.value) }}
                  className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
                />
              </div>
              <div>
                <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-1">العنوان</label>
                <input
                  type="text"
                  value={address}
                  onChange={function (e) { setAddress(e.target.value) }}
                  className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
                />
              </div>
            </div>

            <div>
              <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-1">رقم الهاتف</label>
              <input
                type="tel"
                value={phone}
                onChange={function (e) { setPhone(e.target.value) }}
                className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-1">رسوم الاستشارة (د.أ)</label>
                <input
                  type="number"
                  value={fee}
                  onChange={function (e) { setFee(e.target.value) }}
                  className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
                />
              </div>
              <div>
                <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-1">سنوات الخبرة</label>
                <input
                  type="number"
                  value={experience}
                  onChange={function (e) { setExperience(e.target.value) }}
                  className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
                />
              </div>
            </div>

            <div>
              <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-1">رقم النقابة</label>
              <input
                type="text"
                value={barNumber}
                onChange={function (e) { setBarNumber(e.target.value) }}
                className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
              />
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-6">
          <h2 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mb-4">أوقات الدوام</h2>

          <p className="font-['Tajawal'] text-xs text-[#4A473F] mb-2">أيام العمل</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {dayOptions.map(function (day) {
              const isSelected = selectedDays.indexOf(day.value) !== -1
              return (
                <button
                  key={day.value}
                  type="button"
                  onClick={function () { toggleDay(day.value) }}
                  className={
                    "px-3 py-2 rounded-md font-['Tajawal'] text-xs transition " +
                    (isSelected ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'bg-[#F3EEE4] text-[#4A473F] border border-[#D8D2C4]')
                  }
                >
                  {day.label}
                </button>
              )
            })}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-1">من الساعة</label>
              <input
                type="time"
                value={hoursStart}
                onChange={function (e) { setHoursStart(e.target.value) }}
                className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
              />
            </div>
            <div>
              <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-1">إلى الساعة</label>
              <input
                type="time"
                value={hoursEnd}
                onChange={function (e) { setHoursEnd(e.target.value) }}
                className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
              />
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-6">
          <h2 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mb-4">الإجازة</h2>
          <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-1">في إجازة حتى (اتركها فارغة إذا لم تكن في إجازة)</label>
          <input
            type="date"
            value={vacationUntil}
            onChange={function (e) { setVacationUntil(e.target.value) }}
            className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
          />
        </div>

        <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-6">
          <h2 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mb-4">روابط إضافية</h2>
          <div className="space-y-3">
            <div>
              <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-1">رابط الخريطة</label>
              <input
                type="text"
                value={mapsLink}
                onChange={function (e) { setMapsLink(e.target.value) }}
                className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
                placeholder="https://maps.google.com/..."
              />
            </div>
            <div>
              <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-1">الموقع الإلكتروني</label>
              <input
                type="text"
                value={websiteUrl}
                onChange={function (e) { setWebsiteUrl(e.target.value) }}
                className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
                placeholder="https://..."
              />
            </div>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal'] font-medium hover:bg-[#AD8A4E] transition disabled:opacity-60"
        >
          {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
        </button>

        {saveMessage && (
          <p className="mt-4 text-center font-['Tajawal'] text-sm text-[#2F4538]">{saveMessage}</p>
        )}
      </div>
    </div>
  )
}