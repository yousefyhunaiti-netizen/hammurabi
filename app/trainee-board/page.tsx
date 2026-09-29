'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'

type Posting = {
  id: number
  posting_type: string
  lawyer_id: number | null
  customer_id: string | null
  full_name: string
  email: string | null
  phone: string | null
  city: string | null
  specialty_id: number | null
  description: string | null
  created_at: string
}

type Specialty = {
  id: number
  name_ar: string
}

const cityOptions = ['عمان', 'إربد', 'الزرقاء', 'البلقاء', 'المفرق', 'الكرك', 'جرش', 'عجلون', 'مادبا', 'العقبة', 'معان', 'الطفيلة']

export default function TraineeBoardPage() {
  const [loading, setLoading] = useState(true)
  const [accountType, setAccountType] = useState('')
  const [accountId, setAccountId] = useState<number | null>(null)
  const [accountName, setAccountName] = useState('')
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [loggedIn, setLoggedIn] = useState(false)
  const [infoLink, setInfoLink] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [totalUnread, setTotalUnread] = useState(0)

  const [postings, setPostings] = useState<Posting[]>([])
  const [specialties, setSpecialties] = useState<Specialty[]>([])
  const [typeFilter, setTypeFilter] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [formCity, setFormCity] = useState('')
  const [formSpecialty, setFormSpecialty] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [saving, setSaving] = useState(false)

  const supabase = createClient()
  const router = useRouter()

  async function loadPostings() {
    const result = await supabase.from('trainee_postings').select('*').order('created_at', { ascending: false })
    setPostings(result.data || [])
  }

  useEffect(function () {
    async function loadData() {
      const userResult = await supabase.auth.getUser()

      if (userResult.data.user) {
        setLoggedIn(true)
        const user = userResult.data.user

        const lawyerResult = await supabase.from('lawyers').select('id, full_name').eq('user_id', user.id).maybeSingle()
        if (lawyerResult.data) {
          setAccountType('lawyer')
          setAccountId(lawyerResult.data.id)
          setAccountName(lawyerResult.data.full_name)
          setInfoLink('/lawyer-info')

          const unreadResult = await supabase.from('lawyer_messages').select('id', { count: 'exact', head: true }).eq('recipient_lawyer_id', lawyerResult.data.id).eq('is_read', false)
          setTotalUnread(unreadResult.count || 0)
        } else {
          const customerResult = await supabase.from('customers').select('id, full_name').eq('user_id', user.id).maybeSingle()
          if (customerResult.data) {
            setAccountType('customer')
            setAccountId(customerResult.data.id)
            setAccountName(customerResult.data.full_name)
            setInfoLink('/my-info')
          }
        }
      }

      setCheckingAuth(false)

      const specialtiesResult = await supabase.from('specialties').select('*')
      setSpecialties(specialtiesResult.data || [])

      await loadPostings()
      setLoading(false)
    }

    loadData()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    setLoggedIn(false)
    setMenuOpen(false)
    router.push('/')
  }

  function toggleMenu() {
    setMenuOpen(!menuOpen)
  }

  function resetForm() {
    setFormCity('')
    setFormSpecialty('')
    setFormDescription('')
    setFormEmail('')
    setFormPhone('')
  }

  async function handlePost() {
    if (!formDescription.trim() || !accountId || !accountType) return
    setSaving(true)

    const postingType = accountType === 'lawyer' ? 'seeking_trainee' : 'seeking_position'

    const insertData: any = {
      posting_type: postingType,
      full_name: accountName,
      email: formEmail,
      phone: formPhone,
      city: formCity,
      specialty_id: formSpecialty ? Number(formSpecialty) : null,
      description: formDescription,
    }

    if (accountType === 'lawyer') {
      insertData.lawyer_id = accountId
    }

    await supabase.from('trainee_postings').insert(insertData)

    resetForm()
    setShowForm(false)
    await loadPostings()
    setSaving(false)
  }

  function getSpecialtyName(id: number | null) {
    if (!id) return ''
    const found = specialties.find(function (s) { return s.id === id })
    return found ? found.name_ar : ''
  }

  const filteredPostings = postings.filter(function (p) {
    if (!typeFilter) return true
    return p.posting_type === typeFilter
  })

  function renderPosting(p: Posting) {
    const isSeekingTrainee = p.posting_type === 'seeking_trainee'
    const phoneLink = 'tel:' + (p.phone || '')
    const emailLink = 'mailto:' + (p.email || '')

    return (
      <div key={p.id} className="bg-white border border-[#D8D2C4] rounded-lg p-5 mb-3">
        <div className="flex justify-between items-start mb-2">
          <p className="font-['Tajawal'] font-bold text-[#1B1A17]">{p.full_name}</p>
          <span className={"px-3 py-1 text-xs font-['Tajawal'] rounded-full whitespace-nowrap " + (isSeekingTrainee ? 'bg-[#F0E6D2] text-[#AD8A4E]' : 'bg-[#D9E5DC] text-[#2F4538]')}>
            {isSeekingTrainee ? 'يبحث عن متدرب' : 'يبحث عن فرصة تدريب'}
          </span>
        </div>
        <p className="font-['Tajawal'] text-xs text-[#AD8A4E] mb-2">{getSpecialtyName(p.specialty_id)} {p.city ? '— ' + p.city : ''}</p>
        {p.description && <p className="font-['Tajawal'] text-sm text-[#4A473F] mb-3">{p.description}</p>}
        <div className="flex gap-2">
          {p.phone && <a href={phoneLink} className="px-3 py-1.5 bg-[#F3EEE4] text-[#1B1A17] rounded-md font-['Tajawal'] text-xs">📞 {p.phone}</a>}
          {p.email && <a href={emailLink} className="px-3 py-1.5 bg-[#F3EEE4] text-[#1B1A17] rounded-md font-['Tajawal'] text-xs">✉️ تواصل</a>}
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
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-8 font-['Tajawal'] text-sm">
            <a href="/"><img src="/logo.png" alt="حمورابي" className="h-12 w-auto" /></a>
            <div className="flex gap-5 items-center">
              {accountType !== 'lawyer' && (
                <a href="/lawyers" className="hover:text-[#AD8A4E] transition">دليل المحامين</a>
              )}
              <a href="/ai-assistant" className="hover:text-[#AD8A4E] transition">مساعد ذكي</a>
              {accountType === 'lawyer' && (
                <a href="/lawyer-tools" className="hover:text-[#AD8A4E] transition">أدواتي</a>
              )}
              {accountType === 'lawyer' && (
                <a href="/community" className="hover:text-[#AD8A4E] transition">المجتمع</a>
              )}
              {accountType === 'lawyer' && (
                <a href="/lawyer-messages" className="relative hover:text-[#AD8A4E] transition">
                  <svg className="w-5 h-5 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                  </svg>
                  {totalUnread > 0 && (
                    <span className="absolute -top-2 -left-2 bg-[#AD8A4E] text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{totalUnread}</span>
                  )}
                </a>
              )}
              {accountType !== 'lawyer' && (
                <a href="/my-appointments" className="hover:text-[#AD8A4E] transition">مواعيدي</a>
              )}

              {!checkingAuth && !loggedIn && (
                <a href="/login" className="hover:text-[#AD8A4E] transition">تسجيل الدخول</a>
              )}

              {!checkingAuth && loggedIn && (
                <div className="relative">
                  <button onClick={toggleMenu} className="w-8 h-8 rounded-full bg-[#AD8A4E] flex items-center justify-center hover:bg-[#c49b58] transition">
                    <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.5c-3.3 0-9.8 1.6-9.8 4.9v2.4h19.6v-2.4c0-3.3-6.5-4.9-9.8-4.9z" /></svg>
                  </button>
                  {menuOpen && (
                    <div className="absolute left-0 top-full mt-2 w-52 bg-white border border-[#D8D2C4] rounded-md shadow-lg overflow-hidden z-20">
                      {infoLink && <a href={infoLink} className="block px-4 py-3 font-['Tajawal'] text-sm text-[#1B1A17] hover:bg-[#F3EEE4] transition">معلوماتي الشخصية</a>}
                      <button onClick={handleLogout} className="w-full text-right px-4 py-3 font-['Tajawal'] text-sm text-[#7A2E2E] hover:bg-[#F3EEE4] transition border-t border-[#D8D2C4]">تسجيل الخروج</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <h1 className="font-['Tajawal'] font-bold text-4xl mb-2">لوحة التدريب</h1>
          <p className="font-['Tajawal'] text-sm text-[#D8D2C4]">تربط المحامين الباحثين عن متدربين بالمتدربين الباحثين عن فرصة</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
          <select value={typeFilter} onChange={function (e) { setTypeFilter(e.target.value) }} className="px-4 py-2 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]">
            <option value="">عرض الكل</option>
            <option value="seeking_trainee">محامون يبحثون عن متدربين</option>
            <option value="seeking_position">متدربون يبحثون عن فرصة</option>
          </select>

          {loggedIn && (accountType === 'lawyer' || accountType === 'customer') && (
            <button onClick={function () { resetForm(); setShowForm(!showForm) }} className="px-5 py-2 bg-[#AD8A4E] text-white rounded-md font-['Tajawal'] text-sm">
              {showForm ? 'إلغاء' : (accountType === 'lawyer' ? '+ أبحث عن متدرب' : '+ أبحث عن فرصة')}
            </button>
          )}
        </div>

        {!loggedIn && (
          <div className="bg-white border-2 border-[#AD8A4E] rounded-lg p-4 mb-6">
            <p className="font-['Tajawal'] text-sm text-[#4A473F]">يرجى <a href="/login" className="text-[#AD8A4E] underline">تسجيل الدخول</a> لنشر إعلان على اللوحة</p>
          </div>
        )}

        {showForm && (
          <div className="bg-white border-2 border-[#AD8A4E] rounded-lg p-6 mb-6 space-y-3">
            <select value={formSpecialty} onChange={function (e) { setFormSpecialty(e.target.value) }} className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]">
              <option value="">اختر الاختصاص</option>
              {specialties.map(function (s) { return <option key={s.id} value={s.id}>{s.name_ar}</option> })}
            </select>
            <select value={formCity} onChange={function (e) { setFormCity(e.target.value) }} className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]">
              <option value="">اختر المدينة</option>
              {cityOptions.map(function (c) { return <option key={c} value={c}>{c}</option> })}
            </select>
            <textarea value={formDescription} onChange={function (e) { setFormDescription(e.target.value) }} rows={4} placeholder={accountType === 'lawyer' ? 'صف الفرصة المتاحة ومتطلباتها' : 'قدّم نفسك ولماذا تبحث عن هذه الفرصة'} className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
            <input type="tel" value={formPhone} onChange={function (e) { setFormPhone(e.target.value) }} placeholder="رقم الهاتف" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
            <input type="email" value={formEmail} onChange={function (e) { setFormEmail(e.target.value) }} placeholder="البريد الإلكتروني" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
            <button onClick={handlePost} disabled={saving} className="w-full py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal'] font-medium hover:bg-[#AD8A4E] transition disabled:opacity-60">
              {saving ? 'جاري النشر...' : 'نشر الإعلان'}
            </button>
          </div>
        )}

        {filteredPostings.length === 0 && (
          <p className="font-['Tajawal'] text-center text-[#4A473F]">لا توجد إعلانات مطابقة</p>
        )}

        {filteredPostings.map(renderPosting)}
      </div>
    </div>
  )
}