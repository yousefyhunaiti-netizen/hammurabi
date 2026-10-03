'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'
import { getLawyerBadgeCount, getFirmBadgeCount } from '../lib/badges'
import Footer from '../components/Footer'
import HeaderLines from '../components/HeaderLines'
import Loader from '../components/Loader'

type JobPost = {
  id: number
  created_at: string
  lawyer_id: number | null
  firm_id: number | null
  post_type: string
  title: string
  specialty_id: number | null
  city: string | null
  description: string | null
  is_open: boolean
}

type Application = {
  id: number
  created_at: string
  post_id: number
  lawyer_id: number
  note: string | null
  status: string | null
}

type Person = {
  id: number
  full_name: string
  phone: string | null
  email: string | null
  is_trainee: boolean | null
}

type Specialty = {
  id: number
  name_ar: string
}

const cityOptions = ['عمان', 'إربد', 'الزرقاء', 'البلقاء', 'المفرق', 'الكرك', 'جرش', 'عجلون', 'مادبا', 'العقبة', 'معان', 'الطفيلة']

function formatDateDisplay(dateStr: string) {
  const parts = dateStr.split('T')[0].split('-')
  if (parts.length !== 3) return dateStr
  return parts[2] + '/' + parts[1] + '/' + parts[0]
}

export default function HiringPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [notAllowed, setNotAllowed] = useState(false)
  const [accountType, setAccountType] = useState<'lawyer' | 'firm'>('lawyer')
  const [accountId, setAccountId] = useState<number | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [totalUnread, setTotalUnread] = useState(0)
  const [pendingConsultations, setPendingConsultations] = useState(0)

  const [tab, setTab] = useState<'job' | 'training'>('job')
  // all: every open opportunity; mine: what I posted and who applied; applied: where I applied
  const [view, setView] = useState<'all' | 'mine' | 'applied'>('all')
  const [statusBusyId, setStatusBusyId] = useState<number | null>(null)
  const [posts, setPosts] = useState<JobPost[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [firmNames, setFirmNames] = useState<{ id: number; firm_name: string }[]>([])
  const [specialties, setSpecialties] = useState<Specialty[]>([])
  const [search, setSearch] = useState('')
  const [cityFilter, setCityFilter] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [formType, setFormType] = useState<'job' | 'training'>('job')
  const [formTitle, setFormTitle] = useState('')
  const [formSpecialty, setFormSpecialty] = useState('')
  const [formCity, setFormCity] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const [applyingId, setApplyingId] = useState<number | null>(null)
  const [applyNote, setApplyNote] = useState('')
  const [applyBusy, setApplyBusy] = useState(false)
  const [openApplicantsId, setOpenApplicantsId] = useState<number | null>(null)

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

  async function loadBoard() {
    const postsResult = await supabase.from('job_posts').select('*').order('created_at', { ascending: false })
    const postRows: JobPost[] = postsResult.data || []
    setPosts(postRows)

    // Applications I sent, plus applications to my own posts (the database only returns those).
    const appsResult = await supabase.from('job_applications').select('*').order('created_at', { ascending: false })
    const appRows: Application[] = appsResult.data || []
    setApplications(appRows)

    const lawyerIds = Array.from(new Set(
      postRows.filter(function (p) { return p.lawyer_id }).map(function (p) { return p.lawyer_id as number })
        .concat(appRows.map(function (a) { return a.lawyer_id }))
    ))
    if (lawyerIds.length > 0) {
      const peopleResult = await supabase.from('lawyers').select('id, full_name, phone, email, is_trainee').in('id', lawyerIds)
      setPeople(peopleResult.data || [])
    } else {
      setPeople([])
    }

    const firmIds = Array.from(new Set(postRows.filter(function (p) { return p.firm_id }).map(function (p) { return p.firm_id as number })))
    if (firmIds.length > 0) {
      const firmsResult = await supabase.from('firms').select('id, firm_name').in('id', firmIds)
      setFirmNames(firmsResult.data || [])
    } else {
      setFirmNames([])
    }
  }

  useEffect(function () {
    async function loadData() {
      const tabParam = new URLSearchParams(window.location.search).get('tab')
      const viewParam = new URLSearchParams(window.location.search).get('view')
      if (viewParam === 'mine' || viewParam === 'applied') {
        setView(viewParam)
      }
      if (tabParam === 'training') {
        setTab('training')
        setFormType('training')
      }

      const userResult = await supabase.auth.getUser()

      if (!userResult.data.user) {
        setNotAllowed(true)
        setLoading(false)
        return
      }

      const userId = userResult.data.user.id

      const lawyerResult = await supabase.from('lawyers').select('id, is_trainee').eq('user_id', userId).maybeSingle()

      if (lawyerResult.data) {
        setAccountType('lawyer')
        setAccountId(lawyerResult.data.id)

        // Trainee lawyers start on the training tab.
        if (lawyerResult.data.is_trainee && tabParam !== 'job') {
          setTab('training')
          setFormType('training')
        }

        const unreadResult = await supabase.from('lawyer_messages').select('sender_lawyer_id, sender_firm_id').eq('recipient_lawyer_id', lawyerResult.data.id).eq('is_read', false)
        setTotalUnread(countConversations(unreadResult.data || []))
        setPendingConsultations(await getLawyerBadgeCount(supabase, lawyerResult.data.id))
      } else {
        const firmResult = await supabase.from('firms').select('id').eq('user_id', userId).maybeSingle()

        if (!firmResult.data) {
          setNotAllowed(true)
          setLoading(false)
          return
        }

        setAccountType('firm')
        setAccountId(firmResult.data.id)

        const firmUnreadResult = await supabase.from('lawyer_messages').select('sender_lawyer_id, sender_firm_id').eq('recipient_firm_id', firmResult.data.id).eq('is_read', false)
        setTotalUnread(countConversations(firmUnreadResult.data || []))
        setPendingConsultations(await getFirmBadgeCount(supabase, firmResult.data.id))
      }

      const specialtiesResult = await supabase.from('specialties').select('*')
      setSpecialties(specialtiesResult.data || [])

      await loadBoard()
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

  function isMine(p: JobPost) {
    if (!accountId) return false
    return accountType === 'lawyer' ? p.lawyer_id === accountId : p.firm_id === accountId
  }

  function getPosterName(p: JobPost) {
    if (p.firm_id) {
      const firm = firmNames.find(function (f) { return f.id === p.firm_id })
      return firm ? firm.firm_name : 'مكتب محاماة'
    }
    const person = people.find(function (l) { return l.id === p.lawyer_id })
    return person ? person.full_name : 'محامي'
  }

  function getSpecialtyName(id: number | null) {
    if (!id) return ''
    const found = specialties.find(function (s) { return s.id === id })
    return found ? found.name_ar : ''
  }

  function myApplication(postId: number) {
    return applications.find(function (a) { return a.post_id === postId && a.lawyer_id === accountId }) || null
  }

  function applicantsFor(postId: number) {
    return applications.filter(function (a) { return a.post_id === postId && a.lawyer_id !== accountId })
  }

  function resetForm() {
    setFormTitle('')
    setFormSpecialty('')
    setFormCity('')
    setFormDescription('')
    setFormError('')
  }

  async function handlePost() {
    if (!accountId) return
    if (!formTitle.trim()) {
      setFormError('يرجى كتابة عنوان الفرصة')
      return
    }

    setSaving(true)
    setFormError('')

    const insertData: any = {
      post_type: formType,
      title: formTitle.trim(),
      specialty_id: formSpecialty ? Number(formSpecialty) : null,
      city: formCity || null,
      description: formDescription.trim() || null,
      lawyer_id: accountType === 'lawyer' ? accountId : null,
      firm_id: accountType === 'firm' ? accountId : null,
    }

    const insertResult = await supabase.from('job_posts').insert(insertData)
    setSaving(false)

    if (insertResult.error) {
      setFormError('تعذر نشر الفرصة، حاول مرة أخرى')
      return
    }

    resetForm()
    setShowForm(false)
    setTab(formType)
    await loadBoard()
  }

  async function handleApply(postId: number) {
    if (!accountId || accountType !== 'lawyer') return
    setApplyBusy(true)
    await supabase.from('job_applications').insert({ post_id: postId, lawyer_id: accountId, note: applyNote.trim() || null })
    setApplyBusy(false)
    setApplyingId(null)
    setApplyNote('')
    await loadBoard()
  }

  async function handleWithdraw(applicationId: number) {
    setApplyBusy(true)
    await supabase.from('job_applications').delete().eq('id', applicationId)
    setApplyBusy(false)
    await loadBoard()
  }

  async function handleToggleOpen(p: JobPost) {
    await supabase.from('job_posts').update({ is_open: !p.is_open }).eq('id', p.id)
    await loadBoard()
  }

  // The poster answers an applicant: accepted or declined (the applicant sees it in «طلباتي»).
  async function handleApplicationStatus(applicationId: number, status: 'accepted' | 'declined' | 'sent') {
    setStatusBusyId(applicationId)
    await supabase.rpc('set_application_status', { p_application_id: applicationId, p_status: status })
    setStatusBusyId(null)
    await loadBoard()
  }

  function applicationStatusLabel(status: string | null) {
    if (status === 'accepted') return 'تم قبول طلبك ✓'
    if (status === 'declined') return 'تم الاعتذار عن طلبك'
    return 'قيد المراجعة'
  }

  function applicationStatusClass(status: string | null) {
    if (status === 'accepted') return 'bg-[#D9E5DC] text-[#2F4538]'
    if (status === 'declined') return 'bg-[#F2DEDC] text-[#7A2E2E]'
    return 'bg-[#F0E6D2] text-[#8C6C35]'
  }

  async function handleDeletePost(p: JobPost) {
    await supabase.from('job_posts').delete().eq('id', p.id)
    await loadBoard()
  }

  const myPosts = posts.filter(isMine)

  const appliedPosts = posts.filter(function (p) { return !isMine(p) && !!myApplication(p.id) })

  const visiblePosts = posts.filter(function (p) {
    if (p.post_type !== tab) return false
    if (!p.is_open && !isMine(p)) return false
    if (cityFilter && p.city !== cityFilter) return false
    if (!search.trim()) return true
    const lower = search.toLowerCase()
    return p.title.toLowerCase().indexOf(lower) !== -1
      || (p.description || '').toLowerCase().indexOf(lower) !== -1
      || getPosterName(p).toLowerCase().indexOf(lower) !== -1
  })

  function renderApplicant(a: Application) {
    const person = people.find(function (l) { return l.id === a.lawyer_id })
    return (
      <div key={a.id} className="bg-[#F3EEE4] rounded-md p-3 mb-2">
        <div className="flex justify-between items-start gap-2">
          <p className="font-['Tajawal'] font-bold text-sm text-[#1B1A17]">
            {person ? person.full_name : 'محامي'}
            {person && person.is_trainee && <span className="font-normal text-xs text-[#AD8A4E]"> — محامي متدرب</span>}
          </p>
          <p className="font-['Tajawal'] text-xs text-[#4A473F]">{formatDateDisplay(a.created_at)}</p>
        </div>
        {a.note && <p className="font-['Tajawal'] text-sm text-[#4A473F] mt-1 whitespace-pre-wrap">{a.note}</p>}
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <span className={"px-2 py-0.5 rounded-full font-['Tajawal'] text-[11px] font-bold " + applicationStatusClass(a.status)}>
            {a.status === 'accepted' ? 'مقبول' : a.status === 'declined' ? 'تم الاعتذار' : 'جديد'}
          </span>
          {a.status !== 'accepted' && (
            <button onClick={function () { handleApplicationStatus(a.id, 'accepted') }} disabled={statusBusyId === a.id} className="px-3 py-1 bg-[#2F4538] text-white rounded-md font-['Tajawal'] text-xs disabled:opacity-60">قبول</button>
          )}
          {a.status !== 'declined' && (
            <button onClick={function () { handleApplicationStatus(a.id, 'declined') }} disabled={statusBusyId === a.id} className="px-3 py-1 bg-white text-[#7A2E2E] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-xs disabled:opacity-60">اعتذار</button>
          )}
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          <a href={'/lawyers/' + a.lawyer_id} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-white text-[#1B1A17] rounded-md font-['Tajawal'] text-xs">عرض الملف</a>
          {person && person.phone && <a href={'tel:' + person.phone} className="px-3 py-1.5 bg-white text-[#1B1A17] rounded-md font-['Tajawal'] text-xs" dir="ltr">📞 {person.phone}</a>}
          {person && person.email && <a href={'mailto:' + person.email} className="px-3 py-1.5 bg-white text-[#1B1A17] rounded-md font-['Tajawal'] text-xs">✉️ مراسلة</a>}
        </div>
      </div>
    )
  }

  function renderPost(p: JobPost) {
    const mine = isMine(p)
    const mineApplication = myApplication(p.id)
    const applicants = mine ? applicantsFor(p.id) : []
    const specialtyName = getSpecialtyName(p.specialty_id)
    const applyingHere = applyingId === p.id

    return (
      <div key={p.id} className={"border rounded-lg p-5 mb-3 " + (p.is_open ? 'bg-white border-[#D8D2C4]' : 'bg-[#F3EEE4] border-[#D8D2C4] opacity-80')}>
        <div className="flex justify-between items-start gap-3 mb-1">
          <div>
            <p className="font-['Tajawal'] font-bold text-[#1B1A17]">{p.title}</p>
            <p className="font-['Tajawal'] text-sm text-[#4A473F]">{getPosterName(p)}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            {view !== 'all' && <span className="px-2 py-0.5 bg-[#F0E6D2] text-[#8C6C35] text-xs font-['Tajawal'] rounded-full whitespace-nowrap">{p.post_type === 'training' ? 'تدريب' : 'فرصة عمل'}</span>}
            {mine && view === 'all' && <span className="px-2 py-0.5 bg-[#1B1A17] text-[#F3EEE4] text-xs font-['Tajawal'] rounded-full whitespace-nowrap">منشورك</span>}
            {!p.is_open && <span className="px-2 py-0.5 bg-[#D8D2C4] text-[#4A473F] text-xs font-['Tajawal'] rounded-full whitespace-nowrap">مغلقة</span>}
          </div>
        </div>

        <p className="font-['Tajawal'] text-xs text-[#AD8A4E] mb-2">
          {[specialtyName, p.city, formatDateDisplay(p.created_at)].filter(Boolean).join(' — ')}
        </p>

        {p.description && <p className="font-['Tajawal'] text-sm text-[#4A473F] mb-3 whitespace-pre-wrap">{p.description}</p>}

        {!mine && accountType === 'lawyer' && p.is_open && !mineApplication && !applyingHere && (
          <button onClick={function () { setApplyingId(p.id); setApplyNote('') }} className="px-4 py-2 bg-[#AD8A4E] text-white rounded-md font-['Tajawal'] text-sm">
            تقديم على الفرصة
          </button>
        )}

        {!mine && applyingHere && (
          <div className="mt-2">
            <textarea value={applyNote} onChange={function (e) { setApplyNote(e.target.value) }} rows={3} placeholder="عرّف بنفسك باختصار (اختياري)" className="w-full px-3 py-2 mb-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
            <p className="font-['Tajawal'] text-xs text-[#4A473F] mb-2">سيظهر لصاحب الفرصة اسمك ورقم هاتفك وبريدك الإلكتروني.</p>
            <div className="flex gap-2">
              <button onClick={function () { setApplyingId(null) }} className="flex-1 py-2 bg-[#F3EEE4] text-[#4A473F] rounded-md font-['Tajawal'] text-sm">إلغاء</button>
              <button onClick={function () { handleApply(p.id) }} disabled={applyBusy} className="flex-1 py-2 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal'] text-sm disabled:opacity-60">إرسال الطلب</button>
            </div>
          </div>
        )}

        {!mine && mineApplication && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-['Tajawal'] text-sm text-[#2F4538] font-bold">✓ تم التقديم في {formatDateDisplay(mineApplication.created_at)}</span>
            <span className={"px-2.5 py-0.5 rounded-full font-['Tajawal'] text-xs font-bold " + applicationStatusClass(mineApplication.status)}>{applicationStatusLabel(mineApplication.status)}</span>
            {mineApplication.status !== 'accepted' && (
              <button onClick={function () { handleWithdraw(mineApplication.id) }} disabled={applyBusy} className="font-['Tajawal'] text-xs text-[#7A2E2E]">سحب الطلب</button>
            )}
          </div>
        )}

        {mine && (
          <div className="border-t border-[#D8D2C4] pt-3 mt-2">
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={function () { setOpenApplicantsId(openApplicantsId === p.id ? null : p.id) }} className="px-4 py-2 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal'] text-sm">
                المتقدمون ({applicants.length})
              </button>
              <button onClick={function () { handleToggleOpen(p) }} className="font-['Tajawal'] text-xs text-[#AD8A4E]">
                {p.is_open ? 'إغلاق الفرصة' : 'إعادة فتح الفرصة'}
              </button>
              <button onClick={function () { handleDeletePost(p) }} className="font-['Tajawal'] text-xs text-[#7A2E2E] mr-auto">حذف</button>
            </div>
            {openApplicantsId === p.id && (
              <div className="mt-3">
                {applicants.length === 0 && <p className="font-['Tajawal'] text-sm text-[#4A473F]">لم يتقدم أحد بعد</p>}
                {applicants.map(renderApplicant)}
              </div>
            )}
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

  return (
    <div dir="rtl" className="min-h-screen pattern-bg flex flex-col">
      <div className="hm-header bg-[#1B1A17] text-[#F3EEE4] py-12 px-6">
        <HeaderLines />
        <div className="max-w-3xl mx-auto">
          <div className="flex justify-between items-center mb-8 font-['Tajawal'] text-sm">
            <a href="/"><img src="/logo.png" alt="حمورابي" className="h-12 w-auto" /></a>
            <div className="flex gap-5 items-center">
              {accountType === 'firm' && (
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
                    <a href={accountType === 'firm' ? '/firm-info' : '/lawyer-info'} className="block px-4 py-3 font-['Tajawal'] text-sm text-[#1B1A17] hover:bg-[#F3EEE4] transition border-t border-[#D8D2C4]">معلوماتي الشخصية</a>
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
          <h1 className="font-['Tajawal'] font-bold text-4xl mb-2">التوظيف والتدريب</h1>
          <p className="font-['Tajawal'] text-sm text-[#D8D2C4]">فرص عمل للمحامين وفرص تدريب للمحامين المتدربين، ينشرها المحامون والمكاتب</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10 flex-1 w-full">
        <div className="flex flex-wrap gap-2 mb-6 border-b border-[#D8D2C4]">
          {[
            { key: 'all', label: 'كل الفرص' },
            { key: 'mine', label: 'منشوراتي (' + myPosts.length + ')' },
          ].concat(accountType === 'lawyer' ? [{ key: 'applied', label: 'طلباتي (' + appliedPosts.length + ')' }] : []).map(function (v) {
            const on = view === v.key
            return (
              <button
                key={v.key}
                onClick={function () { setView(v.key as 'all' | 'mine' | 'applied') }}
                className={"relative px-4 pb-3 pt-1 font-['Tajawal'] text-sm font-bold transition " + (on ? 'text-[#1B1A17]' : 'text-[#4A473F] hover:text-[#AD8A4E]')}
              >
                {v.label}
                <span className={"absolute right-0 left-0 -bottom-px h-[3px] rounded-full bg-[#AD8A4E] transition-transform duration-300 origin-center " + (on ? 'scale-x-100' : 'scale-x-0')}></span>
              </button>
            )
          })}
        </div>

        {view === 'mine' && (
          <div>
            <div className="flex justify-between items-center gap-3 mb-5">
              <p className="font-['Tajawal'] text-sm text-[#4A473F]">الفرص التي نشرتها ومن تقدّم إليها</p>
              <button onClick={function () { resetForm(); setFormType(tab); setView('all'); setShowForm(true) }} className="px-5 py-2 bg-[#AD8A4E] text-white rounded-md font-['Tajawal'] text-sm">+ نشر فرصة</button>
            </div>
            {myPosts.length === 0 && (
              <p className="font-['Tajawal'] text-center text-[#4A473F]">لم تنشر أي فرصة بعد</p>
            )}
            {myPosts.map(renderPost)}
          </div>
        )}

        {view === 'applied' && (
          <div>
            <p className="font-['Tajawal'] text-sm text-[#4A473F] mb-5">الفرص التي تقدّمت إليها وحالة كل طلب</p>
            {appliedPosts.length === 0 && (
              <p className="font-['Tajawal'] text-center text-[#4A473F]">لم تتقدم لأي فرصة بعد</p>
            )}
            {appliedPosts.map(renderPost)}
          </div>
        )}

        {view === 'all' && (
        <div>
        <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
          <div className="flex bg-white border border-[#D8D2C4] rounded-md p-1 w-fit">
            <button onClick={function () { setTab('job') }} className={"px-5 py-2 rounded font-['Tajawal'] text-sm font-medium transition " + (tab === 'job' ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'text-[#4A473F]')}>
              فرص للمحامين
            </button>
            <button onClick={function () { setTab('training') }} className={"px-5 py-2 rounded font-['Tajawal'] text-sm font-medium transition " + (tab === 'training' ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'text-[#4A473F]')}>
              فرص تدريب
            </button>
          </div>

          <button onClick={function () { resetForm(); setFormType(tab); setShowForm(!showForm) }} className="px-5 py-2 bg-[#AD8A4E] text-white rounded-md font-['Tajawal'] text-sm">
            {showForm ? 'إلغاء' : '+ نشر فرصة'}
          </button>
        </div>

        {showForm && (
          <div className="bg-white border-2 border-[#AD8A4E] rounded-lg p-6 mb-6 space-y-3">
            <div className="flex bg-[#F3EEE4] border border-[#D8D2C4] rounded-md p-1 w-fit">
              <button type="button" onClick={function () { setFormType('job') }} className={"px-4 py-1.5 rounded font-['Tajawal'] text-xs font-medium transition " + (formType === 'job' ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'text-[#4A473F]')}>فرصة عمل لمحامي</button>
              <button type="button" onClick={function () { setFormType('training') }} className={"px-4 py-1.5 rounded font-['Tajawal'] text-xs font-medium transition " + (formType === 'training' ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'text-[#4A473F]')}>فرصة تدريب</button>
            </div>
            <input type="text" value={formTitle} onChange={function (e) { setFormTitle(e.target.value) }} placeholder={formType === 'job' ? 'عنوان الفرصة (مثال: محامي حقوقي بدوام كامل)' : 'عنوان الفرصة (مثال: تدريب في قضايا الشركات)'} className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
            <select value={formSpecialty} onChange={function (e) { setFormSpecialty(e.target.value) }} className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]">
              <option value="">الاختصاص (اختياري)</option>
              {specialties.map(function (s) { return <option key={s.id} value={s.id}>{s.name_ar}</option> })}
            </select>
            <select value={formCity} onChange={function (e) { setFormCity(e.target.value) }} className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]">
              <option value="">المدينة (اختياري)</option>
              {cityOptions.map(function (c) { return <option key={c} value={c}>{c}</option> })}
            </select>
            <textarea value={formDescription} onChange={function (e) { setFormDescription(e.target.value) }} rows={4} placeholder="التفاصيل والمتطلبات" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
            {formError && <p className="font-['Tajawal'] text-sm text-[#7A2E2E]">{formError}</p>}
            <button onClick={handlePost} disabled={saving} className="w-full py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal'] font-medium hover:bg-[#AD8A4E] transition disabled:opacity-60">
              {saving ? 'جاري النشر...' : 'نشر الفرصة'}
            </button>
          </div>
        )}

        <div className="flex gap-2 mb-5">
          <input type="text" value={search} onChange={function (e) { setSearch(e.target.value) }} placeholder="ابحث في الفرص..." className="flex-1 px-3 py-2 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
          <select value={cityFilter} onChange={function (e) { setCityFilter(e.target.value) }} className="px-3 py-2 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]">
            <option value="">كل المدن</option>
            {cityOptions.map(function (c) { return <option key={c} value={c}>{c}</option> })}
          </select>
        </div>

        {visiblePosts.length === 0 && (
          <p className="font-['Tajawal'] text-center text-[#4A473F]">{tab === 'job' ? 'لا توجد فرص عمل حالياً' : 'لا توجد فرص تدريب حالياً'}</p>
        )}

        {visiblePosts.map(renderPost)}
        </div>
        )}
      </div>

      <Footer variant={accountType === 'firm' ? 'firm' : 'lawyer'} />
    </div>
  )
}
