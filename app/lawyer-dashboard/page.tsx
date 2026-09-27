'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'

type Lawyer = {
  id: number
  full_name: string
  bio: string | null
  specialty_id: number | null
  specialty_ids: string | null
  city: string | null
  cities: string | null
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
  google_maps_link: string | null
  website_url: string | null
  firm_id: number | null
  is_active: boolean | null
  is_comped: boolean | null
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

const cityOptions = ['عمان', 'إربد', 'الزرقاء', 'البلقاء', 'المفرق', 'الكرك', 'جرش', 'عجلون', 'مادبا', 'العقبة', 'معان', 'الطفيلة']

export default function LawyerDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [lawyer, setLawyer] = useState<Lawyer | null>(null)
  const [notLawyer, setNotLawyer] = useState(false)
  const [notSubscribed, setNotSubscribed] = useState(false)
  const [specialties, setSpecialties] = useState<Specialty[]>([])
  const [menuOpen, setMenuOpen] = useState(false)

  const [fullName, setFullName] = useState('')
  const [bio, setBio] = useState('')
  const [selectedSpecialties, setSelectedSpecialties] = useState<number[]>([])
  const [selectedCities, setSelectedCities] = useState<string[]>([])
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [fee, setFee] = useState('')
  const [hourlyRange, setHourlyRange] = useState('')
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

      if (!lawyerResult.data.is_active && !lawyerResult.data.is_comped) {
        setNotSubscribed(true)
        setLoading(false)
        return
      }

      const l: Lawyer = lawyerResult.data
      setLawyer(l)

      setFullName(l.full_name || '')
      setBio(l.bio || '')
      setAddress(l.address || '')
      setPhone(l.phone || '')
      setFee(l.consultation_fee ? String(l.consultation_fee) : '')
      setHourlyRange(l.hourly_rate_range || '')
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

      if (l.specialty_ids) {
        const specIds = l.specialty_ids.split(',').filter(Boolean).map(function (s) { return Number(s) })
        setSelectedSpecialties(specIds)
      } else if (l.specialty_id) {
        setSelectedSpecialties([l.specialty_id])
      }

      if (l.cities) {
        const cityList = l.cities.split(',').filter(Boolean)
        setSelectedCities(cityList)
      } else if (l.city) {
        setSelectedCities([l.city])
      }

      const specialtiesResult = await supabase.from('specialties').select('*')
      setSpecialties(specialtiesResult.data || [])

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

  function toggleDay(dayValue: number) {
    if (selectedDays.indexOf(dayValue) !== -1) {
      setSelectedDays(selectedDays.filter(function (d) { return d !== dayValue }))
    } else {
      setSelectedDays(selectedDays.concat([dayValue]))
    }
  }

  function toggleSpecialty(specId: number) {
    if (selectedSpecialties.indexOf(specId) !== -1) {
      setSelectedSpecialties(selectedSpecialties.filter(function (s) { return s !== specId }))
    } else {
      setSelectedSpecialties(selectedSpecialties.concat([specId]))
    }
  }

  function toggleCity(cityName: string) {
    if (selectedCities.indexOf(cityName) !== -1) {
      setSelectedCities(selectedCities.filter(function (c) { return c !== cityName }))
    } else {
      setSelectedCities(selectedCities.concat([cityName]))
    }
  }

  async function handleSave() {
    if (!lawyer) return
    setSaveMessage('')
    setSaving(true)

    const sortedDays = selectedDays.slice().sort()
    const workingDaysString = sortedDays.join(',')
    const specialtyIdsString = selectedSpecialties.join(',')
    const citiesString = selectedCities.join(',')
    const primarySpecialty = selectedSpecialties.length > 0 ? selectedSpecialties[0] : null
    const primaryCity = selectedCities.length > 0 ? selectedCities[0] : ''

    const updateResult = await supabase
      .from('lawyers')
      .update({
        full_name: fullName,
        bio: bio,
        specialty_id: primarySpecialty,
        specialty_ids: specialtyIdsString,
        city: primaryCity,
        cities: citiesString,
        address: address,
        phone: phone,
        consultation_fee: fee ? Number(fee) : null,
        hourly_rate_range: hourlyRange,
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
      router.push('/lawyer-info')
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

  if (notSubscribed) {
    return (
      <div dir="rtl" className="min-h-screen pattern-bg flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="bg-white border-2 border-[#AD8A4E] rounded-lg p-8">
            <h1 className="font-['Tajawal'] font-bold text-2xl text-[#1B1A17] mb-3">يلزم الاشتراك للوصول إلى هذه الصفحة</h1>
            <a href="/subscription" className="inline-block mt-4 px-6 py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal']">عرض خطط الاشتراك</a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div dir="rtl" className="min-h-screen pattern-bg">
      <div className="bg-[#1B1A17] text-[#F3EEE4] py-12 px-6">
        <div className="max-w-3xl mx-auto">
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
          <h1 className="font-['Tajawal'] font-bold text-4xl mb-2">لوحة التحكم</h1>
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
              <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-2">الاختصاصات (يمكن اختيار أكثر من واحد)</label>
              <div className="flex flex-wrap gap-2">
                {specialties.map(function (s) {
                  const isSelected = selectedSpecialties.indexOf(s.id) !== -1
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={function () { toggleSpecialty(s.id) }}
                      className={
                        "px-3 py-2 rounded-md font-['Tajawal'] text-xs transition " +
                        (isSelected ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'bg-[#F3EEE4] text-[#4A473F] border border-[#D8D2C4]')
                      }
                    >
                      {s.name_ar}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-2">المدن (يمكن اختيار أكثر من واحدة)</label>
              <div className="flex flex-wrap gap-2">
                {cityOptions.map(function (city) {
                  const isSelected = selectedCities.indexOf(city) !== -1
                  return (
                    <button
                      key={city}
                      type="button"
                      onClick={function () { toggleCity(city) }}
                      className={
                        "px-3 py-2 rounded-md font-['Tajawal'] text-xs transition " +
                        (isSelected ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'bg-[#F3EEE4] text-[#4A473F] border border-[#D8D2C4]')
                      }
                    >
                      {city}
                    </button>
                  )
                })}
              </div>
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
                <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-1">رسوم الاستشارة السريعة (د.أ) — اختياري</label>
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
              <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-1">الرقم النقابي</label>
              <input
                type="text"
                value={barNumber}
                onChange={function (e) { setBarNumber(e.target.value) }}
                className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
              />
            </div>
                        <div>
              <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-1">نطاق الأجرة بالساعة (اختياري، للعرض فقط)</label>
              <input
                type="text"
                value={hourlyRange}
                onChange={function (e) { setHourlyRange(e.target.value) }}
                placeholder="مثال: 50-100"
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