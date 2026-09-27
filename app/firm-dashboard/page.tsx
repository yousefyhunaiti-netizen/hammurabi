'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'
import { getFirmBadgeCount } from '../lib/badges'
import Footer from '../components/Footer'

type Firm = {
  id: number
  firm_name: string
  show_lawyer_names: boolean | null
  bio: string | null
  address: string | null
  city: string | null
  phone: string | null
  founded_year: number | null
  google_maps_link: string | null
  website_url: string | null
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
  photo_url: string | null
}

type Consultation = {
  id: number
  question: string
  status: string
  lawyer_id: number | null
}

type SearchResult = {
  id: number
  full_name: string
  city: string
  specialty_id: number
  firm_id: number | null
  pending_firm_id: number | null
}

export default function FirmDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [firm, setFirm] = useState<Firm | null>(null)
  const [notFirm, setNotFirm] = useState(false)
  const [specialties, setSpecialties] = useState<Specialty[]>([])
  const [roster, setRoster] = useState<FirmLawyer[]>([])
  const [menuOpen, setMenuOpen] = useState(false)
  const [totalUnread, setTotalUnread] = useState(0)
  const [pendingConsultations, setPendingConsultations] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)

  const [showNames, setShowNames] = useState(true)
  const [savingToggle, setSavingToggle] = useState(false)

  const [profileBio, setProfileBio] = useState('')
  const [profileAddress, setProfileAddress] = useState('')
  const [profileCity, setProfileCity] = useState('')
  const [profilePhone, setProfilePhone] = useState('')
  const [profileFoundedYear, setProfileFoundedYear] = useState('')
  const [profileMapsLink, setProfileMapsLink] = useState('')
  const [profileWebsite, setProfileWebsite] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMessage, setProfileMessage] = useState('')

  const [firmConsultations, setFirmConsultations] = useState<Consultation[]>([])
  const [assignSelections, setAssignSelections] = useState<{ [key: number]: string }>({})

  const [searchTerm, setSearchTerm] = useState('')
  const [allLawyers, setAllLawyers] = useState<SearchResult[]>([])
  const [inviteMessage, setInviteMessage] = useState<{ [key: number]: string }>({})

  const supabase = createClient()
  const router = useRouter()

  async function loadRoster(firmId: number) {
    const rosterResult = await supabase
      .from('lawyers')
      .select('id, full_name, specialty_id, city, photo_url')
      .eq('firm_id', firmId)

    setRoster(rosterResult.data || [])
  }

  async function loadConsultations(firmId: number) {
    const result = await supabase.from('consultations').select('id, question, status, lawyer_id').eq('firm_id', firmId)
    setFirmConsultations(result.data || [])
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
        .select('id, firm_name, show_lawyer_names, bio, address, city, phone, founded_year, google_maps_link, website_url')
        .eq('user_id', userResult.data.user.id)
        .single()

      if (!firmResult.data) {
        setNotFirm(true)
        setLoading(false)
        return
      }

      setFirm(firmResult.data)
      setShowNames(firmResult.data.show_lawyer_names === true)
      setProfileBio(firmResult.data.bio || '')
      setProfileAddress(firmResult.data.address || '')
      setProfileCity(firmResult.data.city || '')
      setProfilePhone(firmResult.data.phone || '')
      setProfileFoundedYear(firmResult.data.founded_year ? String(firmResult.data.founded_year) : '')
      setProfileMapsLink(firmResult.data.google_maps_link || '')
      setProfileWebsite(firmResult.data.website_url || '')

      const unreadResult = await supabase.from('lawyer_messages').select('sender_lawyer_id, sender_firm_id').eq('recipient_firm_id', firmResult.data.id).eq('is_read', false)
      const uniqueSenders = new Set((unreadResult.data || []).map(function (m) {
        return m.sender_lawyer_id ? 'lawyer-' + m.sender_lawyer_id : 'firm-' + m.sender_firm_id
      }))
      setTotalUnread(uniqueSenders.size)

      setPendingConsultations(await getFirmBadgeCount(supabase, firmResult.data.id))

      const specialtiesResult = await supabase.from('specialties').select('*')
      setSpecialties(specialtiesResult.data || [])

      await loadRoster(firmResult.data.id)
      await loadConsultations(firmResult.data.id)

      const allLawyersResult = await supabase
        .from('lawyers')
        .select('id, full_name, city, specialty_id, firm_id, pending_firm_id')

      setAllLawyers(allLawyersResult.data || [])

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

  useEffect(function () {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return function () {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  async function handleToggleChange() {
    if (!firm) return
    const newValue = !showNames
    setSavingToggle(true)

    await supabase.from('firms').update({ show_lawyer_names: newValue }).eq('id', firm.id)

    setShowNames(newValue)
    setSavingToggle(false)
  }

  async function handleSaveProfile() {
    if (!firm) return
    setProfileSaving(true)
    setProfileMessage('')

    await supabase.from('firms').update({
      bio: profileBio,
      address: profileAddress,
      city: profileCity,
      phone: profilePhone,
      founded_year: profileFoundedYear ? Number(profileFoundedYear) : null,
      google_maps_link: profileMapsLink,
      website_url: profileWebsite,
    }).eq('id', firm.id)

    setProfileSaving(false)
    setProfileMessage('تم حفظ معلومات المكتب بنجاح')
  }

  function getSearchResults() {
    if (!searchTerm.trim()) return []
    const lower = searchTerm.toLowerCase()
    return allLawyers.filter(function (l) {
      return l.full_name.toLowerCase().indexOf(lower) !== -1
    })
  }

  async function handleInvite(lawyer: SearchResult) {
    if (!firm) return

    const updateResult = await supabase.from('lawyers').update({ pending_firm_id: firm.id }).eq('id', lawyer.id)

    if (updateResult.error) {
      setInviteMessage(function (prev) {
        return Object.assign({}, prev, { [lawyer.id]: 'خطأ: ' + updateResult.error.message })
      })
      return
    }

    setInviteMessage(function (prev) {
      return Object.assign({}, prev, { [lawyer.id]: 'تم إرسال الدعوة، بانتظار موافقة المحامي' })
    })

    setAllLawyers(function (prev) {
      return prev.map(function (r) {
        if (r.id === lawyer.id) {
          return Object.assign({}, r, { pending_firm_id: firm.id })
        }
        return r
      })
    })
  }

  async function handleAssignConsultation(consultationId: number) {
    const selectedId = assignSelections[consultationId]
    if (!selectedId) return

    await supabase.from('consultations').update({ lawyer_id: Number(selectedId) }).eq('id', consultationId)

    if (firm) {
      await loadConsultations(firm.id)
    }
  }

  function getSpecialtyName(specialtyId: number) {
    const found = specialties.find(function (s) { return s.id === specialtyId })
    return found ? found.name_ar : ''
  }

  const unassignedConsultations = firmConsultations.filter(function (c) { return !c.lawyer_id })

  function renderRosterCard(lawyer: FirmLawyer) {
    return (
      <div key={lawyer.id} className="bg-[#F3EEE4] rounded-md p-4 text-center">
        {lawyer.photo_url ? (
          <img src={lawyer.photo_url} alt={lawyer.full_name} className="w-14 h-14 rounded-full object-cover mx-auto mb-2" />
        ) : (
          <div className="w-14 h-14 rounded-full bg-[#1B1A17] flex items-center justify-center text-[#AD8A4E] font-['Tajawal'] font-bold text-lg mx-auto mb-2">
            {lawyer.full_name.charAt(0)}
          </div>
        )}
        <p className="font-['Tajawal'] font-medium text-sm text-[#1B1A17]">{lawyer.full_name}</p>
        <p className="font-['Tajawal'] text-xs text-[#4A473F]">{getSpecialtyName(lawyer.specialty_id)}</p>
      </div>
    )
  }

  function renderSearchResult(result: SearchResult) {
    const currentFirmId = firm ? firm.id : -1
    const alreadyInThisFirm = result.firm_id === currentFirmId
    const alreadyInOtherFirm = result.firm_id !== null && result.firm_id !== currentFirmId
    const pendingThisFirm = result.pending_firm_id === currentFirmId
    const pendingOtherFirm = result.pending_firm_id !== null && result.pending_firm_id !== currentFirmId

    function inviteClick() {
      handleInvite(result)
    }

    return (
      <div key={result.id} className="flex justify-between items-center bg-[#F3EEE4] rounded-md p-4 mb-2">
        <div>
          <p className="font-['Tajawal'] font-medium text-sm text-[#1B1A17]">{result.full_name}</p>
          <p className="font-['Tajawal'] text-xs text-[#4A473F]">{getSpecialtyName(result.specialty_id)} - {result.city}</p>
        </div>

        {alreadyInThisFirm && (
          <span className="font-['Tajawal'] text-xs text-[#2F4538]">عضو حالياً</span>
        )}
        {alreadyInOtherFirm && (
          <span className="font-['Tajawal'] text-xs text-[#7A2E2E]">منضم لمكتب آخر</span>
        )}
        {!alreadyInThisFirm && !alreadyInOtherFirm && pendingThisFirm && (
          <span className="font-['Tajawal'] text-xs text-[#AD8A4E]">بانتظار الموافقة</span>
        )}
        {!alreadyInThisFirm && !alreadyInOtherFirm && pendingOtherFirm && (
          <span className="font-['Tajawal'] text-xs text-[#4A473F]">لديه دعوة معلقة من مكتب آخر</span>
        )}
        {!alreadyInThisFirm && !alreadyInOtherFirm && !pendingThisFirm && !pendingOtherFirm && (
          <button onClick={inviteClick} className="px-4 py-2 bg-[#AD8A4E] text-white rounded-md font-['Tajawal'] text-xs">
            دعوة
          </button>
        )}

        {inviteMessage[result.id] && (
          <p className="font-['Tajawal'] text-xs text-[#2F4538]">{inviteMessage[result.id]}</p>
        )}
      </div>
    )
  }

  function renderConsultationAssign(c: Consultation) {
    function selectChange(e: React.ChangeEvent<HTMLSelectElement>) {
      setAssignSelections(function (prev) {
        return Object.assign({}, prev, { [c.id]: e.target.value })
      })
    }

    function assignClick() {
      handleAssignConsultation(c.id)
    }

    return (
      <div key={c.id} className="bg-[#F3EEE4] rounded-md p-4 mb-3">
        <p className="font-['Tajawal'] text-sm text-[#1B1A17] mb-3">{c.question}</p>
        <div className="flex gap-2">
          <select value={assignSelections[c.id] || ''} onChange={selectChange} className="flex-1 px-3 py-2 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-xs text-[#1B1A17]">
            <option value="">اختر محامياً لإحالة الاستشارة إليه</option>
            {roster.map(function (l) {
              return <option key={l.id} value={l.id}>{l.full_name} - {getSpecialtyName(l.specialty_id)}</option>
            })}
          </select>
          <button onClick={assignClick} className="px-4 py-2 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal'] text-xs">
            إحالة
          </button>
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
    <div dir="rtl" className="min-h-screen pattern-bg flex flex-col">
      <div className="bg-[#1B1A17] text-[#F3EEE4] py-12 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-8 font-['Tajawal'] text-sm">
            <a href="/">
              <img src="/logo.png" alt="حمورابي" className="h-12 w-auto" />
            </a>
            <div className="flex gap-5 items-center">
              <a href="/firm-dashboard" className="text-[#AD8A4E] transition">لوحة التحكم</a>
              <a href="/lawyer-tools" className="hover:text-[#AD8A4E] transition">أدواتي</a>
              <a href="/ai-assistant" className="hover:text-[#AD8A4E] transition">مساعد ذكي</a>
              <a href="/community" className="hover:text-[#AD8A4E] transition">المجتمع</a>
              <a href="/lawyer-messages" className="relative hover:text-[#AD8A4E] transition">
                <svg className="w-5 h-5 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
                {totalUnread > 0 && (
                  <span className="absolute -top-2 -left-2 bg-[#7A2E2E] text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{totalUnread}</span>
                )}
              </a>
              <div className="relative" ref={menuRef}>
                <button onClick={toggleMenu} className="relative w-8 h-8 rounded-full bg-[#AD8A4E] flex items-center justify-center hover:bg-[#c49b58] transition">
                  <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.5c-3.3 0-9.8 1.6-9.8 4.9v2.4h19.6v-2.4c0-3.3-6.5-4.9-9.8-4.9z" /></svg>
                  {pendingConsultations > 0 && (
                    <span className="absolute -top-1 -left-1 bg-[#7A2E2E] text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{pendingConsultations}</span>
                  )}
                </button>
                {menuOpen && (
                  <div className="absolute left-0 top-full mt-2 w-52 bg-white border border-[#D8D2C4] rounded-md shadow-lg overflow-hidden z-20">
                    <a href="/subscription" className="block px-4 py-3 font-['Tajawal'] text-sm text-[#1B1A17] hover:bg-[#F3EEE4] transition">
                      ترقية الاشتراك
                    </a>
                    <a href="/firm-info" className="block px-4 py-3 font-['Tajawal'] text-sm text-[#1B1A17] hover:bg-[#F3EEE4] transition border-t border-[#D8D2C4]">
                      معلوماتي الشخصية
                    </a>
                    <a href="/lawyer-history" className="relative block px-4 py-3 font-['Tajawal'] text-sm text-[#1B1A17] hover:bg-[#F3EEE4] transition border-t border-[#D8D2C4]">
                      المواعيد والاستشارات
                      {pendingConsultations > 0 && (
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 bg-[#7A2E2E] text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{pendingConsultations}</span>
                      )}
                    </a>
                    <button onClick={handleLogout} className="w-full text-right px-4 py-3 font-['Tajawal'] text-sm text-[#7A2E2E] hover:bg-[#F3EEE4] transition border-t border-[#D8D2C4]">
                      تسجيل الخروج
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <h1 className="font-['Tajawal'] font-bold text-4xl mb-2">{firm ? firm.firm_name : ''}</h1>
          <div className="w-16 h-[2px] bg-[#AD8A4E]"></div>
        </div>
      </div>

      {unassignedConsultations.length > 0 && (
        <a href="#unassigned-consultations" className="block bg-[#AD8A4E] text-white text-center py-3 px-6 font-['Tajawal'] text-sm hover:bg-[#c49b58] transition">
          ⚠️ لديك {unassignedConsultations.length} استشارة بانتظار الإحالة إلى محامي — اضغط هنا لمراجعتها
        </a>
      )}

      <div className="max-w-4xl mx-auto px-6 py-10 flex-1 w-full">
        <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-6">
          <h2 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mb-4">معلومات المكتب</h2>
          <div className="space-y-3">
            <div>
              <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-1">نبذة عن المكتب</label>
              <textarea value={profileBio} onChange={function (e) { setProfileBio(e.target.value) }} placeholder="نبذة عن المكتب" rows={3} className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
            </div>
            <div>
              <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-1">العنوان</label>
              <input type="text" value={profileAddress} onChange={function (e) { setProfileAddress(e.target.value) }} placeholder="العنوان" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
            </div>
            <div>
              <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-1">المدينة</label>
              <input type="text" value={profileCity} onChange={function (e) { setProfileCity(e.target.value) }} placeholder="المدينة" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
            </div>
            <div>
              <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-1">رقم الهاتف</label>
              <input type="tel" value={profilePhone} onChange={function (e) { setProfilePhone(e.target.value) }} placeholder="رقم الهاتف" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
            </div>
            <div>
              <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-1">سنة التأسيس</label>
              <input type="number" value={profileFoundedYear} onChange={function (e) { setProfileFoundedYear(e.target.value) }} placeholder="سنة التأسيس" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
            </div>
            <div>
              <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-1">رابط الخريطة (Google Maps)</label>
              <input type="text" value={profileMapsLink} onChange={function (e) { setProfileMapsLink(e.target.value) }} placeholder="رابط الخريطة (Google Maps)" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
            </div>
            <div>
              <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-1">الموقع الإلكتروني</label>
              <input type="text" value={profileWebsite} onChange={function (e) { setProfileWebsite(e.target.value) }} placeholder="الموقع الإلكتروني" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
            </div>
            <button onClick={handleSaveProfile} disabled={profileSaving} className="w-full py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal'] font-medium hover:bg-[#AD8A4E] transition disabled:opacity-60">
              {profileSaving ? 'جاري الحفظ...' : 'حفظ معلومات المكتب'}
            </button>
            {profileMessage && <p className="font-['Tajawal'] text-sm text-[#2F4538]">{profileMessage}</p>}
          </div>
        </div>

        <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-['Tajawal'] font-bold text-[#1B1A17] mb-1">عرض أسماء المحامين للعملاء</p>
              <p className="font-['Tajawal'] text-xs text-[#4A473F]">
                {showNames ? '' : 'العملاء يرون رسالة أن المكتب سيختار المحامي المناسب'}
              </p>
            </div>
            <button
              onClick={handleToggleChange}
              disabled={savingToggle}
              className={"px-4 py-2 rounded-md font-['Tajawal'] text-sm transition " + (showNames ? 'bg-[#2F4538] text-white' : 'bg-[#D8D2C4] text-[#4A473F]')}
            >
              {showNames ? 'مفعّل' : 'غير مفعّل'}
            </button>
          </div>
        </div>

        {unassignedConsultations.length > 0 && (
          <div id="unassigned-consultations" className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-6">
            <h2 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mb-4">استشارات بانتظار الإحالة</h2>
            {unassignedConsultations.map(renderConsultationAssign)}
          </div>
        )}

        <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-6">
          <h2 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mb-4">محامو المكتب</h2>
          {roster.length === 0 && (
            <p className="font-['Tajawal'] text-sm text-[#4A473F] mb-2">لم ينضم أي محامي بعد</p>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {roster.map(renderRosterCard)}
          </div>
        </div>

        <div className="bg-white border-2 border-[#AD8A4E] rounded-lg p-6">
          <h2 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mb-4">دعوة محامي للانضمام</h2>
          <input
            type="text"
            value={searchTerm}
            onChange={function (e) { setSearchTerm(e.target.value) }}
            placeholder="ابحث باسم المحامي..."
            dir="auto"
            className="w-full px-3 py-2 mb-4 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
          />

          {searchTerm && getSearchResults().length === 0 && (
            <p className="font-['Tajawal'] text-sm text-[#4A473F]">لا توجد نتائج</p>
          )}

          {getSearchResults().map(renderSearchResult)}
        </div>
      </div>

      <Footer variant="firm" />
    </div>
  )
}