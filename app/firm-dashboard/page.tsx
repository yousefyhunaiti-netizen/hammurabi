'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase'

type Firm = {
  id: number
  firm_name: string
  bio: string | null
  city: string | null
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
}

export default function FirmDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [firm, setFirm] = useState<Firm | null>(null)
  const [notFirm, setNotFirm] = useState(false)
  const [specialties, setSpecialties] = useState<Specialty[]>([])
  const [roster, setRoster] = useState<FirmLawyer[]>([])
  const [showNames, setShowNames] = useState(true)
  const [savingToggle, setSavingToggle] = useState(false)

  const [newName, setNewName] = useState('')
  const [newSpecialty, setNewSpecialty] = useState('')
  const [newCity, setNewCity] = useState('')
  const [newBio, setNewBio] = useState('')
  const [newFee, setNewFee] = useState('')
  const [newExperience, setNewExperience] = useState('')
  const [newBarNumber, setNewBarNumber] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [addMessage, setAddMessage] = useState('')
  const [addLoading, setAddLoading] = useState(false)

  const supabase = createClient()

  async function loadRoster(firmId: number) {
    const rosterResult = await supabase
      .from('lawyers')
      .select('id, full_name, specialty_id, city')
      .eq('firm_id', firmId)

    setRoster(rosterResult.data || [])
  }

  useEffect(function () {
    async function loadData() {
      const userResult = await supabase.auth.getUser()

      if (!userResult.data.user) {
        setNotFirm(true)
        setLoading(false)
        return
      }

      const firmResult = await supabase
        .from('firms')
        .select('*')
        .eq('user_id', userResult.data.user.id)
        .single()

      if (!firmResult.data) {
        setNotFirm(true)
        setLoading(false)
        return
      }

      setFirm(firmResult.data)
      setShowNames(firmResult.data.show_lawyer_names === true)

      const specialtiesResult = await supabase.from('specialties').select('*')
      setSpecialties(specialtiesResult.data || [])

      await loadRoster(firmResult.data.id)

      setLoading(false)
    }

    loadData()
  }, [])

  async function handleToggleChange() {
    if (!firm) return
    const newValue = !showNames
    setSavingToggle(true)

    await supabase.from('firms').update({ show_lawyer_names: newValue }).eq('id', firm.id)

    setShowNames(newValue)
    setSavingToggle(false)
  }

  async function handleAddLawyer() {
    setAddMessage('')

    if (!newName.trim() || !newSpecialty || !newCity.trim()) {
      setAddMessage('يرجى تعبئة الاسم والتخصص والمدينة على الأقل')
      return
    }

    if (!firm) return

    setAddLoading(true)

    const insertResult = await supabase.from('lawyers').insert({
      full_name: newName,
      specialty_id: Number(newSpecialty),
      city: newCity,
      bio: newBio,
      consultation_fee: newFee ? Number(newFee) : 0,
      years_experience: newExperience ? Number(newExperience) : 0,
      bar_certificate_number: newBarNumber,
      phone: newPhone,
      email: '',
      firm_id: firm.id,
      is_approved: true,
      is_active: true,
      working_days: '0,1,2,3,4',
      working_hours_start: '09:00',
      working_hours_end: '17:00',
    })

    setAddLoading(false)

    if (insertResult.error) {
      setAddMessage('حدث خطأ، حاول مرة أخرى')
      return
    }

    setNewName('')
    setNewSpecialty('')
    setNewCity('')
    setNewBio('')
    setNewFee('')
    setNewExperience('')
    setNewBarNumber('')
    setNewPhone('')
    setAddMessage('تمت إضافة المحامي بنجاح')

    await loadRoster(firm.id)
  }

  async function handleRemoveLawyer(lawyerId: number) {
    await supabase.from('lawyers').delete().eq('id', lawyerId)
    if (firm) {
      await loadRoster(firm.id)
    }
  }

  function getSpecialtyName(specialtyId: number) {
    const found = specialties.find(function (s) { return s.id === specialtyId })
    return found ? found.name_ar : ''
  }

  function renderRosterRow(lawyer: FirmLawyer) {
    function removeClick() {
      handleRemoveLawyer(lawyer.id)
    }

    return (
      <div key={lawyer.id} className="flex justify-between items-center bg-[#F3EEE4] rounded-md p-4 mb-2">
        <div>
          <p className="font-['Tajawal'] font-medium text-[#1B1A17]">{lawyer.full_name}</p>
          <p className="font-['Tajawal'] text-xs text-[#4A473F]">{getSpecialtyName(lawyer.specialty_id)} - {lawyer.city}</p>
        </div>
        <button onClick={removeClick} className="text-sm font-['Tajawal'] text-[#7A2E2E] hover:underline">
          إزالة
        </button>
      </div>
    )
  }

  if (loading) {
    return (
      <div dir="rtl" className="min-h-screen pattern-bg flex items-center justify-center">
        <p className="font-['Tajawal'] text-[#4A473F]">جاري التحميل...</p>
      </div>
    )
  }

  if (notFirm) {
    return (
      <div dir="rtl" className="min-h-screen pattern-bg flex items-center justify-center px-6">
        <div className="text-center">
          <p className="font-['Tajawal'] text-[#4A473F] mb-4">هذه الصفحة مخصصة لحسابات مكاتب المحاماة فقط</p>
          <a href="/login" className="inline-block px-6 py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal']">تسجيل الدخول</a>
        </div>
      </div>
    )
  }

  return (
    <div dir="rtl" className="min-h-screen pattern-bg">
      <div className="bg-[#1B1A17] text-[#F3EEE4] py-12 px-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-['Amiri'] text-4xl mb-2">{firm ? firm.firm_name : ''}</h1>
          <div className="w-16 h-[2px] bg-[#AD8A4E]"></div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-['Tajawal'] font-bold text-[#1B1A17] mb-1">عرض أسماء المحامين للعملاء</p>
              <p className="font-['Tajawal'] text-xs text-[#4A473F]">
                {showNames ? 'العملاء يرون أسماء المحامين ويمكنهم اختيار محامٍ محدد' : 'العملاء يرون رسالة أن المكتب سيختار المحامي المناسب'}
              </p>
            </div>
            <button
              onClick={handleToggleChange}
              disabled={savingToggle}
              className={
                "px-4 py-2 rounded-md font-['Tajawal'] text-sm transition " +
                (showNames ? 'bg-[#2F4538] text-white' : 'bg-[#D8D2C4] text-[#4A473F]')
              }
            >
              {showNames ? 'مفعّل' : 'غير مفعّل'}
            </button>
          </div>
        </div>

        <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-6">
          <h2 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mb-4">محامو المكتب</h2>

          {roster.length === 0 && (
            <p className="font-['Tajawal'] text-sm text-[#4A473F] mb-2">لم تتم إضافة أي محامٍ بعد</p>
          )}

          {roster.map(renderRosterRow)}
        </div>

        <div className="bg-white border border-[#D8D2C4] rounded-lg p-6">
          <h2 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mb-4">إضافة محامٍ جديد</h2>

          <div className="space-y-3">
            <input
              type="text"
              placeholder="الاسم الكامل"
              value={newName}
              onChange={function (e) { setNewName(e.target.value) }}
              className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
            />

            <select
              value={newSpecialty}
              onChange={function (e) { setNewSpecialty(e.target.value) }}
              className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
            >
              <option value="">اختر التخصص</option>
              {specialties.map(function (s) {
                return <option key={s.id} value={s.id}>{s.name_ar}</option>
              })}
            </select>

            <input
              type="text"
              placeholder="المدينة"
              value={newCity}
              onChange={function (e) { setNewCity(e.target.value) }}
              className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
            />

            <textarea
              placeholder="نبذة"
              value={newBio}
              onChange={function (e) { setNewBio(e.target.value) }}
              rows={3}
              className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
            />

            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                placeholder="رسوم الاستشارة"
                value={newFee}
                onChange={function (e) { setNewFee(e.target.value) }}
                className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
              />
              <input
                type="number"
                placeholder="سنوات الخبرة"
                value={newExperience}
                onChange={function (e) { setNewExperience(e.target.value) }}
                className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
              />
            </div>

            <input
              type="text"
              placeholder="رقم النقابة"
              value={newBarNumber}
              onChange={function (e) { setNewBarNumber(e.target.value) }}
              className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
            />

            <input
              type="tel"
              placeholder="رقم الهاتف"
              value={newPhone}
              onChange={function (e) { setNewPhone(e.target.value) }}
              className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
            />

            <button
              onClick={handleAddLawyer}
              disabled={addLoading}
              className="w-full py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal'] font-medium hover:bg-[#AD8A4E] transition disabled:opacity-60"
            >
              {addLoading ? 'جاري الإضافة...' : 'إضافة محامٍ'}
            </button>

            {addMessage && (
              <p className="font-['Tajawal'] text-sm text-[#2F4538]">{addMessage}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}