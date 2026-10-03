'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase'
import { authHeaders } from '../lib/files'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import HeaderLines from '../components/HeaderLines'
import Loader from '../components/Loader'

type Payment = {
  id: number
  payment_type: string
  amount: number
  status: string
  created_at: string
}

type Subscription = {
  id: number
  account_type: string
  account_id: number
  tier: string
  status: string
  started_at: string
  price: number
}

type LawyerRow = {
  id: number
  full_name: string
  is_comped: boolean | null
  is_active: boolean | null
  city: string | null
  specialty_id: number | null
  created_at: string | null
}

type FirmRow = {
  id: number
  firm_name: string
  is_comped: boolean | null
  is_active: boolean | null
  city: string | null
  created_at: string | null
}

type Specialty = {
  id: number
  name_ar: string
}

type Discount = {
  id: number
  account_type: string
  account_id: number
  discount_type: string
  discount_value: number
}

type AppointmentRow = {
  id: number
  lawyer_id: number | null
  specialty_id: number | null
}

const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
const monthNamesShort = ['ينا', 'فبر', 'مار', 'أبر', 'ماي', 'يون', 'يول', 'أغس', 'سبت', 'أكت', 'نوف', 'ديس']

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [payments, setPayments] = useState<Payment[]>([])
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [customerCount, setCustomerCount] = useState(0)
  const [lawyerCount, setLawyerCount] = useState(0)
  const [firmCount, setFirmCount] = useState(0)
  const [specialties, setSpecialties] = useState<Specialty[]>([])
  const [appointments, setAppointments] = useState<AppointmentRow[]>([])
  const [lawyerCities, setLawyerCities] = useState<{ city: string | null; specialty_id: number | null; id: number }[]>([])
  const [firmCities, setFirmCities] = useState<{ city: string | null }[]>([])
  const [customerCreated, setCustomerCreated] = useState<{ created_at: string | null }[]>([])
  const [lawyerCreated, setLawyerCreated] = useState<{ created_at: string | null }[]>([])
  const [firmCreated, setFirmCreated] = useState<{ created_at: string | null }[]>([])

  const [viewMode, setViewMode] = useState('monthly')
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedDay, setSelectedDay] = useState(new Date())

  const [expandedMetric, setExpandedMetric] = useState('')
  const [trendOffset, setTrendOffset] = useState(0)

  const [allLawyers, setAllLawyers] = useState<LawyerRow[]>([])
  const [allFirms, setAllFirms] = useState<FirmRow[]>([])
  const [compedUpdating, setCompedUpdating] = useState<string | null>(null)
  const [lawyerSearch, setLawyerSearch] = useState('')
  const [firmSearch, setFirmSearch] = useState('')

  const [discounts, setDiscounts] = useState<Discount[]>([])
  const [discountSearch, setDiscountSearch] = useState('')
  const [discountSelected, setDiscountSelected] = useState<{ type: string; id: number; name: string } | null>(null)
  const [discountType, setDiscountType] = useState('percentage')
  const [discountValue, setDiscountValue] = useState('')
  const [savingDiscount, setSavingDiscount] = useState(false)

  const [broadcastSubject, setBroadcastSubject] = useState('')
  const [broadcastMessage, setBroadcastMessage] = useState('')
  const [broadcastTarget, setBroadcastTarget] = useState('all')
  const [sendingBroadcast, setSendingBroadcast] = useState(false)
  const [broadcastResult, setBroadcastResult] = useState('')

  const [pendingLawyers, setPendingLawyers] = useState<any[]>([])
  const [pendingFirms, setPendingFirms] = useState<any[]>([])
  const [approvingKey, setApprovingKey] = useState('')

  const supabase = createClient()

  // Accounts waiting for the team's review (new sign-ups send their details first).
  async function loadPendingAccounts() {
    const lawyersResult = await supabase
      .from('lawyers')
      .select('id, full_name, email, phone, city, bar_certificate_number, specialty_id, is_trainee, needs_onboarding, created_at')
      .eq('is_approved', false)
      .order('created_at', { ascending: false })
    const firmsResult = await supabase
      .from('firms')
      .select('id, firm_name, email, phone, city, address, needs_onboarding, created_at')
      .eq('is_approved', false)
      .order('created_at', { ascending: false })
    setPendingLawyers(lawyersResult.data || [])
    setPendingFirms(firmsResult.data || [])
  }

  // Approving a new account emails it «تم تأكيد حسابك» with a link to subscribe.
  async function handleApprove(accountType: 'lawyer' | 'firm', id: number) {
    setApprovingKey(accountType + '-' + id)
    await supabase.rpc('admin_approve_account', { p_account_type: accountType, p_account_id: id })
    setApprovingKey('')
    await loadPendingAccounts()
  }

  async function loadCompedLists() {
    const lawyersResult = await supabase.from('lawyers').select('id, full_name, is_comped, is_active, city, specialty_id, created_at')
    const firmsResult = await supabase.from('firms').select('id, firm_name, is_comped, is_active, city, created_at')
    setAllLawyers(lawyersResult.data || [])
    setAllFirms(firmsResult.data || [])
    setLawyerCities((lawyersResult.data || []).map(function (l: LawyerRow) { return { city: l.city, specialty_id: l.specialty_id, id: l.id } }))
    setFirmCities((firmsResult.data || []).map(function (f: FirmRow) { return { city: f.city } }))
    setLawyerCreated((lawyersResult.data || []).map(function (l: LawyerRow) { return { created_at: l.created_at } }))
    setFirmCreated((firmsResult.data || []).map(function (f: FirmRow) { return { created_at: f.created_at } }))
  }

  useEffect(function () {
    async function loadData() {
      const userResult = await supabase.auth.getUser()

      if (!userResult.data.user) {
        setLoading(false)
        return
      }

      const adminResult = await supabase.from('admins').select('user_id').eq('user_id', userResult.data.user.id).maybeSingle()

      if (!adminResult.data) {
        setLoading(false)
        return
      }

      setIsAdmin(true)

      const paymentsResult = await supabase.from('payments').select('*')
      const subsResult = await supabase.from('subscriptions').select('*')

      const customersFullResult = await supabase.from('customers').select('id, created_at')
      const lawyersCountResult = await supabase.from('lawyers').select('id', { count: 'exact', head: true })
      const firmsCountResult = await supabase.from('firms').select('id', { count: 'exact', head: true })

      setPayments(paymentsResult.data || [])
      setSubscriptions(subsResult.data || [])
      setCustomerCount((customersFullResult.data || []).length)
      setCustomerCreated((customersFullResult.data || []).map(function (c: { created_at: string | null }) { return { created_at: c.created_at } }))
      setLawyerCount(lawyersCountResult.count || 0)
      setFirmCount(firmsCountResult.count || 0)

      const specialtiesResult = await supabase.from('specialties').select('*')
      setSpecialties(specialtiesResult.data || [])

      const appointmentsResult = await supabase.from('appointments').select('id, lawyer_id, specialty_id')
      setAppointments(appointmentsResult.data || [])

      const discountsResult = await supabase.from('discounts').select('*')
      setDiscounts(discountsResult.data || [])

      await loadCompedLists()
      await loadPendingAccounts()

      setLoading(false)
    }

    loadData()
  }, [])

  function isInSelectedMonth(dateStr: string) {
    const d = new Date(dateStr)
    return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear
  }

  function isInSelectedDay(dateStr: string) {
    const d = new Date(dateStr)
    return d.getFullYear() === selectedDay.getFullYear() && d.getMonth() === selectedDay.getMonth() && d.getDate() === selectedDay.getDate()
  }

  const scopedPayments = viewMode === 'monthly'
    ? payments.filter(function (p) { return isInSelectedMonth(p.created_at) && p.status === 'completed' })
    : payments.filter(function (p) { return isInSelectedDay(p.created_at) && p.status === 'completed' })

  let scopedRevenue = 0
  for (let i = 0; i < scopedPayments.length; i++) {
    scopedRevenue = scopedRevenue + Number(scopedPayments[i].amount)
  }

  const activeSubscriptions = subscriptions.filter(function (s) { return s.status === 'active' })

  const cancelledScoped = viewMode === 'monthly'
    ? subscriptions.filter(function (s) { return s.status === 'cancelled' && isInSelectedMonth(s.started_at) })
    : subscriptions.filter(function (s) { return s.status === 'cancelled' && isInSelectedDay(s.started_at) })

  function monthlyEquivalent(sub: Subscription) {
    if (sub.tier === 'yearly') return Number(sub.price) / 12
    if (sub.tier === '5year') return Number(sub.price) / 60
    return Number(sub.price)
  }

  let mrr = 0
  activeSubscriptions.forEach(function (s) { mrr = mrr + monthlyEquivalent(s) })

  const totalCancelledAllTime = subscriptions.filter(function (s) { return s.status === 'cancelled' }).length
  const churnRate = (activeSubscriptions.length + totalCancelledAllTime) > 0
    ? (totalCancelledAllTime / (activeSubscriptions.length + totalCancelledAllTime)) * 100
    : 0

  function buildDailyRevenueData() {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate()
    const data = []
    for (let day = 1; day <= daysInMonth; day++) {
      let dayTotal = 0
      for (let i = 0; i < scopedPayments.length; i++) {
        const d = new Date(scopedPayments[i].created_at)
        if (d.getDate() === day) dayTotal = dayTotal + Number(scopedPayments[i].amount)
      }
      data.push({ label: String(day), revenue: dayTotal })
    }
    return data
  }

  function buildHourlyRevenueData() {
    const data = []
    for (let hour = 0; hour < 24; hour++) {
      let hourTotal = 0
      for (let i = 0; i < scopedPayments.length; i++) {
        const d = new Date(scopedPayments[i].created_at)
        if (d.getHours() === hour) hourTotal = hourTotal + Number(scopedPayments[i].amount)
      }
      data.push({ label: String(hour) + ':00', revenue: hourTotal })
    }
    return data
  }

  const chartData = viewMode === 'monthly' ? buildDailyRevenueData() : buildHourlyRevenueData()

  function changeMonth(direction: number) {
    let newMonth = selectedMonth + direction
    let newYear = selectedYear
    if (newMonth < 0) { newMonth = 11; newYear = newYear - 1 }
    if (newMonth > 11) { newMonth = 0; newYear = newYear + 1 }
    setSelectedMonth(newMonth)
    setSelectedYear(newYear)
  }

  function changeDay(direction: number) {
    const newDay = new Date(selectedDay)
    newDay.setDate(newDay.getDate() + direction)
    setSelectedDay(newDay)
  }

  function buildMonthlyTrend(dateGetter: (item: any) => string | null, records: any[], offsetBlocks: number) {
    const now = new Date()
    const anchorMonthIndex = now.getFullYear() * 12 + now.getMonth() - offsetBlocks * 12
    const data = []

    for (let i = 11; i >= 0; i--) {
      const monthIndex = anchorMonthIndex - i
      const year = Math.floor(monthIndex / 12)
      const month = ((monthIndex % 12) + 12) % 12

      let count = 0
      for (let r = 0; r < records.length; r++) {
        const dateStr = dateGetter(records[r])
        if (!dateStr) continue
        const d = new Date(dateStr)
        if (d.getFullYear() === year && d.getMonth() === month) count = count + 1
      }

      data.push({ label: monthNamesShort[month] + ' ' + String(year).slice(2), value: count })
    }

    return data
  }

  function buildMonthlyRevenueTrend(offsetBlocks: number) {
    const now = new Date()
    const anchorMonthIndex = now.getFullYear() * 12 + now.getMonth() - offsetBlocks * 12
    const data = []

    const completedPayments = payments.filter(function (p) { return p.status === 'completed' })

    for (let i = 11; i >= 0; i--) {
      const monthIndex = anchorMonthIndex - i
      const year = Math.floor(monthIndex / 12)
      const month = ((monthIndex % 12) + 12) % 12

      let total = 0
      completedPayments.forEach(function (p) {
        const d = new Date(p.created_at)
        if (d.getFullYear() === year && d.getMonth() === month) total = total + Number(p.amount)
      })

      data.push({ label: monthNamesShort[month] + ' ' + String(year).slice(2), value: total })
    }

    return data
  }

  function toggleMetric(metric: string) {
    if (expandedMetric === metric) {
      setExpandedMetric('')
    } else {
      setExpandedMetric(metric)
      setTrendOffset(0)
    }
  }

  function renderTrendChart(title: string, data: { label: string; value: number }[], captionNote?: string) {
    return (
      <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-['Tajawal'] font-bold text-[#1B1A17]">{title} — آخر 12 شهراً</h3>
          <div className="flex gap-2">

          </div>            <button onClick={function () { setTrendOffset(trendOffset + 1) }} className="px-3 py-1.5 bg-[#F3EEE4] text-[#4A473F] rounded-md font-['Tajawal'] text-xs">12 شهراً أقدم ←</button>
            <button onClick={function () { setTrendOffset(Math.max(0, trendOffset - 1)) }} disabled={trendOffset === 0} className="px-3 py-1.5 bg-[#F3EEE4] text-[#4A473F] rounded-md font-['Tajawal'] text-xs disabled:opacity-40">→ 12 شهراً أحدث</button>
        </div>
        <div style={{ width: '100%', height: 220 }}>
          <ResponsiveContainer>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D8D2C4" />
              <XAxis dataKey="label" fontSize={10} />
              <YAxis fontSize={10} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#AD8A4E" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {captionNote && <p className="font-['Tajawal'] text-xs text-[#4A473F] mt-2">{captionNote}</p>}
      </div>
    )
  }

  async function toggleLawyerComped(lawyer: LawyerRow) {
    const key = 'lawyer-' + lawyer.id
    setCompedUpdating(key)
    const newValue = !lawyer.is_comped
    await supabase.from('lawyers').update({ is_comped: newValue, is_active: newValue ? true : lawyer.is_active }).eq('id', lawyer.id)
    await loadCompedLists()
    setCompedUpdating(null)
  }

  async function toggleFirmComped(firm: FirmRow) {
    const key = 'firm-' + firm.id
    setCompedUpdating(key)
    const newValue = !firm.is_comped
    await supabase.from('firms').update({ is_comped: newValue, is_active: newValue ? true : firm.is_active }).eq('id', firm.id)
    await loadCompedLists()
    setCompedUpdating(null)
  }

  function getDiscountSearchResults() {
    if (!discountSearch.trim()) return []
    const lower = discountSearch.toLowerCase()
    const lawyerMatches = allLawyers.filter(function (l) { return l.full_name.toLowerCase().indexOf(lower) !== -1 }).map(function (l) { return { type: 'lawyer', id: l.id, name: l.full_name } })
    const firmMatches = allFirms.filter(function (f) { return f.firm_name.toLowerCase().indexOf(lower) !== -1 }).map(function (f) { return { type: 'firm', id: f.id, name: f.firm_name } })
    return lawyerMatches.concat(firmMatches)
  }

  function selectDiscountAccount(account: { type: string; id: number; name: string }) {
    setDiscountSelected(account)
    setDiscountSearch('')
    const existing = discounts.find(function (d) { return d.account_type === account.type && d.account_id === account.id })
    if (existing) {
      setDiscountType(existing.discount_type)
      setDiscountValue(String(existing.discount_value))
    } else {
      setDiscountType('percentage')
      setDiscountValue('')
    }
  }

  async function handleSaveDiscount() {
    if (!discountSelected || !discountValue) return
    setSavingDiscount(true)

    const existing = discounts.find(function (d) { return d.account_type === discountSelected.type && d.account_id === discountSelected.id })

    if (existing) {
      await supabase.from('discounts').update({ discount_type: discountType, discount_value: Number(discountValue) }).eq('id', existing.id)
    } else {
      await supabase.from('discounts').insert({ account_type: discountSelected.type, account_id: discountSelected.id, discount_type: discountType, discount_value: Number(discountValue) })
    }

    const discountsResult = await supabase.from('discounts').select('*')
    setDiscounts(discountsResult.data || [])
    setSavingDiscount(false)
    setDiscountSelected(null)
    setDiscountValue('')
  }

  async function handleRemoveDiscount(id: number) {
    await supabase.from('discounts').delete().eq('id', id)
    const discountsResult = await supabase.from('discounts').select('*')
    setDiscounts(discountsResult.data || [])
  }

  function getAccountNameForDiscount(d: Discount) {
    if (d.account_type === 'lawyer') {
      const found = allLawyers.find(function (l) { return l.id === d.account_id })
      return found ? found.full_name : 'محامي #' + d.account_id
    }
    const found = allFirms.find(function (f) { return f.id === d.account_id })
    return found ? found.firm_name : 'مكتب #' + d.account_id
  }

  async function handleSendBroadcast() {
    if (!broadcastMessage.trim()) return
    setSendingBroadcast(true)
    setBroadcastResult('')

    await supabase.from('announcements').insert({
      subject: broadcastSubject || 'إشعار من حمورابي',
      message: broadcastMessage,
    })

    const response = await fetch('/api/broadcast-email', {
      method: 'POST',
      headers: await authHeaders(supabase),
      body: JSON.stringify({ subject: broadcastSubject || 'إشعار من حمورابي', message: broadcastMessage, target: broadcastTarget }),
    })

    const data = await response.json()
    if (!response.ok) {
      setBroadcastResult('تم نشر الإعلان داخل المنصة، لكن تعذر إرسال البريد الإلكتروني')
    } else {
      setBroadcastResult('تم الإرسال إلى ' + data.sentCount + ' من أصل ' + data.totalRecipients)
    }
    setSendingBroadcast(false)
    setBroadcastMessage('')
    setBroadcastSubject('')
  }

  function getSpecialtyName(id: number | null) {
    if (!id) return 'غير محدد'
    const found = specialties.find(function (s) { return s.id === id })
    return found ? found.name_ar : 'غير محدد'
  }

  function buildSpecialtyHeatmap() {
    const counts: { [key: string]: number } = {}

    appointments.forEach(function (a) {
      let specialtyId = a.specialty_id
      if (!specialtyId && a.lawyer_id) {
        const lawyer = lawyerCities.find(function (l) { return l.id === a.lawyer_id })
        if (lawyer) specialtyId = lawyer.specialty_id
      }
      const name = getSpecialtyName(specialtyId)
      counts[name] = (counts[name] || 0) + 1
    })

    return Object.entries(counts).sort(function (a, b) { return b[1] - a[1] }).slice(0, 6)
  }

  function buildCityBreakdown() {
    const counts: { [key: string]: number } = {}

    lawyerCities.forEach(function (l) {
      const city = l.city || 'غير محدد'
      counts[city] = (counts[city] || 0) + 1
    })

    firmCities.forEach(function (f) {
      const city = f.city || 'غير محدد'
      counts[city] = (counts[city] || 0) + 1
    })

    return Object.entries(counts).sort(function (a, b) { return b[1] - a[1] }).slice(0, 8)
  }

  const specialtyHeatmap = buildSpecialtyHeatmap()
  const cityBreakdown = buildCityBreakdown()

  function handleExportCsv() {
    let csv = 'المؤشر,القيمة\n'
    csv = csv + 'الإيرادات (الفترة الحالية),' + scopedRevenue + '\n'
    csv = csv + 'اشتراكات فعالة,' + activeSubscriptions.length + '\n'
    csv = csv + 'الإيرادات المتكررة الشهرية (MRR),' + mrr.toFixed(2) + '\n'
    csv = csv + 'نسبة التسرب,' + churnRate.toFixed(1) + '%\n'
    csv = csv + 'إجمالي المستخدمين,' + (customerCount + lawyerCount + firmCount) + '\n'
    csv = csv + 'عملاء,' + customerCount + '\n'
    csv = csv + 'محامون,' + lawyerCount + '\n'
    csv = csv + 'مكاتب,' + firmCount + '\n'

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'تقرير-الإدارة.csv'
    link.click()
  }

  function renderLawyerCompedRow(lawyer: LawyerRow) {
    const key = 'lawyer-' + lawyer.id
    const isComped = lawyer.is_comped === true

    function clickToggle() { toggleLawyerComped(lawyer) }

    return (
      <div key={key} className="flex justify-between items-center py-3 border-b border-[#D8D2C4] last:border-0">
        <p className="font-['Tajawal'] text-sm text-[#1B1A17]">{lawyer.full_name}</p>
        <button onClick={clickToggle} disabled={compedUpdating === key} className={"px-4 py-2 rounded-md font-['Tajawal'] text-xs transition " + (isComped ? 'bg-[#2F4538] text-white' : 'bg-[#F3EEE4] text-[#4A473F] border border-[#D8D2C4]')}>
          {isComped ? 'حساب مجاني ✓' : 'منح حساب مجاني'}
        </button>
      </div>
    )
  }

  function renderFirmCompedRow(firm: FirmRow) {
    const key = 'firm-' + firm.id
    const isComped = firm.is_comped === true

    function clickToggle() { toggleFirmComped(firm) }

    return (
      <div key={key} className="flex justify-between items-center py-3 border-b border-[#D8D2C4] last:border-0">
        <p className="font-['Tajawal'] text-sm text-[#1B1A17]">{firm.firm_name}</p>
        <button onClick={clickToggle} disabled={compedUpdating === key} className={"px-4 py-2 rounded-md font-['Tajawal'] text-xs transition " + (isComped ? 'bg-[#2F4538] text-white' : 'bg-[#F3EEE4] text-[#4A473F] border border-[#D8D2C4]')}>
          {isComped ? 'حساب مجاني ✓' : 'منح حساب مجاني'}
        </button>
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

  if (!isAdmin) {
    return (
      <div dir="rtl" className="min-h-screen pattern-bg flex items-center justify-center px-6">
        <div className="text-center">
          <p className="font-['Tajawal'] text-[#4A473F]">غير مصرح لك بالوصول إلى هذه الصفحة</p>
        </div>
      </div>
    )
  }

  const filteredLawyersForSearch = allLawyers.filter(function (l) {
    if (!lawyerSearch.trim()) return true
    return l.full_name.toLowerCase().indexOf(lawyerSearch.toLowerCase()) !== -1
  })

  const filteredFirmsForSearch = allFirms.filter(function (f) {
    if (!firmSearch.trim()) return true
    return f.firm_name.toLowerCase().indexOf(firmSearch.toLowerCase()) !== -1
  })

  const discountSearchResults = getDiscountSearchResults()

  return (
    <div dir="rtl" className="min-h-screen pattern-bg">
      <div className="hm-header bg-[#1B1A17] text-[#F3EEE4] py-12 px-6">
        <HeaderLines />
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8 font-['Tajawal'] text-sm">
            <a href="/"><img src="/logo.png" alt="حمورابي" className="h-12 w-auto" /></a>
            <div className="flex gap-5 items-center">
              <a href="/ai-assistant" className="hover:text-[#AD8A4E] transition">مساعد ذكي</a>
              <button onClick={handleExportCsv} className="hover:text-[#AD8A4E] transition">تصدير CSV</button>
            </div>
          </div>
          <h1 className="font-['Tajawal'] font-bold text-4xl mb-2">لوحة تحكم المدير</h1>
          <div className="w-16 h-[2px] bg-[#AD8A4E]"></div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex justify-center mb-4">
          <div className="flex bg-white border border-[#D8D2C4] rounded-md p-1 w-fit">
            <button onClick={function () { setViewMode('monthly') }} className={"px-5 py-2 rounded font-['Tajawal'] text-sm font-medium transition " + (viewMode === 'monthly' ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'text-[#4A473F]')}>شهري</button>
            <button onClick={function () { setViewMode('daily') }} className={"px-5 py-2 rounded font-['Tajawal'] text-sm font-medium transition " + (viewMode === 'daily' ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'text-[#4A473F]')}>يومي</button>
          </div>
        </div>

        {viewMode === 'monthly' ? (
          <div className="flex items-center justify-center gap-4 mb-8 bg-white border border-[#D8D2C4] rounded-lg p-4 w-fit mx-auto">
            <button onClick={function () { changeMonth(-1) }} className="flex items-center gap-1 px-3 py-2 bg-[#F3EEE4] text-[#4A473F] rounded-md font-['Tajawal'] text-sm hover:bg-[#D8D2C4] transition">
              <span>→</span> السابق
            </button>
            <p className="font-['Tajawal'] font-bold text-[#1B1A17] w-32 text-center">{monthNames[selectedMonth]} {selectedYear}</p>
            <button onClick={function () { changeMonth(1) }} className="flex items-center gap-1 px-3 py-2 bg-[#F3EEE4] text-[#4A473F] rounded-md font-['Tajawal'] text-sm hover:bg-[#D8D2C4] transition">
              التالي <span>←</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-4 mb-8 bg-white border border-[#D8D2C4] rounded-lg p-4 w-fit mx-auto">
            <button onClick={function () { changeDay(-1) }} className="flex items-center gap-1 px-3 py-2 bg-[#F3EEE4] text-[#4A473F] rounded-md font-['Tajawal'] text-sm hover:bg-[#D8D2C4] transition">
              <span>→</span> السابق
            </button>
            <p className="font-['Tajawal'] font-bold text-[#1B1A17] w-40 text-center">{selectedDay.getDate()} {monthNames[selectedDay.getMonth()]} {selectedDay.getFullYear()}</p>
            <button onClick={function () { changeDay(1) }} className="flex items-center gap-1 px-3 py-2 bg-[#F3EEE4] text-[#4A473F] rounded-md font-['Tajawal'] text-sm hover:bg-[#D8D2C4] transition">
              التالي <span>←</span>
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <button onClick={function () { toggleMetric('revenue') }} className={"bg-white border rounded-lg p-5 text-center transition text-right " + (expandedMetric === 'revenue' ? 'border-[#AD8A4E] border-2' : 'border-[#D8D2C4]')}>
            <div className="flex justify-between items-start mb-2">
              <p className="font-['Tajawal'] text-xs text-[#4A473F]">{viewMode === 'monthly' ? 'الأرباح هذا الشهر' : 'الأرباح هذا اليوم'}</p>
              <span className="text-[#AD8A4E]">📈</span>
            </div>
            <p className="font-['Tajawal'] font-bold text-2xl text-[#1B1A17]">{scopedRevenue.toFixed(0)} د.أ</p>
          </button>

          <button onClick={function () { toggleMetric('subs') }} className={"bg-white border rounded-lg p-5 text-center transition text-right " + (expandedMetric === 'subs' ? 'border-[#AD8A4E] border-2' : 'border-[#D8D2C4]')}>
            <div className="flex justify-between items-start mb-2">
              <p className="font-['Tajawal'] text-xs text-[#4A473F]">اشتراكات فعّالة</p>
              <span className="text-[#AD8A4E]">📈</span>
            </div>
            <p className="font-['Tajawal'] font-bold text-2xl text-[#2F4538]">{activeSubscriptions.length}</p>
          </button>

          <button onClick={function () { toggleMetric('cancellations') }} className={"bg-white border rounded-lg p-5 text-center transition text-right " + (expandedMetric === 'cancellations' ? 'border-[#AD8A4E] border-2' : 'border-[#D8D2C4]')}>
            <div className="flex justify-between items-start mb-2">
              <p className="font-['Tajawal'] text-xs text-[#4A473F]">{viewMode === 'monthly' ? 'إلغاءات هذا الشهر' : 'إلغاءات هذا اليوم'}</p>
              <span className="text-[#AD8A4E]">📈</span>
            </div>
            <p className="font-['Tajawal'] font-bold text-2xl text-[#7A2E2E]">{cancelledScoped.length}</p>
          </button>

          <button onClick={function () { toggleMetric('users') }} className={"bg-white border rounded-lg p-5 text-center transition text-right " + (expandedMetric === 'users' ? 'border-[#AD8A4E] border-2' : 'border-[#D8D2C4]')}>
            <div className="flex justify-between items-start mb-2">
              <p className="font-['Tajawal'] text-xs text-[#4A473F]">إجمالي المستخدمين</p>
              <span className="text-[#AD8A4E]">📈</span>
            </div>
            <p className="font-['Tajawal'] font-bold text-2xl text-[#AD8A4E]">{customerCount + lawyerCount + firmCount}</p>
          </button>
        </div>

        <p className="font-['Tajawal'] text-xs text-[#4A473F] text-center mb-8">اضغط على أي بطاقة لعرض اتجاهها خلال آخر 12 شهراً</p>

        {expandedMetric === 'revenue' && renderTrendChart('الإيرادات', buildMonthlyRevenueTrend(trendOffset))}
        {expandedMetric === 'subs' && renderTrendChart('اشتراكات جديدة بدأت', buildMonthlyTrend(function (s: Subscription) { return s.started_at }, subscriptions.filter(function (s) { return s.status === 'active' }), trendOffset))}
        {expandedMetric === 'cancellations' && renderTrendChart('الإلغاءات', buildMonthlyTrend(function (s: Subscription) { return s.started_at }, subscriptions.filter(function (s) { return s.status === 'cancelled' }), trendOffset), 'ملاحظة: لا يوجد تاريخ إلغاء منفصل محفوظ حالياً، لذا يُستخدم تاريخ بدء الاشتراك كتقريب.')}
        {expandedMetric === 'users' && renderTrendChart('مستخدمون جدد', buildMonthlyTrend(function (item: { created_at: string | null }) { return item.created_at }, customerCreated.concat(lawyerCreated).concat(firmCreated), trendOffset))}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white border border-[#D8D2C4] rounded-lg p-5 text-center">
            <p className="font-['Tajawal'] text-xs text-[#4A473F] mb-2">الإيرادات المتكررة الشهرية</p>
            <p className="font-['Tajawal'] font-bold text-xl text-[#2F4538]">{mrr.toFixed(0)} د.أ</p>
          </div>
          <div className="bg-white border border-[#D8D2C4] rounded-lg p-5 text-center">
            <p className="font-['Tajawal'] text-xs text-[#4A473F] mb-2">نسبة التسرب</p>
            <p className="font-['Tajawal'] font-bold text-xl text-[#7A2E2E]">{churnRate.toFixed(1)}%</p>
          </div>
          <div className="bg-white border border-[#D8D2C4] rounded-lg p-5 text-center">
            <p className="font-['Tajawal'] text-xs text-[#4A473F] mb-2">عملاء</p>
            <p className="font-['Tajawal'] font-bold text-xl text-[#1B1A17]">{customerCount}</p>
          </div>
          <div className="bg-white border border-[#D8D2C4] rounded-lg p-5 text-center">
            <p className="font-['Tajawal'] text-xs text-[#4A473F] mb-2">محامون / مكاتب</p>
            <p className="font-['Tajawal'] font-bold text-xl text-[#1B1A17]">{lawyerCount} / {firmCount}</p>
          </div>
        </div>

        <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-8">
          <h2 className="font-['Tajawal'] font-bold text-base text-[#1B1A17] mb-3">{viewMode === 'monthly' ? 'الإيرادات اليومية' : 'الإيرادات بالساعة'}</h2>
          <div style={{ width: '100%', height: 180 }}>
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#D8D2C4" />
                <XAxis dataKey="label" fontSize={10} />
                <YAxis fontSize={10} />
                <Tooltip />
                <Bar dataKey="revenue" fill="#AD8A4E" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white border border-[#D8D2C4] rounded-lg p-6">
            <h3 className="font-['Tajawal'] font-bold text-sm text-[#1B1A17] mb-4">الطلب حسب الاختصاص</h3>
            {specialtyHeatmap.length === 0 && <p className="font-['Tajawal'] text-xs text-[#4A473F]">لا توجد بيانات بعد</p>}
            {specialtyHeatmap.map(function (entry) {
              return (
                <div key={entry[0]} className="flex justify-between font-['Tajawal'] text-sm mb-2">
                  <span className="text-[#1B1A17]">{entry[0]}</span>
                  <span className="text-[#AD8A4E] font-bold">{entry[1]}</span>
                </div>
              )
            })}
          </div>

          <div className="bg-white border border-[#D8D2C4] rounded-lg p-6">
            <h3 className="font-['Tajawal'] font-bold text-sm text-[#1B1A17] mb-4">التوزيع الجغرافي (محامون + مكاتب)</h3>
            {cityBreakdown.map(function (entry) {
              return (
                <div key={entry[0]} className="flex justify-between font-['Tajawal'] text-sm mb-2">
                  <span className="text-[#1B1A17]">{entry[0]}</span>
                  <span className="text-[#AD8A4E] font-bold">{entry[1]}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-white border-2 border-[#AD8A4E] rounded-lg p-6 mb-8">
          <h2 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mb-1">حسابات بانتظار المراجعة ({pendingLawyers.length + pendingFirms.length})</h2>
          <p className="font-['Tajawal'] text-xs text-[#4A473F] mb-4">عند الاعتماد تصل الحساب رسالة «تم تأكيد حسابك» برابط الاشتراك. الحسابات الجديدة التي لم تُكمل معلوماتها بعد تظهر بعلامة «ناقصة».</p>
          {pendingLawyers.length + pendingFirms.length === 0 && (
            <p className="font-['Tajawal'] text-sm text-[#4A473F]">لا توجد حسابات بانتظار المراجعة</p>
          )}
          {pendingLawyers.map(function (l) {
            const complete = !!l.bar_certificate_number && !!l.specialty_id && !!l.city
            const key = 'lawyer-' + l.id
            return (
              <div key={key} className="flex flex-wrap justify-between items-center gap-3 bg-[#F3EEE4] rounded-md p-4 mb-2">
                <div>
                  <p className="font-['Tajawal'] font-bold text-sm text-[#1B1A17]">
                    {l.full_name} <span className="font-normal text-xs text-[#AD8A4E]">— {l.is_trainee ? 'محامي متدرب' : 'محامي'}</span>
                    {l.needs_onboarding && !complete && <span className="mr-2 px-2 py-0.5 bg-[#F2DEDC] text-[#7A2E2E] text-[10px] rounded-full">ناقصة</span>}
                  </p>
                  <p className="font-['Tajawal'] text-xs text-[#4A473F]">
                    {[l.bar_certificate_number ? 'الرقم النقابي: ' + l.bar_certificate_number : '', l.city, l.phone, l.email].filter(Boolean).join(' — ')}
                  </p>
                </div>
                <button onClick={function () { handleApprove('lawyer', l.id) }} disabled={approvingKey === key} className="px-4 py-2 bg-[#2F4538] text-white rounded-md font-['Tajawal'] text-xs disabled:opacity-60">
                  {approvingKey === key ? 'جاري الاعتماد...' : 'اعتماد'}
                </button>
              </div>
            )
          })}
          {pendingFirms.map(function (f) {
            const complete = !!f.city && !!f.address && !!f.phone
            const key = 'firm-' + f.id
            return (
              <div key={key} className="flex flex-wrap justify-between items-center gap-3 bg-[#F3EEE4] rounded-md p-4 mb-2">
                <div>
                  <p className="font-['Tajawal'] font-bold text-sm text-[#1B1A17]">
                    {f.firm_name} <span className="font-normal text-xs text-[#AD8A4E]">— مكتب محاماة</span>
                    {f.needs_onboarding && !complete && <span className="mr-2 px-2 py-0.5 bg-[#F2DEDC] text-[#7A2E2E] text-[10px] rounded-full">ناقصة</span>}
                  </p>
                  <p className="font-['Tajawal'] text-xs text-[#4A473F]">{[f.city, f.address, f.phone, f.email].filter(Boolean).join(' — ')}</p>
                </div>
                <button onClick={function () { handleApprove('firm', f.id) }} disabled={approvingKey === key} className="px-4 py-2 bg-[#2F4538] text-white rounded-md font-['Tajawal'] text-xs disabled:opacity-60">
                  {approvingKey === key ? 'جاري الاعتماد...' : 'اعتماد'}
                </button>
              </div>
            )
          })}
        </div>

        <div className="bg-white border-2 border-[#AD8A4E] rounded-lg p-6 mb-8">
          <h2 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mb-4">خصومات المحامين والمكاتب</h2>

          {!discountSelected && (
            <div>
              <input type="text" value={discountSearch} onChange={function (e) { setDiscountSearch(e.target.value) }} placeholder="ابحث باسم محامي أو مكتب..." className="w-full px-3 py-2 mb-3 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
              {discountSearchResults.map(function (r) {
                function selectClick() { selectDiscountAccount(r) }
                return (
                  <button key={r.type + '-' + r.id} onClick={selectClick} className="block w-full text-right px-3 py-2 bg-[#F3EEE4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17] mb-1">
                    {r.name} <span className="text-xs text-[#4A473F]">({r.type === 'lawyer' ? 'محامي' : 'مكتب'})</span>
                  </button>
                )
              })}
            </div>
          )}

          {discountSelected && (
            <div className="bg-[#F3EEE4] rounded-md p-4">
              <p className="font-['Tajawal'] font-bold text-sm text-[#1B1A17] mb-3">{discountSelected.name}</p>
              <div className="flex gap-2 mb-3">
                <button onClick={function () { setDiscountType('percentage') }} className={"flex-1 py-2 rounded-md font-['Tajawal'] text-xs " + (discountType === 'percentage' ? 'bg-[#1B1A17] text-white' : 'bg-white text-[#4A473F] border border-[#D8D2C4]')}>نسبة مئوية</button>
                <button onClick={function () { setDiscountType('fixed_final_amount') }} className={"flex-1 py-2 rounded-md font-['Tajawal'] text-xs " + (discountType === 'fixed_final_amount' ? 'bg-[#1B1A17] text-white' : 'bg-white text-[#4A473F] border border-[#D8D2C4]')}>مبلغ نهائي ثابت</button>
              </div>
              {discountType === 'fixed_final_amount' && (
                <p className="font-['Tajawal'] text-xs text-[#4A473F] mb-2">السعر الشهري الذي يدفعه. السنوي = 9 أشهر منه، والخمس سنوات = 15 شهراً، كما في قائمة الأسعار.</p>
              )}
              <input type="number" value={discountValue} onChange={function (e) { setDiscountValue(e.target.value) }} placeholder={discountType === 'percentage' ? 'نسبة الخصم %' : 'السعر الشهري النهائي (د.أ)'} className="w-full px-3 py-2 mb-3 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
              <div className="flex gap-2">
                <button onClick={function () { setDiscountSelected(null) }} className="flex-1 py-2 bg-white text-[#4A473F] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-xs">إلغاء</button>
                <button onClick={handleSaveDiscount} disabled={savingDiscount} className="flex-1 py-2 bg-[#1B1A17] text-white rounded-md font-['Tajawal'] text-xs">حفظ</button>
              </div>
            </div>
          )}

          {discounts.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[#D8D2C4]">
              <p className="font-['Tajawal'] text-xs text-[#4A473F] mb-2">الخصومات الحالية:</p>
              {discounts.map(function (d) {
                function removeClick() { handleRemoveDiscount(d.id) }
                return (
                  <div key={d.id} className="flex justify-between items-center py-2 border-b border-[#D8D2C4] last:border-0">
                    <p className="font-['Tajawal'] text-sm text-[#1B1A17]">{getAccountNameForDiscount(d)} — {d.discount_type === 'percentage' ? d.discount_value + '%' : d.discount_value + ' د.أ شهرياً'}</p>
                    <button onClick={removeClick} className="font-['Tajawal'] text-xs text-[#7A2E2E]">حذف</button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-8">
          <h2 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mb-4">إرسال إشعار جماعي</h2>
          <select value={broadcastTarget} onChange={function (e) { setBroadcastTarget(e.target.value) }} className="w-full px-3 py-2 mb-3 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]">
            <option value="all">جميع المحامين والمكاتب</option>
            <option value="lawyers">المحامون فقط</option>
            <option value="firms">المكاتب فقط</option>
          </select>
          <input type="text" value={broadcastSubject} onChange={function (e) { setBroadcastSubject(e.target.value) }} placeholder="عنوان الرسالة" className="w-full px-3 py-2 mb-3 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
          <textarea value={broadcastMessage} onChange={function (e) { setBroadcastMessage(e.target.value) }} rows={4} placeholder="نص الرسالة" className="w-full px-3 py-2 mb-3 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
          <button onClick={handleSendBroadcast} disabled={sendingBroadcast} className="w-full py-3 bg-[#1B1A17] text-white rounded-md font-['Tajawal'] font-medium">
            {sendingBroadcast ? 'جاري الإرسال...' : 'إرسال'}
          </button>
          {broadcastResult && <p className="font-['Tajawal'] text-sm text-[#2F4538] mt-2 text-center">{broadcastResult}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-[#D8D2C4] rounded-lg p-6">
            <h2 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mb-4">حسابات مجانية - محامون</h2>
            <input type="text" value={lawyerSearch} onChange={function (e) { setLawyerSearch(e.target.value) }} placeholder="ابحث عن اسم محامي..." className="w-full px-3 py-2 mb-4 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
            <div className="max-h-96 overflow-y-auto">
              {filteredLawyersForSearch.map(renderLawyerCompedRow)}
            </div>
          </div>

          <div className="bg-white border border-[#D8D2C4] rounded-lg p-6">
            <h2 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mb-4">حسابات مجانية - مكاتب</h2>
            <input type="text" value={firmSearch} onChange={function (e) { setFirmSearch(e.target.value) }} placeholder="ابحث عن اسم مكتب..." className="w-full px-3 py-2 mb-4 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
            <div className="max-h-96 overflow-y-auto">
              {filteredFirmsForSearch.map(renderFirmCompedRow)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}