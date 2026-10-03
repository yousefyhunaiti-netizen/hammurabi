'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'
import { uploadOwnFile, openPrivateFile } from '../lib/files'
import { getLawyerBadgeCount, getFirmBadgeCount } from '../lib/badges'
import Footer from '../components/Footer'
import WorkspaceSwitch from '../components/WorkspaceSwitch'
import HeaderLines from '../components/HeaderLines'
import Loader from '../components/Loader'
import { isInternational } from '../lib/international'

type WakalahDoc = {
  id: number
  lawyer_id: number
  case_id: number | null
  client_name: string | null
  lawyer_file_url: string | null
  customer_file_url: string | null
  status: string
  wakalah_type: string | null
  certified_by: string | null
  certified_date: string | null
  expiry_date: string | null
  additional_lawyers: string | null
  additional_signers_count: number | null
  issued_abroad: boolean | null
  mofa_date: string | null
  notary_date: string | null
  revoked_date: string | null
  revoked_reason: string | null
}

type LegalCase = {
  id: number
  case_number: string
  client_name: string
}

type RosterLawyer = {
  id: number
  full_name: string
}

const wakalahTypes = ['عامة عدلية', 'خاصة عدلية', 'وكالة محامي']
// outside Jordan the Jordanian notary types don't apply
const wakalahTypesAbroad = ['توكيل عام', 'توكيل خاص', 'توكيل محامي']

function formatDateDisplay(dateStr: string | null) {
  if (!dateStr) return '-'
  const parts = dateStr.split('-')
  if (parts.length !== 3) return dateStr
  return parts[2] + '/' + parts[1] + '/' + parts[0]
}

function buildDate(day: string, month: string, year: string) {
  if (!day || !month || !year) return null
  return year + '-' + month.padStart(2, '0') + '-' + day.padStart(2, '0')
}

function todayString() {
  const now = new Date()
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0')
}

function isExpired(d: WakalahDoc) {
  return d.status !== 'revoked' && !!d.expiry_date && d.expiry_date < todayString()
}

export default function WakalahPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [lawyerId, setLawyerId] = useState<number | null>(null)
  const [notAllowed, setNotAllowed] = useState(false)
  const [notSubscribed, setNotSubscribed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [totalUnread, setTotalUnread] = useState(0)
  const [pendingConsultations, setPendingConsultations] = useState(0)

  // Firms see their lawyers' shared wakalahs, read-only, with a lawyer filter.
  const [accountType, setAccountType] = useState<'lawyer' | 'firm'>('lawyer')
  const [roster, setRoster] = useState<RosterLawyer[]>([])
  const [lawyerFilter, setLawyerFilter] = useState('all')
  const isFirm = accountType === 'firm'

  const [docs, setDocs] = useState<WakalahDoc[]>([])
  const [cases, setCases] = useState<LegalCase[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [formClientName, setFormClientName] = useState('')
  const [formCaseId, setFormCaseId] = useState('')
  const [formType, setFormType] = useState(wakalahTypes[0])
  const [abroad, setAbroad] = useState(false)
  const typeList = abroad ? wakalahTypesAbroad : wakalahTypes
  const [formCertifiedBy, setFormCertifiedBy] = useState('')
  const [certDay, setCertDay] = useState('')
  const [certMonth, setCertMonth] = useState('')
  const [certYear, setCertYear] = useState('')
  const [expiryDay, setExpiryDay] = useState('')
  const [expiryMonth, setExpiryMonth] = useState('')
  const [expiryYear, setExpiryYear] = useState('')
  const [formAdditionalLawyers, setFormAdditionalLawyers] = useState('')
  const [formSignersCount, setFormSignersCount] = useState('1')
  const [formIssuedAbroad, setFormIssuedAbroad] = useState(false)
  const [mofaDay, setMofaDay] = useState('')
  const [mofaMonth, setMofaMonth] = useState('')
  const [mofaYear, setMofaYear] = useState('')
  const [notaryDay, setNotaryDay] = useState('')
  const [notaryMonth, setNotaryMonth] = useState('')
  const [notaryYear, setNotaryYear] = useState('')
  const [formFile, setFormFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [revokingId, setRevokingId] = useState<number | null>(null)
  const [revokeReason, setRevokeReason] = useState('')

  const supabase = createClient()
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(function () {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return function () {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  function countConversations(rows: any[]) {
    const senders = new Set(rows.map(function (m) {
      return m.sender_lawyer_id ? 'lawyer-' + m.sender_lawyer_id : 'firm-' + m.sender_firm_id
    }))
    return senders.size
  }

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

      const userId = userResult.data.user.id
      const lawyerResult = await supabase.from('lawyers').select('id, is_active, is_comped, country').eq('user_id', userId).maybeSingle()
      if (lawyerResult.data && isInternational(lawyerResult.data.country)) {
        setAbroad(true)
        setFormType(wakalahTypesAbroad[0])
      }

      if (!lawyerResult.data) {
        const firmResult = await supabase.from('firms').select('id, is_active, is_comped').eq('user_id', userId).maybeSingle()

        if (!firmResult.data) {
          setNotAllowed(true)
          setLoading(false)
          return
        }

        if (!firmResult.data.is_active && !firmResult.data.is_comped) {
          setNotSubscribed(true)
          setLoading(false)
          return
        }

        setAccountType('firm')

        const firmUnreadResult = await supabase.from('lawyer_messages').select('sender_lawyer_id, sender_firm_id').eq('recipient_firm_id', firmResult.data.id).eq('is_read', false)
        setTotalUnread(countConversations(firmUnreadResult.data || []))
        setPendingConsultations(await getFirmBadgeCount(supabase, firmResult.data.id))

        const rosterResult = await supabase.from('lawyers').select('id, full_name').eq('firm_id', firmResult.data.id)
        const rosterRows: RosterLawyer[] = rosterResult.data || []
        setRoster(rosterRows)
        const rosterIds = rosterRows.map(function (l) { return l.id })

        // The database returns only shared (non-private) records of the firm's lawyers.
        if (rosterIds.length > 0) {
          const firmCasesResult = await supabase.from('legal_cases').select('id, case_number, client_name').in('lawyer_id', rosterIds)
          setCases(firmCasesResult.data || [])
          const firmDocsResult = await supabase.from('wakalah_documents').select('*').in('lawyer_id', rosterIds).order('id', { ascending: false })
          setDocs(firmDocsResult.data || [])
        }

        setLoading(false)
        return
      }

      if (!lawyerResult.data.is_active && !lawyerResult.data.is_comped) {
        setNotSubscribed(true)
        setLoading(false)
        return
      }

      setLawyerId(lawyerResult.data.id)

      const unreadResult = await supabase.from('lawyer_messages').select('sender_lawyer_id, sender_firm_id').eq('recipient_lawyer_id', lawyerResult.data.id).eq('is_read', false)
      setTotalUnread(countConversations(unreadResult.data || []))

      setPendingConsultations(await getLawyerBadgeCount(supabase, lawyerResult.data.id))

      const casesResult = await supabase.from('legal_cases').select('id, case_number, client_name').eq('lawyer_id', lawyerResult.data.id)
      setCases(casesResult.data || [])

      await loadDocs(lawyerResult.data.id)
      setLoading(false)
    }

    loadData()

    // Switching between firm work and private work reloads this page's data in place.
    function onWorkspaceChange() { loadData() }
    window.addEventListener('hm:workspace', onWorkspaceChange)
    return function () {
      window.removeEventListener('hm:workspace', onWorkspaceChange)
    }
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    setMenuOpen(false)
    router.push('/')
  }

  function toggleMenu() {
    setMenuOpen(!menuOpen)
  }

  function resetForm() {
    setFormClientName('')
    setFormCaseId('')
    setFormType(typeList[0])
    setFormCertifiedBy('')
    setCertDay('')
    setCertMonth('')
    setCertYear('')
    setExpiryDay('')
    setExpiryMonth('')
    setExpiryYear('')
    setFormAdditionalLawyers('')
    setFormSignersCount('1')
    setFormIssuedAbroad(false)
    setMofaDay('')
    setMofaMonth('')
    setMofaYear('')
    setNotaryDay('')
    setNotaryMonth('')
    setNotaryYear('')
    setFormFile(null)
    setFormError('')
  }

  async function handleAddWakalah() {
    if (!lawyerId) return
    if (!formClientName.trim()) {
      setFormError('يرجى كتابة اسم الموكل')
      return
    }

    setSaving(true)
    setFormError('')

    let uploadedFileUrl = ''
    if (formFile) {
      const storedPath = await uploadOwnFile(supabase, 'wakalah-files', formFile)
      if (!storedPath) {
        setSaving(false)
        setFormError('تعذر رفع الملف، حاول مرة أخرى')
        return
      }
      uploadedFileUrl = storedPath
    }

    const insertResult = await supabase.from('wakalah_documents').insert({
      lawyer_id: lawyerId,
      client_name: formClientName.trim(),
      case_id: formCaseId ? Number(formCaseId) : null,
      status: 'pending_customer',
      wakalah_type: formType,
      certified_by: formCertifiedBy,
      certified_date: buildDate(certDay, certMonth, certYear),
      expiry_date: buildDate(expiryDay, expiryMonth, expiryYear),
      additional_lawyers: formAdditionalLawyers,
      additional_signers_count: Number(formSignersCount) || 1,
      issued_abroad: formIssuedAbroad,
      mofa_date: formIssuedAbroad ? buildDate(mofaDay, mofaMonth, mofaYear) : null,
      notary_date: formIssuedAbroad ? buildDate(notaryDay, notaryMonth, notaryYear) : null,
      lawyer_file_url: uploadedFileUrl || null,
    })

    setSaving(false)

    if (insertResult.error) {
      setFormError('تعذر حفظ الوكالة، حاول مرة أخرى')
      return
    }

    resetForm()
    setShowForm(false)
    await loadDocs(lawyerId)
  }

  async function handleRevoke(id: number) {
    if (!lawyerId || !revokeReason.trim()) return

    await supabase.from('wakalah_documents').update({
      status: 'revoked',
      revoked_date: todayString(),
      revoked_reason: revokeReason,
    }).eq('id', id).eq('lawyer_id', lawyerId)

    setRevokingId(null)
    setRevokeReason('')
    await loadDocs(lawyerId)
  }

  function getCaseLabel(id: number | null) {
    if (!id) return ''
    const found = cases.find(function (c) { return c.id === id })
    return found ? 'قضية ' + found.case_number : ''
  }

  function getRosterName(id: number) {
    const found = roster.find(function (l) { return l.id === id })
    return found ? found.full_name : ''
  }

  const filteredDocs = docs.filter(function (d) {
    if (isFirm && lawyerFilter !== 'all' && d.lawyer_id !== Number(lawyerFilter)) return false
    const revoked = d.status === 'revoked'
    const expired = isExpired(d)
    if (statusFilter === 'active' && (revoked || expired)) return false
    if (statusFilter === 'expired' && !expired) return false
    if (statusFilter === 'revoked' && !revoked) return false
    if (!search.trim()) return true
    const lower = search.toLowerCase()
    return (d.client_name || '').toLowerCase().indexOf(lower) !== -1
  })

  function renderDateFields(label: string, day: string, setDay: (v: string) => void, month: string, setMonth: (v: string) => void, year: string, setYear: (v: string) => void) {
    return (
      <div>
        <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-1">{label}</label>
        <div className="grid grid-cols-3 gap-2">
          <input type="number" value={day} onChange={function (e) { setDay(e.target.value) }} placeholder="يوم" min="1" max="31" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
          <input type="number" value={month} onChange={function (e) { setMonth(e.target.value) }} placeholder="شهر" min="1" max="12" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
          <input type="number" value={year} onChange={function (e) { setYear(e.target.value) }} placeholder="سنة" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
        </div>
      </div>
    )
  }

  function renderDoc(d: WakalahDoc) {
    const isRevoked = d.status === 'revoked'
    const expired = isExpired(d)
    const isRevokingHere = revokingId === d.id

    function revokeClick() {
      setRevokingId(isRevokingHere ? null : d.id)
      setRevokeReason('')
    }

    function confirmRevoke() {
      handleRevoke(d.id)
    }

    let badgeText = d.wakalah_type || 'نشطة'
    let badgeClass = 'bg-[#D9E5DC] text-[#2F4538]'
    if (isRevoked) {
      badgeText = 'ملغاة'
      badgeClass = 'bg-[#7A2E2E] text-white'
    } else if (expired) {
      badgeText = 'منتهية'
      badgeClass = 'bg-[#F3EEE4] text-[#7A2E2E] border border-[#7A2E2E]'
    }

    return (
      <div key={d.id} className={"border rounded-lg p-5 mb-3 " + (isRevoked || expired ? 'bg-[#F3EEE4] border-[#D8D2C4] opacity-80' : 'bg-white border-[#D8D2C4]')}>
        <div className="flex justify-between items-start mb-2">
          <div>
            <p className="font-['Tajawal'] font-bold text-[#1B1A17]">{d.client_name}</p>
            {isFirm && <p className="font-['Tajawal'] text-xs text-[#1B1A17]">المحامي: {getRosterName(d.lawyer_id)}</p>}
            {d.case_id && <p className="font-['Tajawal'] text-xs text-[#AD8A4E]">{getCaseLabel(d.case_id)}</p>}
          </div>
          <span className={"px-3 py-1 text-xs font-['Tajawal'] rounded-full whitespace-nowrap " + badgeClass}>{badgeText}</span>
        </div>

        <div className="grid grid-cols-2 gap-2 font-['Tajawal'] text-xs text-[#4A473F] mb-3">
          {(isRevoked || expired) && d.wakalah_type && <p>النوع: {d.wakalah_type}</p>}
          {d.certified_date && <p>تاريخ التصديق: {formatDateDisplay(d.certified_date)}</p>}
          {d.certified_by && <p>جهة التصديق: {d.certified_by}</p>}
          {d.expiry_date && <p className={expired ? 'text-[#7A2E2E]' : ''}>تاريخ الانتهاء: {formatDateDisplay(d.expiry_date)}</p>}
          {d.additional_signers_count && d.additional_signers_count > 1 && <p>عدد الموكلين: {d.additional_signers_count}</p>}
          {d.additional_lawyers && <p className="col-span-2">محامون إضافيون: {d.additional_lawyers}</p>}
          {d.issued_abroad && (
            <p className="col-span-2">
              صادرة من الخارج — وزارة الخارجية: {d.mofa_date ? formatDateDisplay(d.mofa_date) : 'لم تُصدّق بعد'} — كاتب العدل: {d.notary_date ? formatDateDisplay(d.notary_date) : 'لم تُصدّق بعد'}
            </p>
          )}
        </div>

        {isRevoked && d.revoked_reason && (
          <p className="font-['Tajawal'] text-xs text-[#7A2E2E] mb-2">سبب الإلغاء ({formatDateDisplay(d.revoked_date)}): {d.revoked_reason}</p>
        )}

        <div className="flex gap-2 items-center flex-wrap">
          {d.lawyer_file_url && <button type="button" onClick={function () { openPrivateFile(supabase, 'wakalah-files', d.lawyer_file_url as string) }} className="font-['Tajawal'] text-xs text-[#AD8A4E] underline">عرض ملف الوكالة</button>}
          {d.customer_file_url && <button type="button" onClick={function () { openPrivateFile(supabase, 'wakalah-files', d.customer_file_url as string) }} className="font-['Tajawal'] text-xs text-[#2F4538] underline">النسخة الموقّعة من العميل</button>}
          {!isRevoked && !isFirm && (
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
        <Loader />
      </div>
    )
  }

  if (notAllowed) {
    return (
      <div dir="rtl" className="min-h-screen pattern-bg flex items-center justify-center px-6">
        <div className="text-center">
          <p className="font-['Tajawal'] text-[#4A473F] mb-4">هذه الصفحة مخصصة لحسابات المحامين والمكاتب فقط</p>
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
            <h1 className="font-['Tajawal'] font-bold text-2xl text-[#1B1A17] mb-3">يلزم الاشتراك للوصول إلى الوكالات</h1>
            <a href="/subscription" className="inline-block mt-4 px-6 py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal']">عرض خطط الاشتراك</a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div dir="rtl" className="min-h-screen pattern-bg flex flex-col">
      <div className="hm-header bg-[#1B1A17] text-[#F3EEE4] py-12 px-6">
        <HeaderLines />
        <div className="max-w-3xl mx-auto">
          <div className="flex justify-between items-center mb-8 font-['Tajawal'] text-sm">
            <a href="/"><img src="/logo.png" alt="حمورابي" className="h-12 w-auto" /></a>
            <div className="flex gap-5 items-center">
              {isFirm && (
                <a href="/firm-dashboard" className="hover:text-[#AD8A4E] transition">لوحة التحكم</a>
              )}
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
                    <a href="/subscription" className="block px-4 py-3 font-['Tajawal'] text-sm text-[#1B1A17] hover:bg-[#F3EEE4] transition">ترقية الاشتراك</a>
                    <a href={isFirm ? '/firm-info' : '/lawyer-info'} className="block px-4 py-3 font-['Tajawal'] text-sm text-[#1B1A17] hover:bg-[#F3EEE4] transition border-t border-[#D8D2C4]">معلوماتي الشخصية</a>
                    <a href="/lawyer-history" className="relative block px-4 py-3 font-['Tajawal'] text-sm text-[#1B1A17] hover:bg-[#F3EEE4] transition border-t border-[#D8D2C4]">
                      المواعيد والاستشارات
                      {pendingConsultations > 0 && (
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 bg-[#7A2E2E] text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{pendingConsultations}</span>
                      )}
                    </a>
                    <button onClick={handleLogout} className="w-full text-right px-4 py-3 font-['Tajawal'] text-sm text-[#7A2E2E] hover:bg-[#F3EEE4] transition border-t border-[#D8D2C4]">تسجيل الخروج</button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <h1 className="font-['Tajawal'] font-bold text-4xl mb-2">الوكالات ({docs.length})</h1>
          <p className="font-['Tajawal'] text-sm text-[#D8D2C4]">{isFirm ? 'وكالات محامي المكتب — للاطلاع فقط' : 'سجّل وكالات موكليك وتابع تواريخ تصديقها وانتهائها'}</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10 flex-1 w-full">
        {!isFirm && <WorkspaceSwitch />}

        {isFirm && (
          <select value={lawyerFilter} onChange={function (e) { setLawyerFilter(e.target.value) }} className="w-full px-3 py-2 mb-4 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]">
            <option value="all">جميع المحامين</option>
            {roster.map(function (l) { return <option key={l.id} value={String(l.id)}>{l.full_name}</option> })}
          </select>
        )}

        <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
          <div className="flex gap-2">
            <input type="text" value={search} onChange={function (e) { setSearch(e.target.value) }} placeholder="ابحث باسم الموكل..." className="px-4 py-2 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
            <select value={statusFilter} onChange={function (e) { setStatusFilter(e.target.value) }} className="px-4 py-2 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]">
              <option value="">الكل</option>
              <option value="active">سارية فقط</option>
              <option value="expired">منتهية فقط</option>
              <option value="revoked">ملغاة فقط</option>
            </select>
          </div>
          {!isFirm && (
          <button onClick={function () { resetForm(); setShowForm(!showForm) }} className="px-5 py-2 bg-[#AD8A4E] text-white rounded-md font-['Tajawal'] text-sm">
            {showForm ? 'إلغاء' : '+ وكالة جديدة'}
          </button>
          )}
        </div>

        {showForm && !isFirm && (
          <div className="bg-white border-2 border-[#AD8A4E] rounded-lg p-6 mb-6 space-y-3">
            <input type="text" value={formClientName} onChange={function (e) { setFormClientName(e.target.value) }} placeholder="اسم الموكل" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />

            <select value={formCaseId} onChange={function (e) { setFormCaseId(e.target.value) }} className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]">
              <option value="">ربط بقضية (اختياري)</option>
              {cases.map(function (c) { return <option key={c.id} value={c.id}>قضية {c.case_number} — {c.client_name}</option> })}
            </select>

            <div>
              <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-1">نوع الوكالة</label>
              <div className="flex gap-2">
                {typeList.map(function (t) {
                  return (
                    <button key={t} type="button" onClick={function () { setFormType(t) }} className={"flex-1 py-2 rounded-md font-['Tajawal'] text-xs " + (formType === t ? 'bg-[#1B1A17] text-white' : 'bg-[#F3EEE4] text-[#4A473F] border border-[#D8D2C4]')}>
                      {t}
                    </button>
                  )
                })}
              </div>
            </div>

            <input type="text" value={formCertifiedBy} onChange={function (e) { setFormCertifiedBy(e.target.value) }} placeholder={abroad ? 'جهة التصديق (كاتب عدل / المحامي نفسه / جهة رسمية)' : 'جهة التصديق (كاتب عدل / المحامي نفسه)'} className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />

            {renderDateFields('تاريخ التصديق', certDay, setCertDay, certMonth, setCertMonth, certYear, setCertYear)}

            {renderDateFields('تاريخ انتهاء الوكالة (إن وُجد)', expiryDay, setExpiryDay, expiryMonth, setExpiryMonth, expiryYear, setExpiryYear)}

            <input type="text" value={formAdditionalLawyers} onChange={function (e) { setFormAdditionalLawyers(e.target.value) }} placeholder="محامون إضافيون مذكورون في الوكالة (اختياري)" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />

            <div>
              <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-1">عدد الموكلين الموقعين</label>
              <input type="number" value={formSignersCount} onChange={function (e) { setFormSignersCount(e.target.value) }} min="1" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
            </div>

            {!abroad && (
            <label className="flex items-center gap-2 font-['Tajawal'] text-xs text-[#4A473F]">
              <input type="checkbox" checked={formIssuedAbroad} onChange={function (e) { setFormIssuedAbroad(e.target.checked) }} />
              صادرة من خارج الأردن
            </label>
            )}

            {formIssuedAbroad && !abroad && (
              <div className="space-y-3 bg-[#F3EEE4] rounded-md p-3">
                {renderDateFields('1. تاريخ تصديق وزارة الخارجية', mofaDay, setMofaDay, mofaMonth, setMofaMonth, mofaYear, setMofaYear)}
                {renderDateFields('2. تاريخ تصديق كاتب العدل', notaryDay, setNotaryDay, notaryMonth, setNotaryMonth, notaryYear, setNotaryYear)}
              </div>
            )}

            <label className="cursor-pointer inline-block px-4 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-xs text-[#4A473F] hover:bg-[#D8D2C4] transition">
              📎 {formFile ? formFile.name : 'رفع ملف الوكالة (اختياري)'}
              <input type="file" onChange={function (e) { setFormFile(e.target.files ? e.target.files[0] : null) }} className="hidden" />
            </label>

            {formError && <p className="font-['Tajawal'] text-sm text-[#7A2E2E]">{formError}</p>}

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

      <Footer variant={isFirm ? 'firm' : 'lawyer'} />
    </div>
  )
}
