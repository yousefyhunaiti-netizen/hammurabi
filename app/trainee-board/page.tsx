'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase'

type Posting = {
  id: number
  posting_type: string
  full_name: string
  email: string
  phone: string
  city: string
  specialty_id: number | null
  description: string
  created_at: string
}

type Specialty = {
  id: number
  name_ar: string
}

const cityOptions = ['عمان', 'إربد', 'الزرقاء', 'البلقاء', 'المفرق', 'الكرك', 'جرش', 'عجلون', 'مادبا', 'العقبة', 'معان', 'الطفيلة']

export default function TraineeBoardPage() {
  const [loading, setLoading] = useState(true)
  const [postings, setPostings] = useState<Posting[]>([])
  const [specialties, setSpecialties] = useState<Specialty[]>([])
  const [tab, setTab] = useState('lawyer_seeking_trainee')
  const [selectedSpecialty, setSelectedSpecialty] = useState<number | null>(null)
  const [selectedCity, setSelectedCity] = useState('')

  const [accountType, setAccountType] = useState('')
  const [lawyerId, setLawyerId] = useState<number | null>(null)
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [profileName, setProfileName] = useState('')
  const [profileEmail, setProfileEmail] = useState('')
  const [profilePhone, setProfilePhone] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [postCity, setPostCity] = useState('')
  const [postSpecialty, setPostSpecialty] = useState('')
  const [postDescription, setPostDescription] = useState('')
  const [posting, setPosting] = useState(false)
  const [postMessage, setPostMessage] = useState('')

  const supabase = createClient()

  async function loadPostings() {
    const result = await supabase.from('trainee_postings').select('*').order('created_at', { ascending: false })
    setPostings(result.data || [])
  }

  useEffect(function () {
    async function loadData() {
      const userResult = await supabase.auth.getUser()

      if (userResult.data.user) {
        const user = userResult.data.user

        const lawyerResult = await supabase.from('lawyers').select('id, full_name, email, phone').eq('user_id', user.id).maybeSingle()
        if (lawyerResult.data) {
          setAccountType('lawyer')
          setLawyerId(lawyerResult.data.id)
          setProfileName(lawyerResult.data.full_name)
          setProfileEmail(lawyerResult.data.email || '')
          setProfilePhone(lawyerResult.data.phone || '')
        } else {
          const customerResult = await supabase.from('customers').select('id, full_name, email, phone').eq('user_id', user.id).maybeSingle()
          if (customerResult.data) {
            setAccountType('customer')
            setCustomerId(user.id)
            setProfileName(customerResult.data.full_name)
            setProfileEmail(customerResult.data.email || '')
            setProfilePhone(customerResult.data.phone || '')
          }
        }
      }

      const specialtiesResult = await supabase.from('specialties').select('*')
      setSpecialties(specialtiesResult.data || [])

      await loadPostings()
      setLoading(false)
    }

    loadData()
  }, [])

  async function handlePost() {
    if (!postDescription.trim() || !postCity) {
      setPostMessage('يرجى تعبئة المدينة والوصف على الأقل')
      return
    }

    setPosting(true)
    setPostMessage('')

    const postingType = accountType === 'lawyer' ? 'lawyer_seeking_trainee' : 'trainee_seeking_lawyer'

    await supabase.from('trainee_postings').insert({
      posting_type: postingType,
      lawyer_id: accountType === 'lawyer' ? lawyerId : null,
      customer_id: accountType === 'customer' ? customerId : null,
      full_name: profileName,
      email: profileEmail,
      phone: profilePhone,
      city: postCity,
      specialty_id: postSpecialty ? Number(postSpecialty) : null,
      description: postDescription,
    })

    if (accountType === 'customer' && customerId) {
      await supabase.from('customers').update({ is_trainee: true }).eq('user_id', customerId)
    }

    setPostCity('')
    setPostSpecialty('')
    setPostDescription('')
    setShowForm(false)
    await loadPostings()
    setPosting(false)
  }

  function getSpecialtyName(id: number | null) {
    if (!id) return ''
    const found = specialties.find(function (s) { return s.id === id })
    return found ? found.name_ar : ''
  }

  const filteredPostings = postings.filter(function (p) {
    if (p.posting_type !== tab) return false
    const specialtyMatch = selectedSpecialty ? p.specialty_id === selectedSpecialty : true
    const cityMatch = selectedCity ? p.city === selectedCity : true
    return specialtyMatch && cityMatch
  })

  function renderPosting(p: Posting) {
    return (
      <div key={p.id} className="bg-white border border-[#D8D2C4] rounded-lg p-5 mb-3">
        <div className="flex justify-between items-start mb-2">
          <p className="font-['Tajawal'] font-bold text-[#1B1A17]">{p.full_name}</p>
          {p.specialty_id && (
            <span className="px-3 py-1 bg-[#F3EEE4] text-[#AD8A4E] text-xs font-['Tajawal'] rounded-full">{getSpecialtyName(p.specialty_id)}</span>
          )}
        </div>
        <p className="font-['Tajawal'] text-sm text-[#4A473F] mb-3">{p.description}</p>
        <div className="flex flex-wrap gap-2 text-xs font-['Tajawal'] text-[#4A473F]">
          <span>📍 {p.city}</span>
          <span>📞 {p.phone}</span>
          <span>✉️ {p.email}</span>
        </div>
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

  return (
    <div dir="rtl" className="min-h-screen pattern-bg">
      <div className="bg-[#1B1A17] text-[#F3EEE4] py-12 px-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-['Amiri'] text-4xl mb-2">لوحة التدريب المهني</h1>
          <div className="w-16 h-[2px] bg-[#AD8A4E] mb-3"></div>
          <p className="font-['Tajawal'] text-sm text-[#D8D2C4]">اربط بين المحامين المتدربين ومكاتب/محامين التدريب</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex bg-white border border-[#D8D2C4] rounded-md p-1 mb-6 w-fit">
          <button
            onClick={function () { setTab('lawyer_seeking_trainee') }}
            className={"px-5 py-2 rounded font-['Tajawal'] text-sm font-medium transition " + (tab === 'lawyer_seeking_trainee' ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'text-[#4A473F]')}
          >
            محامون يبحثون عن متدربين
          </button>
          <button
            onClick={function () { setTab('trainee_seeking_lawyer') }}
            className={"px-5 py-2 rounded font-['Tajawal'] text-sm font-medium transition " + (tab === 'trainee_seeking_lawyer' ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'text-[#4A473F]')}
          >
            متدربون يبحثون عن محامين
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <select
            value={selectedSpecialty ?? ''}
            onChange={function (e) { setSelectedSpecialty(e.target.value ? Number(e.target.value) : null) }}
            className="px-4 py-2 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
          >
            <option value="">كل التخصصات</option>
            {specialties.map(function (s) {
              return <option key={s.id} value={s.id}>{s.name_ar}</option>
            })}
          </select>

          <select
            value={selectedCity}
            onChange={function (e) { setSelectedCity(e.target.value) }}
            className="px-4 py-2 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
          >
            <option value="">كل المدن</option>
            {cityOptions.map(function (city) {
              return <option key={city} value={city}>{city}</option>
            })}
          </select>
        </div>

        {(accountType === 'lawyer' || accountType === 'customer') && (
          <div className="mb-6">
            <button
              onClick={function () { setShowForm(!showForm) }}
              className="px-5 py-2 bg-[#AD8A4E] text-white rounded-md font-['Tajawal'] text-sm hover:bg-[#c49b58] transition"
            >
              {showForm ? 'إلغاء' : accountType === 'lawyer' ? 'أبحث عن متدرب' : 'أبحث عن محامٍ للتدرب لديه'}
            </button>

            {showForm && (
              <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mt-4">
                <select
                  value={postCity}
                  onChange={function (e) { setPostCity(e.target.value) }}
                  className="w-full px-3 py-2 mb-3 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
                >
                  <option value="">اختر المدينة</option>
                  {cityOptions.map(function (city) {
                    return <option key={city} value={city}>{city}</option>
                  })}
                </select>
                <select
                  value={postSpecialty}
                  onChange={function (e) { setPostSpecialty(e.target.value) }}
                  className="w-full px-3 py-2 mb-3 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
                >
                  <option value="">اختر التخصص (اختياري)</option>
                  {specialties.map(function (s) {
                    return <option key={s.id} value={s.id}>{s.name_ar}</option>
                  })}
                </select>
                <textarea
                  value={postDescription}
                  onChange={function (e) { setPostDescription(e.target.value) }}
                  rows={4}
                  placeholder="اكتب تفاصيل إضافية..."
                  className="w-full px-3 py-2 mb-3 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
                />
                <button
                  onClick={handlePost}
                  disabled={posting}
                  className="w-full py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal'] font-medium hover:bg-[#AD8A4E] transition disabled:opacity-60"
                >
                  {posting ? 'جاري النشر...' : 'نشر الإعلان'}
                </button>
                {postMessage && (
                  <p className="mt-2 font-['Tajawal'] text-sm text-[#7A2E2E]">{postMessage}</p>
                )}
              </div>
            )}
          </div>
        )}

        {filteredPostings.length === 0 && (
          <p className="font-['Tajawal'] text-center text-[#4A473F]">لا توجد إعلانات حالياً</p>
        )}

        {filteredPostings.map(renderPosting)}
      </div>
    </div>
  )
}