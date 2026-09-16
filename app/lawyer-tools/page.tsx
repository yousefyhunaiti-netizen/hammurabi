'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'

type ToolGroup = {
  groupLabel: string
  tools: { href: string; label: string; desc: string; icon: string }[]
}

const toolGroups: ToolGroup[] = [
  {
    groupLabel: 'إدارة الأعمال',
    tools: [
      { href: '/lawyer-cases', label: 'ملفات القضايا', desc: 'قائمة وكانبان لكل قضاياك مع الجلسات والمرفقات', icon: 'folder' },
      { href: '/lawyer-library', label: 'مكتبتي القانونية', desc: 'احفظ القوانين ولخّصها بالذكاء الاصطناعي', icon: 'book' },
      { href: '/wakalah', label: 'الوكالات', desc: 'ارفع وتابع وكالات عملائك', icon: 'signature' },
      { href: '/trainee-board', label: 'أبحث عن متدرب', desc: 'انشر فرصة تدريب واعثر على المتدرب المناسب', icon: 'people' },
    ],
  },
  {
    groupLabel: 'التنظيم اليومي',
    tools: [
      { href: '/lawyer-calendar', label: 'أجندتي', desc: 'مواعيدك التطبيقية والشخصية والجلسات في مكان واحد', icon: 'calendar' },
      { href: '/lawyer-notes', label: 'ملاحظاتي', desc: 'مهام وتذكيرات ومحاضر اجتماعات مرتبطة بقضاياك', icon: 'note' },
      { href: '/lawyer-invoices', label: 'الفواتير والمالية', desc: 'دخلك ومصاريفك وأرباحك الحقيقية بشكل واضح', icon: 'money' },
      { href: '/lawyer-history', label: 'الأرشيف', desc: 'مواعيد واستشارات سابقة للرجوع إليها', icon: 'archive' },
    ],
  },
  {
    groupLabel: 'المجتمع',
    tools: [
      { href: '/community', label: 'مجتمع المحامين', desc: 'شارك وتفاعل مع زملائك المحامين', icon: 'people' },
      { href: '/lawyer-articles', label: 'مقالاتي القانونية', desc: 'اكتب مقالات يراها العملاء وابنِ سمعتك المهنية', icon: 'note' },
      { href: '/lawyer-messages', label: 'الرسائل', desc: 'تواصل مباشر مع محامين آخرين', icon: 'chat' },
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

export default function LawyerToolsPage() {
  const [loading, setLoading] = useState(true)
  const [notAllowed, setNotAllowed] = useState(false)
  const [lawyerId, setLawyerId] = useState<number | null>(null)
  const [lawyerName, setLawyerName] = useState('')
  const [pendingFirmId, setPendingFirmId] = useState<number | null>(null)
  const [pendingFirmName, setPendingFirmName] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [totalUnread, setTotalUnread] = useState(0)

  const [activeCasesCount, setActiveCasesCount] = useState(0)
  const [pendingInvoicesCount, setPendingInvoicesCount] = useState(0)
  const [upcomingAppointmentsCount, setUpcomingAppointmentsCount] = useState(0)

  const [showVacationForm, setShowVacationForm] = useState(false)
  const [vacationDate, setVacationDate] = useState('')
  const [savingVacation, setSavingVacation] = useState(false)
  const [vacationMessage, setVacationMessage] = useState('')
  const [currentVacation, setCurrentVacation] = useState('')

  const supabase = createClient()
  const router = useRouter()

  async function loadInviteStatus() {
    const userResult = await supabase.auth.getUser()

    if (!userResult.data.user) {
      setNotAllowed(true)
      setLoading(false)
      return
    }

    const lawyerResult = await supabase
      .from('lawyers')
      .select('id, full_name, pending_firm_id, vacation_until')
      .eq('user_id', userResult.data.user.id)
      .maybeSingle()

    if (!lawyerResult.data) {
      setNotAllowed(true)
      setLoading(false)
      return
    }

    setLawyerId(lawyerResult.data.id)
    setLawyerName(lawyerResult.data.full_name)
    setCurrentVacation(lawyerResult.data.vacation_until || '')

    if (lawyerResult.data.pending_firm_id) {
      setPendingFirmId(lawyerResult.data.pending_firm_id)
      const firmResult = await supabase.from('firms').select('firm_name').eq('id', lawyerResult.data.pending_firm_id).single()
      setPendingFirmName(firmResult.data ? firmResult.data.firm_name : '')
    } else {
      setPendingFirmId(null)
    }

    const casesResult = await supabase.from('legal_cases').select('id', { count: 'exact', head: true }).eq('lawyer_id', lawyerResult.data.id).not('status', 'in', '("مغلقة","مكتسبة","خاسرة")')
    setActiveCasesCount(casesResult.count || 0)

    const invoicesResult = await supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('lawyer_id', lawyerResult.data.id).eq('status', 'unpaid')
    setPendingInvoicesCount(invoicesResult.count || 0)

    const today = new Date()
    const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0')
    const apptResult = await supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('lawyer_id', lawyerResult.data.id).neq('status', 'cancelled').gte('appointment_date', todayStr)
    setUpcomingAppointmentsCount(apptResult.count || 0)

    const unreadResult = await supabase.from('lawyer_messages').select('id', { count: 'exact', head: true }).eq('recipient_lawyer_id', lawyerResult.data.id).eq('is_read', false)
    setTotalUnread(unreadResult.count || 0)

    setLoading(false)
  }

  useEffect(function () {
    loadInviteStatus()
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
    await loadInviteStatus()
  }

  async function handleDeclineInvite() {
    if (!lawyerId) return
    setInviteLoading(true)
    await supabase.from('lawyers').update({ pending_firm_id: null }).eq('id', lawyerId)
    setInviteLoading(false)
    await loadInviteStatus()
  }

  async function handleSaveVacation() {
    if (!lawyerId) return
    setSavingVacation(true)
    await supabase.from('lawyers').update({ vacation_until: vacationDate || null }).eq('id', lawyerId)
    setSavingVacation(false)
    setVacationMessage('تم الحفظ بنجاح')
    setCurrentVacation(vacationDate)
    setVacationDate('')
  }

  async function handleClearVacation() {
    if (!lawyerId) return
    setSavingVacation(true)
    await supabase.from('lawyers').update({ vacation_until: null }).eq('id', lawyerId)
    setSavingVacation(false)
    setCurrentVacation('')
    setVacationMessage('تم إنهاء الإجازة')
  }

  function renderTool(tool: { href: string; label: string; desc: string; icon: string }) {
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
          <p className="font-['Tajawal'] text-[#4A473F] mb-4">هذه الصفحة مخصصة لحسابات المحامين فقط</p>
          <a href="/login" className="inline-block px-6 py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal']">تسجيل الدخول</a>
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
                  <div className="absolute left-0 top-full mt-2 w-64 bg-white border border-[#D8D2C4] rounded-md shadow-lg overflow-hidden z-20">
                    <a href="/lawyer-info" className="block px-4 py-3 font-['Tajawal'] text-sm text-[#1B1A17] hover:bg-[#F3EEE4] transition">معلوماتي الشخصية</a>
                    <div className="border-t border-[#D8D2C4] px-4 py-3">
                      <button onClick={function () { setShowVacationForm(!showVacationForm) }} className="w-full text-right font-['Tajawal'] text-sm text-[#1B1A17] hover:text-[#AD8A4E] transition">
                        {currentVacation ? 'في إجازة حتى ' + currentVacation : 'أضف إجازة'}
                      </button>
                      {showVacationForm && (
                        <div className="mt-2">
                          <input type="date" value={vacationDate} onChange={function (e) { setVacationDate(e.target.value) }} className="w-full px-2 py-1.5 mb-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-xs text-[#1B1A17]" />
                          <div className="flex gap-1">
                            <button onClick={handleSaveVacation} disabled={savingVacation} className="flex-1 py-1.5 bg-[#1B1A17] text-white rounded-md font-['Tajawal'] text-xs">حفظ</button>
                            {currentVacation && (
                              <button onClick={handleClearVacation} disabled={savingVacation} className="flex-1 py-1.5 bg-[#D8D2C4] text-[#4A473F] rounded-md font-['Tajawal'] text-xs">إنهاء الإجازة</button>
                            )}
                          </div>
                          {vacationMessage && <p className="font-['Tajawal'] text-xs text-[#2F4538] mt-1">{vacationMessage}</p>}
                        </div>
                      )}
                    </div>
                    <button onClick={handleLogout} className="w-full text-right px-4 py-3 font-['Tajawal'] text-sm text-[#7A2E2E] hover:bg-[#F3EEE4] transition border-t border-[#D8D2C4]">تسجيل الخروج</button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <h1 className="font-['Tajawal'] font-bold text-4xl mb-1">مرحباً، {lawyerName}</h1>
          <p className="font-['Tajawal'] text-sm text-[#D8D2C4]">لوحة تحكمك الشخصية لإدارة كل تفاصيل عملك القانوني</p>        </div>

        <div className="max-w-4xl mx-auto grid grid-cols-3 gap-4 mt-8">
          <a href="/lawyer-cases" className="bg-white/10 border border-white/20 rounded-lg p-4 text-center hover:bg-white/20 transition">
            <p className="font-['Tajawal'] text-2xl font-bold">{activeCasesCount}</p>
            <p className="font-['Tajawal'] text-xs text-[#D8D2C4]">قضية نشطة</p>
          </a>
          <a href="/lawyer-invoices" className="bg-white/10 border border-white/20 rounded-lg p-4 text-center hover:bg-white/20 transition">
            <p className="font-['Tajawal'] text-2xl font-bold">{pendingInvoicesCount}</p>
            <p className="font-['Tajawal'] text-xs text-[#D8D2C4]">فاتورة معلّقة</p>
          </a>
          <a href="/lawyer-calendar" className="bg-white/10 border border-white/20 rounded-lg p-4 text-center hover:bg-white/20 transition">
            <p className="font-['Tajawal'] text-2xl font-bold">{upcomingAppointmentsCount}</p>
            <p className="font-['Tajawal'] text-xs text-[#D8D2C4]">موعد قادم</p>
          </a>
        </div>
      </div>

      {pendingFirmId && (
        <div className="max-w-4xl mx-auto px-6 pt-6">
          <div className="bg-white border-2 border-[#AD8A4E] rounded-lg p-6">
            <h2 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mb-2">دعوة انضمام</h2>
            <p className="font-['Tajawal'] text-sm text-[#4A473F] mb-4">
              دعاك مكتب <strong>{pendingFirmName}</strong> للانضمام إليه على منصة حمورابي. عند القبول، سيظهر اسم المكتب مع اسمك، وستستمر بإدارة مواعيدك وأدواتك كالمعتاد.
            </p>
            <div className="flex gap-2">
              <button onClick={handleAcceptInvite} disabled={inviteLoading} className="flex-1 py-2 bg-[#2F4538] text-white rounded-md font-['Tajawal'] text-sm">قبول</button>
              <button onClick={handleDeclineInvite} disabled={inviteLoading} className="flex-1 py-2 bg-[#D8D2C4] text-[#4A473F] rounded-md font-['Tajawal'] text-sm">رفض</button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-6 py-10">
        {toolGroups.map(function (group) {
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
    </div>
  )
}