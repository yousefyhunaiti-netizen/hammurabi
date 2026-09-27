'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase'

type WakalahDoc = {
  id: number
  lawyer_id: number
  case_id: number | null
  client_name: string | null
  lawyer_file_url: string | null
  customer_file_url: string | null
  status: string
  wakalah_type: string | null
  special_powers: string | null
  court_scope: string | null
  certified_by: string | null
  certified_date: string | null
  additional_lawyers: string | null
  additional_signers_count: number | null
  issued_abroad: boolean | null
  foreign_authentication_date: string | null
  revoked_date: string | null
  revoked_reason: string | null
}

type LegalCase = {
  id: number
  case_number: string
  client_name: string
}

const courtScopes = ['صلح', 'بداية', 'استئناف', 'تمييز']
const specialPowersOptions = ['الصلح', 'الإبراء', 'قبض الأموال وصرف الشيكات', 'التنازل عن الدعوى', 'تفويض محامي آخر بالتوكيل من الباطن']

function formatDateDisplay(dateStr: string | null) {
  if (!dateStr) return '-'
  const parts = dateStr.split('-')
  if (parts.length !== 3) return dateStr
  return parts[2] + '/' + parts[1] + '/' + parts[0]
}

export default function WakalahPage() {
  const [loading, setLoading] = useState(true)
  const [lawyerId, setLawyerId] = useState<number | null>(null)
  const [notAllowed, setNotAllowed] = useState(false)
  const [notSubscribed, setNotSubscribed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [totalUnread, setTotalUnread] = useState(0)

  const [docs, setDocs] = useState<WakalahDoc[]>([])
  const [cases, setCases] = useState<LegalCase[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showConditions, setShowConditions] = useState(true)

  const [showForm, setShowForm] = useState(false)
  const [formClientName, setFormClientName] = useState('')
  const [formCaseId, setFormCaseId] = useState('')
  const [formType, setFormType] = useState('عامة')
  const [formCourtScope, setFormCourtScope] = useState<string[]>([])
  const [formSpecialPowers, setFormSpecialPowers] = useState<string[]>([])
  const [formCertifiedBy, setFormCertifiedBy] = useState('')
  const [certDay, setCertDay] = useState('')
  const [certMonth, setCertMonth] = useState('')
  const [certYear, setCertYear] = useState('')
  const [formAdditionalLawyers, setFormAdditionalLawyers] = useState('')
  const [formSignersCount, setFormSignersCount] = useState('1')
  const [formIssuedAbroad, setFormIssuedAbroad] = useState(false)
  const [foreignDay, setForeignDay] = useState('')
  const [foreignMonth, setForeignMonth] = useState('')
  const [foreignYear, setForeignYear] = useState('')
  const [formFile, setFormFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  const [revokingId, setRevokingId] = useState<number | null>(null)
  const [revokeReason, setRevokeReason] = useState('')

  const supabase = createClient()

  async function loadDocs(id: number) {
    const result = await supabase.from('wakalah_documents').select('*').eq('lawyer_id', id).order('id', { ascending: false })
    setDocs(result.data || [])
  }

  useEffect(function () {
    async function loadData() {
      const userResult = await supabase.auth.getUser()

      if (!userResult.data.user) {
        setNotAllowed(true)
        setLoading(false)
        return
      }

      const lawyerResult = await supabase.from('lawyers').select('id, is_active, is_comped').eq('user_id', userResult.data.user.id).maybeSingle()

      if (!lawyerResult.data) {
        setNotAllowed(true)
        setLoading(false)
        return
      }

      if (!lawyerResult.data.is_active && !lawyerResult.data.is_comped) {
        setNotSubscribed(true)
        setLoading(false)
        return
      }

      setLawyerId(lawyerResult.data.id)

      const casesResult = await supabase.from('legal_cases').select('id, case_number, client_name').eq('lawyer_id', lawyerResult.data.id)
      setCases(casesResult.data || [])

      const unreadResult = await supabase.from('lawyer_messages').select('id', { count: 'exact', head: true }).eq('recipient_lawyer_id', lawyerResult.data.id).eq('is_read', false)
      setTotalUnread(unreadResult.count || 0)

      await loadDocs(lawyerResult.data.id)
      setLoading(false)
    }

    loadData()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    setMenuOpen(false)
  }

  function toggleMenu() {
    setMenuOpen(!menuOpen)
  }

  function resetForm() {
    setFormClientName('')
    setFormCaseId('')
    setFormType('عامة')
    setFormCourtScope([])
    setFormSpecialPowers([])
    setFormCertifiedBy('')
    setCertDay('')
    setCertMonth('')
    setCertYear('')
    setFormAdditionalLawyers('')
    setFormSignersCount('1')
    setFormIssuedAbroad(false)
    setForeignDay('')
    setForeignMonth('')
    setForeignYear('')
    setFormFile(null)
  }

  function toggleCourtScope(scope: string) {
    if (formCourtScope.indexOf(scope) !== -1) {
      setFormCourtScope(formCourtScope.filter(function (s) { return s !== scope }))
    } else {
      setFormCourtScope(formCourtScope.concat([scope]))
    }
  }

  function toggleSpecialPower(power: string) {
    if (formSpecialPowers.indexOf(power) !== -1) {
      setFormSpecialPowers(formSpecialPowers.filter(function (p) { return p !== power }))
    } else {
      setFormSpecialPowers(formSpecialPowers.concat([power]))
    }
  }

  async function handleAddWakalah() {
    if (!formClientName.trim() || !lawyerId) return
    setSaving(true)

    let uploadedFileUrl = ''
    if (formFile) {
      const filePath = 'wakalah-' + lawyerId + '-' + Date.now() + '-' + formFile.name
      const uploadResult = await supabase.storage.from('wakalah-files').upload(filePath, formFile)
      if (!uploadResult.error) {
        const urlResult = supabase.storage.from('wakalah-files').getPublicUrl(filePath)
        uploadedFileUrl = urlResult.data.publicUrl
      }
    }

    const certifiedDateStr = (certDay && certMonth && certYear) ? certYear + '-' + certMonth.padStart(2, '0') + '-' + certDay.padStart(2, '0') : null
    const foreignDateStr = (foreignDay && foreignMonth && foreignYear) ? foreignYear + '-' + foreignMonth.padStart(2, '0') + '-' + foreignDay.padStart(2, '0') : null

    await supabase.from('wakalah_documents').insert({
      lawyer_id: lawyerId,
      client_name: formClientName,
      case_id: formCaseId ? Number(formCaseId) : null,
      status: 'pending_customer',
      wakalah_type: formType,
      court_scope: formCourtScope.join('، '),
      special_powers: formSpecialPowers.join('، '),
      certified_by: formCertifiedBy,
      certified_date: certifiedDateStr,
      additional_lawyers: formAdditionalLawyers,
      additional_signers_count: Number(formSignersCount),
      issued_abroad: formIssuedAbroad,
      foreign_authentication_date: foreignDateStr,
      lawyer_file_url: uploadedFileUrl || null,
    })

    resetForm()
    setShowForm(false)
    await loadDocs(lawyerId)
    setSaving(false)
  }

  async function handleRevoke(id: number) {
    if (!lawyerId || !revokeReason.trim()) return

    const now = new Date()
    const todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0')

    await supabase.from('wakalah_documents').update({
      status: 'revoked',
      revoked_date: todayStr,
      revoked_reason: revokeReason,
    }).eq('id', id)

    setRevokingId(null)
    setRevokeReason('')
    await loadDocs(lawyerId)
  }

  function getCaseLabel(id: number | null) {
    if (!id) return ''
    const found = cases.find(function (c) { return c.id === id })
    return found ? 'قضية ' + found.case_number : ''
  }

  const filteredDocs = docs.filter(function (d) {
    if (statusFilter === 'active' && d.status === 'revoked') return false
    if (statusFilter === 'revoked' && d.status !== 'revoked') return false
    if (!search.trim()) return true
    const lower = search.toLowerCase()
    return (d.client_name || '').toLowerCase().indexOf(lower) !== -1
  })

  function renderDoc(d: WakalahDoc) {
    const isRevoked = d.status === 'revoked'
    const isRevokingHere = revokingId === d.id

    function revokeClick() {
      setRevokingId(isRevokingHere ? null : d.id)
      setRevokeReason('')
    }

    function confirmRevoke() {
      handleRevoke(d.id)
    }

    return (
      <div key={d.id} className={"border rounded-lg p-5 mb-3 " + (isRevoked ? 'bg-[#F3EEE4] border-[#D8D2C4] opacity-70' : 'bg-white border-[#D8D2C4]')}>
        <div className="flex justify-between items-start mb-2">
          <div>
            <p className="font-['Tajawal'] font-bold text-[#1B1A17]">{d.client_name}</p>
            {d.case_id && <p className="font-['Tajawal'] text-xs text-[#AD8A4E]">{getCaseLabel(d.case_id)}</p>}
          </div>
          <span className={"px-3 py-1 text-xs font-['Tajawal'] rounded-full whitespace-nowrap " + (isRevoked ? 'bg-[#7A2E2E] text-white' : 'bg-[#D9E5DC] text-[#2F4538]')}>
            {isRevoked ? 'ملغاة' : (d.wakalah_type || 'نشطة')}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 font-['Tajawal'] text-xs text-[#4A473F] mb-3">
          {d.court_scope && <p>نطاق التقاضي: {d.court_scope}</p>}
          {d.certified_date && <p>تاريخ التصديق: {formatDateDisplay(d.certified_date)}</p>}
          {d.certified_by && <p>جهة التصديق: {d.certified_by}</p>}
          {d.additional_signers_count && d.additional_signers_count > 1 && <p>عدد الموكلين: {d.additional_signers_count}</p>}
          {d.additional_lawyers && <p className="col-span-2">محامون إضافيون: {d.additional_lawyers}</p>}
          {d.issued_abroad && <p className="col-span-2">صادرة من الخارج {d.foreign_authentication_date ? '— مصدّقة بتاريخ ' + formatDateDisplay(d.foreign_authentication_date) : '(تحتاج تصديق وزارة الخارجية)'}</p>}
          {d.special_powers && <p className="col-span-2 text-[#AD8A4E]">صلاحيات خاصة ممنوحة: {d.special_powers}</p>}
        </div>

        {isRevoked && d.revoked_reason && (
          <p className="font-['Tajawal'] text-xs text-[#7A2E2E] mb-2">سبب الإلغاء ({formatDateDisplay(d.revoked_date)}): {d.revoked_reason}</p>
        )}

        <div className="flex gap-2 items-center flex-wrap">
          {d.lawyer_file_url && <a href={d.lawyer_file_url} target="_blank" rel="noopener noreferrer" className="font-['Tajawal'] text-xs text-[#AD8A4E] underline">عرض ملف الوكالة</a>}
          {d.customer_file_url && <a href={d.customer_file_url} target="_blank" rel="noopener noreferrer" className="font-['Tajawal'] text-xs text-[#2F4538] underline">النسخة الموقّعة من العميل</a>}
          {!isRevoked && (
            <button onClick={revokeClick} className="font-['Tajawal'] text-xs text-[#7A2E2E] mr-auto">إلغاء الوكالة</button>
          )}
        </div>

        {isRevokingHere && (
          <div className="mt-3 pt-3 border-t border-[#D8D2C4]">
            <input type="text" value={revokeReason} onChange={function (e) { setRevokeReason(e.target.value) }} placeholder="سبب الإلغاء" className="w-full px-3 py-2 mb-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-xs text-[#1B1A17]" />
            <button onClick={confirmRevoke} className="w-full py-2 bg-[#7A2E2E] text-white rounded-md font-['Tajawal'] text-xs">تأكيد الإلغاء</button>
          </div>
        )}
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

  if (notAllowed) {
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
            <h1 className="font-['Amiri'] text-2xl text-[#1B1A17] mb-3">يلزم الاشتراك للوصول إلى الوكالات</h1>
            <a href="/subscription" className="inline-block mt-4 px-6 py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal']">عرض خطط الاشتراك</a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div dir="rtl" className="min-h-screen pattern-bg">
      <div className="bg-[#1B1A17] text-[#F3EEE4] py-12 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-8 font-['Tajawal'] text-sm">
            <a href="/"><img src="/logo.png" alt="حمورابي" className="h-12 w-auto" /></a>
            <div className="flex gap-5 items-center">
              <a href="/my-appointments" className="hover:text-[#AD8A4E] transition">مواعيدي</a>
              <a href="/my-consultations" className="hover:text-[#AD8A4E] transition">استشاراتي</a>
              <a href="/ai-assistant" className="hover:text-[#AD8A4E] transition">مساعد ذكي</a>
              <a href="/lawyer-tools" className="hover:text-[#AD8A4E] transition">أدواتي</a>
              <a href="/community" className="hover:text-[#AD8A4E] transition">المجتمع</a>
              <a href="/lawyer-messages" className="relative hover:text-[#AD8A4E] transition">
                <svg className="w-5 h-5 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
                {totalUnread > 0 && (
                  <span className="absolute -top-2 -left-2 bg-[#AD8A4E] text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{totalUnread}</span>
                )}
              </a>
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
          <h1 className="font-['Tajawal'] font-bold text-4xl mb-2">الوكالات ({docs.length})</h1>
          <div className="w-16 h-[2px] bg-[#AD8A4E]"></div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
            <div className="flex gap-2">
              <input type="text" value={search} onChange={function (e) { setSearch(e.target.value) }} placeholder="ابحث باسم الموكل..." className="px-4 py-2 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
              <select value={statusFilter} onChange={function (e) { setStatusFilter(e.target.value) }} className="px-4 py-2 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]">
                <option value="">الكل</option>
                <option value="active">نشطة فقط</option>
                <option value="revoked">ملغاة فقط</option>
              </select>
            </div>
            <button onClick={function () { resetForm(); setShowForm(!showForm) }} className="px-5 py-2 bg-[#AD8A4E] text-white rounded-md font-['Tajawal'] text-sm">
              {showForm ? 'إلغاء' : '+ وكالة جديدة'}
            </button>
          </div>

          {showForm && (
            <div className="bg-white border-2 border-[#AD8A4E] rounded-lg p-6 mb-6 space-y-3">
              <input type="text" value={formClientName} onChange={function (e) { setFormClientName(e.target.value) }} placeholder="اسم الموكل" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />

              <select value={formCaseId} onChange={function (e) { setFormCaseId(e.target.value) }} className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]">
                <option value="">ربط بقضية (اختياري)</option>
                {cases.map(function (c) { return <option key={c.id} value={c.id}>قضية {c.case_number} — {c.client_name}</option> })}
              </select>

              <div>
                <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-1">نوع الوكالة</label>
                <div className="flex gap-2">
                  <button type="button" onClick={function () { setFormType('عامة') }} className={"flex-1 py-2 rounded-md font-['Tajawal'] text-xs " + (formType === 'عامة' ? 'bg-[#1B1A17] text-white' : 'bg-[#F3EEE4] text-[#4A473F] border border-[#D8D2C4]')}>عامة</button>
                  <button type="button" onClick={function () { setFormType('خاصة') }} className={"flex-1 py-2 rounded-md font-['Tajawal'] text-xs " + (formType === 'خاصة' ? 'bg-[#1B1A17] text-white' : 'bg-[#F3EEE4] text-[#4A473F] border border-[#D8D2C4]')}>خاصة</button>
                </div>
              </div>

              <div>
                <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-2">نطاق التقاضي</label>
                <div className="flex flex-wrap gap-2">
                  {courtScopes.map(function (scope) {
                    const isSelected = formCourtScope.indexOf(scope) !== -1
                    return (
                      <button key={scope} type="button" onClick={function () { toggleCourtScope(scope) }} className={"px-3 py-2 rounded-md font-['Tajawal'] text-xs " + (isSelected ? 'bg-[#1B1A17] text-white' : 'bg-[#F3EEE4] text-[#4A473F] border border-[#D8D2C4]')}>
                        {scope}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-2">صلاحيات خاصة ممنوحة (يجب أن تكون منصوصاً عليها صراحة في الوكالة الأصلية)</label>
                <div className="flex flex-wrap gap-2">
                  {specialPowersOptions.map(function (power) {
                    const isSelected = formSpecialPowers.indexOf(power) !== -1
                    return (
                      <button key={power} type="button" onClick={function () { toggleSpecialPower(power) }} className={"px-3 py-2 rounded-md font-['Tajawal'] text-xs " + (isSelected ? 'bg-[#AD8A4E] text-white' : 'bg-[#F3EEE4] text-[#4A473F] border border-[#D8D2C4]')}>
                        {power}
                      </button>
                    )
                  })}
                </div>
              </div>

              <input type="text" value={formCertifiedBy} onChange={function (e) { setFormCertifiedBy(e.target.value) }} placeholder="جهة التصديق (كاتب عدل / المحامي نفسه)" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />

              <div>
                <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-1">تاريخ التصديق</label>
                <div className="grid grid-cols-3 gap-2">
                  <input type="number" value={certDay} onChange={function (e) { setCertDay(e.target.value) }} placeholder="يوم" min="1" max="31" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
                  <input type="number" value={certMonth} onChange={function (e) { setCertMonth(e.target.value) }} placeholder="شهر" min="1" max="12" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
                  <input type="number" value={certYear} onChange={function (e) { setCertYear(e.target.value) }} placeholder="سنة" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
                </div>
              </div>

              <input type="text" value={formAdditionalLawyers} onChange={function (e) { setFormAdditionalLawyers(e.target.value) }} placeholder="محامون إضافيون مذكورون في الوكالة (اختياري)" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />

              <div>
                <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-1">عدد الموكلين الموقعين</label>
                <input type="number" value={formSignersCount} onChange={function (e) { setFormSignersCount(e.target.value) }} min="1" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
              </div>

              <label className="flex items-center gap-2 font-['Tajawal'] text-xs text-[#4A473F]">
                <input type="checkbox" checked={formIssuedAbroad} onChange={function (e) { setFormIssuedAbroad(e.target.checked) }} />
                صادرة من خارج الأردن (تحتاج تصديق وزارة الخارجية)
              </label>

              {formIssuedAbroad && (
                <div>
                  <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-1">تاريخ تصديق وزارة الخارجية (إن وُجد)</label>
                  <div className="grid grid-cols-3 gap-2">
                    <input type="number" value={foreignDay} onChange={function (e) { setForeignDay(e.target.value) }} placeholder="يوم" min="1" max="31" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
                    <input type="number" value={foreignMonth} onChange={function (e) { setForeignMonth(e.target.value) }} placeholder="شهر" min="1" max="12" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
                    <input type="number" value={foreignYear} onChange={function (e) { setForeignYear(e.target.value) }} placeholder="سنة" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
                  </div>
                </div>
              )}

              <label className="cursor-pointer inline-block px-4 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-xs text-[#4A473F] hover:bg-[#D8D2C4] transition">
                📎 {formFile ? formFile.name : 'رفع ملف الوكالة (اختياري)'}
                <input type="file" onChange={function (e) { setFormFile(e.target.files ? e.target.files[0] : null) }} className="hidden" />
              </label>

              <button onClick={handleAddWakalah} disabled={saving} className="w-full py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal'] font-medium hover:bg-[#AD8A4E] transition disabled:opacity-60">
                {saving ? 'جاري الحفظ...' : 'حفظ الوكالة'}
              </button>
            </div>
          )}

          {filteredDocs.length === 0 && !showForm && (
            <p className="font-['Tajawal'] text-center text-[#4A473F]">لا توجد وكالات مطابقة</p>
          )}

          {filteredDocs.map(renderDoc)}
        </div>

        <div>
          <div className="bg-white border border-[#D8D2C4] rounded-lg p-5 sticky top-6">
            <button onClick={function () { setShowConditions(!showConditions) }} className="w-full flex justify-between items-center font-['Tajawal'] font-bold text-sm text-[#1B1A17] mb-3">
              شروط وملاحظات الوكالة
              <span>{showConditions ? '−' : '+'}</span>
            </button>

            {showConditions && (
              <div className="space-y-3 font-['Tajawal'] text-xs text-[#4A473F] leading-relaxed">
                <p><strong className="text-[#1B1A17]">عامة مقابل خاصة:</strong> الوكالة العامة تمنح صلاحيات واسعة (غالباً للشركات)، بينما الوكالة الخاصة مرتبطة بقضية محددة.</p>
                <p><strong className="text-[#1B1A17]">التصديق إلزامي:</strong> يجب أن توقع الوكالة أمام كاتب عدل أو أن يصادق عليها المحامي الوكيل نفسه وفق نظام نقابة المحامين.</p>
                <p><strong className="text-[#1B1A17]">الصلاحيات الخاصة:</strong> الصلح والإبراء وقبض الأموال والتنازل عن الدعوى تحتاج نصاً صريحاً في الوكالة الأصلية — مجرد تحديدها هنا لا يمنحها قانونياً.</p>
                <p><strong className="text-[#1B1A17]">أول مذكرة:</strong> يجب تقديم الوكالة مع أول مذكرة أو طلب يُقدَّم للمحكمة.</p>
                <p><strong className="text-[#1B1A17]">الانتهاء:</strong> تنتهي الوكالة بوفاة الموكل، ويحتاج الورثة لإصدار وكالة جديدة.</p>
                <p><strong className="text-[#1B1A17]">الصادرة من الخارج:</strong> تحتاج تصديقاً من القنصلية الأردنية ثم من وزارة الخارجية لتصبح نافذة.</p>
                <p className="pt-2 border-t border-[#D8D2C4] text-[#7A2E2E]">هذه الملاحظات مرجعية عامة فقط وليست استشارة قانونية أو بديلاً عن مراجعة نص الوكالة الأصلي.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}