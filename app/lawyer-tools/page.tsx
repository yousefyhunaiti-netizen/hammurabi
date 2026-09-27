'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'
import Footer from '../components/Footer'

type Tool = { href: string; label: string; desc: string; icon: string; firms: boolean }

type ToolGroup = {
  groupLabel: string
  tools: Tool[]
}

const toolGroups: ToolGroup[] = [
  {
    groupLabel: 'إدارة الأعمال',
    tools: [
      { href: '/lawyer-cases', label: 'ملفات القضايا', desc: 'قائمة وكانبان لكل قضاياك مع الجلسات والمرفقات', icon: 'folder', firms: false },
      { href: '/lawyer-library', label: 'مكتبتي القانونية', desc: 'احفظ القوانين ولخّصها بالذكاء الاصطناعي', icon: 'book', firms: true },
      { href: '/wakalah', label: 'الوكالات', desc: 'ارفع وتابع وكالات عملائك', icon: 'signature', firms: false },
      { href: '/trainee-board', label: 'أبحث عن متدرب', desc: 'انشر فرصة تدريب واعثر على المتدرب المناسب', icon: 'people', firms: false },
    ],
  },
  {
    groupLabel: 'التنظيم اليومي',
    tools: [
      { href: '/lawyer-calendar', label: 'أجندتي', desc: 'مواعيدك التطبيقية والشخصية والجلسات في مكان واحد', icon: 'calendar', firms: true },
      { href: '/lawyer-invoices', label: 'الفواتير والمالية', desc: 'دخلك ومصاريفك وأرباحك الحقيقية بشكل واضح', icon: 'money', firms: true },
      { href: '/lawyer-history', label: 'المواعيد والاستشارات', desc: 'مواعيد واستشارات سابقة للرجوع إليها', icon: 'archive', firms: true },
    ],
  },
  {
    groupLabel: 'المجتمع',
    tools: [
      { href: '/community', label: 'مجتمع المحامين', desc: 'شارك وتفاعل مع زملائك المحامين', icon: 'people', firms: true },
      { href: '/lawyer-articles', label: 'مقالاتي القانونية', desc: 'اكتب مقالات يراها العملاء وابنِ سمعتك المهنية', icon: 'note', firms: true },
      { href: '/lawyer-messages', label: 'الرسائل', desc: 'تواصل مباشر مع محامين آخرين', icon: 'chat', firms: true },
    ],
  },
]

function ToolIcon({ name }: { name: string }) {
  const paths: { [key: string]: string } = {
    folder: 'M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z',
    book: 'M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 006.5 22H20V4a2 2 0 00-2-2H6.5A2.5 2.5 0 004 4.5v15z',
    signature: 'M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z',
    calendar: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    note: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
    money: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V6m0 10v2m9-8a9 9 0 11-18 0 9 9 0 0118 0z',
    archive: 'M5 8h14M5 8a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v1a2 2 0 01-2 2M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8M10 12h4',
    people: 'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1a4 4 0 100-8 4 4 0 000 8zm6 3a4 4 0 00-3-3.87',
    chat: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z',
  }

  return (
    <svg className="w-6 h-6 text-[#AD8A4E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d={paths[name] || paths.note} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function formatDateDisplay(dateStr: string) {
  const parts = dateStr.split('T')[0].split('-')
  if (parts.length !== 3) return dateStr
  return parts[2] + '/' + parts[1] + '/' + parts[0]
}

export default function LawyerToolsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [notAllowed, setNotAllowed] = useState(false)
  const [accountType, setAccountType] = useState<'lawyer' | 'firm'>('lawyer')
  const [accountName, setAccountName] = useState('')
  const [lawyerId, setLawyerId] = useState<number | null>(null)
  const [pendingFirmId, setPendingFirmId] = useState<number | null>(null)
  const [pendingFirmName, setPendingFirmName] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [totalUnread, setTotalUnread] = useState(0)
  const [pendingConsultations, setPendingConsultations] = useState(0)

  const [currentVacation, setCurrentVacation] = useState('')
  const [vacDay, setVacDay] = useState('')
  const [vacMonth, setVacMonth] = useState('')
  const [vacYear, setVacYear] = useState('')
  const [savingVacation, setSavingVacation] = useState(false)
  const [vacationMessage, setVacationMessage] = useState('')
  const [vacationOk, setVacationOk] = useState(true)

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

  async function loadData() {
    const userResult = await supabase.auth.getUser()

    if (!userResult.data.user) {
      setNotAllowed(true)
      setLoading(false)
      return
    }

    const userId = userResult.data.user.id

    const lawyerResult = await supabase
      .from('lawyers')
      .select('id, full_name, pending_firm_id, vacation_until')
      .eq('user_id', userId)
      .maybeSingle()

    if (lawyerResult.data) {
      setAccountType('lawyer')
      setAccountName(lawyerResult.data.full_name)
      setLawyerId(lawyerResult.data.id)
      setCurrentVacation(lawyerResult.data.vacation_until || '')

      if (lawyerResult.data.pending_firm_id) {
        setPendingFirmId(lawyerResult.data.pending_firm_id)
        const firmResult = await supabase.from('firms').select('firm_name').eq('id', lawyerResult.data.pending_firm_id).single()
        setPendingFirmName(firmResult.data ? firmResult.data.firm_name : '')
      } else {
        setPendingFirmId(null)
      }

      const unreadResult = await supabase.from('lawyer_messages').select('sender_lawyer_id, sender_firm_id').eq('recipient_lawyer_id', lawyerResult.data.id).eq('is_read', false)
      setTotalUnread(countConversations(unreadResult.data || []))

      const pendingResult = await supabase.from('consultations').select('id', { count: 'exact', head: true }).eq('lawyer_id', lawyerResult.data.id).eq('status', 'pending')
      setPendingConsultations(pendingResult.count || 0)

      setLoading(false)
      return
    }

    const firmResult = await supabase.from('firms').select('id, firm_name').eq('user_id', userId).maybeSingle()

    if (!firmResult.data) {
      setNotAllowed(true)
      setLoading(false)
      return
    }

    setAccountType('firm')
    setAccountName(firmResult.data.firm_name)

    const firmUnreadResult = await supabase.from('lawyer_messages').select('sender_lawyer_id, sender_firm_id').eq('recipient_firm_id', firmResult.data.id).eq('is_read', false)
    setTotalUnread(countConversations(firmUnreadResult.data || []))

    const rosterResult = await supabase.from('lawyers').select('id').eq('firm_id', firmResult.data.id)
    const rosterIds = (rosterResult.data || []).map(function (l) { return l.id })
    let pendingFilter = 'firm_id.eq.' + firmResult.data.id
    if (rosterIds.length > 0) {
      pendingFilter = pendingFilter + ',lawyer_id.in.(' + rosterIds.join(',') + ')'
    }
    const firmPendingResult = await supabase.from('consultations').select('id', { count: 'exact', head: true }).eq('status', 'pending').or(pendingFilter)
    setPendingConsultations(firmPendingResult.count || 0)

    setLoading(false)
  }

  useEffect(function () {
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

  async function handleAcceptInvite() {
    if (!lawyerId || !pendingFirmId) return
    setInviteLoading(true)
    await supabase.from('lawyers').update({ firm_id: pendingFirmId, pending_firm_id: null }).eq('id', lawyerId)
    setInviteLoading(false)
    await loadData()
  }

  async function handleDeclineInvite() {
    if (!lawyerId) return
    setInviteLoading(true)
    await supabase.from('lawyers').update({ pending_firm_id: null }).eq('id', lawyerId)
    setInviteLoading(false)
    await loadData()
  }

  async function handleSaveVacation() {
    if (!lawyerId) return
    setVacationMessage('')

    const d = Number(vacDay)
    const m = Number(vacMonth)
    const y = Number(vacYear)
    const candidate = new Date(y, m - 1, d)
    const isValid = d >= 1 && m >= 1 && m <= 12 && y >= 2000 && candidate.getFullYear() === y && candidate.getMonth() === m - 1 && candidate.getDate() === d

    if (!isValid) {
      setVacationOk(false)
      setVacationMessage('يرجى إدخال تاريخ صحيح (يوم / شهر / سنة)')
      return
    }

    const dateStr = y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0')
    const now = new Date()
    const todayStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0')

    if (dateStr < todayStr) {
      setVacationOk(false)
      setVacationMessage('يجب أن يكون التاريخ اليوم أو بعده')
      return
    }

    setSavingVacation(true)
    const result = await supabase.from('lawyers').update({ vacation_until: dateStr }).eq('id', lawyerId).select('id')
    setSavingVacation(false)

    if (result.error || !result.data || result.data.length === 0) {
      setVacationOk(false)
      setVacationMessage('تعذر الحفظ، حاول مرة أخرى')
      return
    }

    setCurrentVacation(dateStr)
    setVacDay('')
    setVacMonth('')
    setVacYear('')
    setVacationOk(true)
    setVacationMessage('تم حفظ الإجازة')
  }

  async function handleClearVacation() {
    if (!lawyerId) return
    setVacationMessage('')
    setSavingVacation(true)
    const result = await supabase.from('lawyers').update({ vacation_until: null }).eq('id', lawyerId).select('id')
    setSavingVacation(false)

    if (result.error || !result.data || result.data.length === 0) {
      setVacationOk(false)
      setVacationMessage('تعذر إنهاء الإجازة، حاول مرة أخرى')
      return
    }

    setCurrentVacation('')
    setVacationOk(true)
    setVacationMessage('تم إنهاء الإجازة')
  }

  function renderTool(tool: Tool) {
    return (
      <a key={tool.href} href={tool.href} className="flex items-start gap-4 bg-white border border-[#D8D2C4] rounded-lg p-5 hover:shadow-lg hover:border-[#AD8A4E] hover:-translate-y-0.5 transition-all">
        <div className="w-12 h-12 rounded-full bg-[#F3EEE4] flex items-center justify-center flex-shrink-0">
          <ToolIcon name={tool.icon} />
        </div>
        <div>
          <h3 className="font-['Tajawal'] font-bold text-[#1B1A17] mb-1">{tool.label}</h3>
          <p className="font-['Tajawal'] text-sm text-[#4A473F]">{tool.desc}</p>
        </div>
      </a>
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
          <p className="font-['Tajawal'] text-[#4A473F] mb-4">هذه الصفحة مخصصة لحسابات المحامين والمكاتب فقط</p>
          <a href="/login" className="inline-block px-6 py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal']">تسجيل الدخول</a>
        </div>
      </div>
    )
  }

  const visibleGroups = toolGroups
    .map(function (group) {
      return {
        groupLabel: group.groupLabel,
        tools: group.tools.filter(function (tool) { return accountType === 'firm' ? tool.firms : true }),
      }
    })
    .filter(function (group) { return group.tools.length > 0 })

  return (
    <div dir="rtl" className="min-h-screen pattern-bg flex flex-col">
      <div className="bg-[#1B1A17] text-[#F3EEE4] py-12 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-8 font-['Tajawal'] text-sm">
            <a href="/"><img src="/logo.png" alt="حمورابي" className="h-12 w-auto" /></a>
            <div className="flex gap-5 items-center">
              {accountType === 'firm' && (
                <a href="/firm-dashboard" className="hover:text-[#AD8A4E] transition">لوحة التحكم</a>
              )}
              <a href="/lawyer-tools" className="text-[#AD8A4E]">أدواتي</a>
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
          <h1 className="font-['Tajawal'] font-bold text-4xl mb-1">مرحباً، {accountName}</h1>
          <p className="font-['Tajawal'] text-sm text-[#D8D2C4]">لوحة تحكمك الشخصية لإدارة كل تفاصيل عملك القانوني</p>
        </div>
      </div>

      {accountType === 'lawyer' && pendingFirmId && (
        <div className="max-w-4xl mx-auto px-6 pt-6 w-full">
          <div className="bg-white border-2 border-[#AD8A4E] rounded-lg p-6">
            <h2 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mb-2">دعوة انضمام</h2>
            <p className="font-['Tajawal'] text-sm text-[#4A473F] mb-4">
              دعاك مكتب <strong>{pendingFirmName}</strong> للانضمام إليه على منصة حمورابي. عند القبول، سيظهر اسم المكتب مع اسمك، وستستمر بإدارة مواعيدك وأدواتك كالمعتاد.
            </p>
            <div className="flex gap-2">
              <button onClick={handleAcceptInvite} disabled={inviteLoading} className="flex-1 py-2 bg-[#2F4538] text-white rounded-md font-['Tajawal'] text-sm disabled:opacity-60">قبول</button>
              <button onClick={handleDeclineInvite} disabled={inviteLoading} className="flex-1 py-2 bg-[#D8D2C4] text-[#4A473F] rounded-md font-['Tajawal'] text-sm disabled:opacity-60">رفض</button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-6 py-10 flex-1 w-full">
        {accountType === 'lawyer' && (
          <div className="bg-white border border-[#D8D2C4] rounded-lg p-5 mb-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-1 h-5 bg-[#AD8A4E] rounded"></span>
              <h2 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17]">الإجازة</h2>
            </div>

            <div className="flex items-center gap-3 bg-[#F3EEE4] rounded-md p-3 mb-3">
              <span className={"w-3 h-3 rounded-full flex-shrink-0 " + (currentVacation ? 'bg-[#AD8A4E]' : 'bg-[#B0AA9C]')}></span>
              <p className="font-['Tajawal'] text-sm text-[#1B1A17] font-medium flex-1">
                {currentVacation ? 'في إجازة حتى ' + formatDateDisplay(currentVacation) : 'غير محدد'}
              </p>
              {currentVacation && (
                <button onClick={handleClearVacation} disabled={savingVacation} className="px-3 py-1.5 bg-[#D8D2C4] text-[#4A473F] rounded-md font-['Tajawal'] text-xs disabled:opacity-60">إنهاء الإجازة</button>
              )}
            </div>

            <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-1">{currentVacation ? 'تعديل تاريخ نهاية الإجازة (يوم / شهر / سنة)' : 'إجازة حتى (يوم / شهر / سنة)'}</label>
            <div className="grid grid-cols-4 gap-2">
              <input type="number" value={vacDay} onChange={function (e) { setVacDay(e.target.value) }} placeholder="يوم" min="1" max="31" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
              <input type="number" value={vacMonth} onChange={function (e) { setVacMonth(e.target.value) }} placeholder="شهر" min="1" max="12" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
              <input type="number" value={vacYear} onChange={function (e) { setVacYear(e.target.value) }} placeholder="سنة" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
              <button onClick={handleSaveVacation} disabled={savingVacation} className="w-full py-2 bg-[#1B1A17] text-[#F3EEE4] hover:bg-[#AD8A4E] transition rounded-md font-['Tajawal'] text-sm disabled:opacity-60">حفظ</button>
            </div>

            {vacationMessage && (
              <p className={"font-['Tajawal'] text-xs mt-2 " + (vacationOk ? 'text-[#2F4538]' : 'text-[#7A2E2E]')}>{vacationMessage}</p>
            )}
          </div>
        )}

        {visibleGroups.map(function (group) {
          return (
            <div key={group.groupLabel} className="mb-8">
              <h2 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mb-4">{group.groupLabel}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {group.tools.map(renderTool)}
              </div>
            </div>
          )
        })}
      </div>

      <Footer variant={accountType === 'firm' ? 'firm' : 'lawyer'} />
    </div>
  )
}