'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'
import { getLawyerBadgeCount, getFirmBadgeCount } from '../lib/badges'
import Footer from '../components/Footer'
import WorkspaceSwitch from '../components/WorkspaceSwitch'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

type Invoice = {
  id: number
  lawyer_id: number
  client_name: string
  client_phone: string | null
  amount: number
  status: string
  due_date: string | null
  created_at: string
  paid_at: string | null
}

type Expense = {
  id: number
  lawyer_id: number
  category: string
  amount: number
  expense_date: string
  notes: string | null
  is_recurring: boolean | null
  recurring_source_id: number | null
  is_skipped: boolean | null
}

type RosterLawyer = {
  id: number
  full_name: string
}

const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
const expenseCategories = ['إيجار', 'رواتب', 'اشتراكات', 'رسوم محكمة', 'مواصلات', 'أخرى']

function formatDateDisplay(dateStr: string | null) {
  if (!dateStr) return '-'
  const parts = dateStr.split('-')
  if (parts.length !== 3) return dateStr
  return parts[2] + '/' + parts[1] + '/' + parts[0]
}

export default function LawyerInvoicesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [accountType, setAccountType] = useState<'lawyer' | 'firm'>('lawyer')
  const [accountId, setAccountId] = useState<number | null>(null)
  const [lawyerFullName, setLawyerFullName] = useState('')
  const [notAllowed, setNotAllowed] = useState(false)
  const [notSubscribed, setNotSubscribed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [totalUnread, setTotalUnread] = useState(0)
  const [pendingConsultations, setPendingConsultations] = useState(0)
  const [allInvoices, setInvoices] = useState<Invoice[]>([])
  const [allExpenses, setExpenses] = useState<Expense[]>([])
  const [roster, setRoster] = useState<RosterLawyer[]>([])
  const [filter, setFilter] = useState('all')
  const [savingsGoalPercent, setSavingsGoalPercent] = useState('')
  const [savingGoal, setSavingGoal] = useState(false)
  const [actionError, setActionError] = useState('')

  const [viewMode, setViewMode] = useState('monthly')
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedDay, setSelectedDay] = useState(new Date())

  const [indicatorScope, setIndicatorScope] = useState('all')
  const [indicatorYear, setIndicatorYear] = useState(new Date().getFullYear())
  const [indicatorMonth, setIndicatorMonth] = useState(new Date().getMonth())

  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDay, setDueDay] = useState('')
  const [dueMonth, setDueMonth] = useState('')
  const [dueYear, setDueYear] = useState('')
  const [savingInvoice, setSavingInvoice] = useState(false)

  const [expCategory, setExpCategory] = useState(expenseCategories[0])
  const [expAmount, setExpAmount] = useState('')
  const [expDay, setExpDay] = useState('')
  const [expMonth, setExpMonth] = useState('')
  const [expYear, setExpYear] = useState('')
  const [expNotes, setExpNotes] = useState('')
  const [expRecurring, setExpRecurring] = useState(false)
  const [savingExpense, setSavingExpense] = useState(false)

  const supabase = createClient()
  const menuRef = useRef<HTMLDivElement>(null)
  const lawyerId = accountType === 'lawyer' ? accountId : null

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

  async function generateRecurringExpenses(id: number, rows: Expense[]) {
    const existingKeys: { [key: string]: boolean } = {}
    rows.forEach(function (e) {
      if (e.recurring_source_id) {
        existingKeys[e.recurring_source_id + '|' + e.expense_date] = true
      }
    })

    const nowDate = new Date()
    const todayStr = nowDate.getFullYear() + '-' + String(nowDate.getMonth() + 1).padStart(2, '0') + '-' + String(nowDate.getDate()).padStart(2, '0')
    const nowIndex = nowDate.getFullYear() * 12 + nowDate.getMonth()
    const toInsert: any[] = []

    rows.forEach(function (t) {
      if (!t.is_recurring || t.recurring_source_id) return

      const parts = t.expense_date.split('-')
      const startIndex = Number(parts[0]) * 12 + (Number(parts[1]) - 1) + 1
      const dayOfMonth = Number(parts[2])
      const fromIndex = Math.max(startIndex, nowIndex - 35)

      for (let idx = fromIndex; idx <= nowIndex; idx++) {
        const y = Math.floor(idx / 12)
        const m = idx % 12
        const daysInThatMonth = new Date(y, m + 1, 0).getDate()
        const dd = Math.min(dayOfMonth, daysInThatMonth)
        const dateStr = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(dd).padStart(2, '0')

        if (dateStr > todayStr) continue
        if (existingKeys[t.id + '|' + dateStr]) continue

        toInsert.push({
          lawyer_id: id,
          category: t.category,
          amount: Number(t.amount),
          expense_date: dateStr,
          notes: t.notes,
          is_recurring: false,
          recurring_source_id: t.id,
        })
      }
    })

    if (toInsert.length === 0) return false

    await supabase.from('expenses').upsert(toInsert, { onConflict: 'recurring_source_id,expense_date', ignoreDuplicates: true })
    return true
  }

  async function loadAll(type: 'lawyer' | 'firm', id: number, rosterIds: number[]) {
    if (type === 'firm') {
      if (rosterIds.length === 0) {
        setInvoices([])
        setExpenses([])
        return
      }
      const firmInvoicesResult = await supabase.from('invoices').select('*').in('lawyer_id', rosterIds).order('created_at', { ascending: false })
      setInvoices(firmInvoicesResult.data || [])

      const firmExpensesResult = await supabase.from('expenses').select('*').in('lawyer_id', rosterIds).order('expense_date', { ascending: false })
      const firmExpenseRows: Expense[] = firmExpensesResult.data || []
      setExpenses(firmExpenseRows.filter(function (e) { return !e.is_skipped }))
      return
    }

    const invoicesResult = await supabase.from('invoices').select('*').eq('lawyer_id', id).order('created_at', { ascending: false })
    setInvoices(invoicesResult.data || [])

    const expensesResult = await supabase.from('expenses').select('*').eq('lawyer_id', id).order('expense_date', { ascending: false })
    let expenseRows: Expense[] = expensesResult.data || []

    const addedAny = await generateRecurringExpenses(id, expenseRows)
    if (addedAny) {
      const refreshedResult = await supabase.from('expenses').select('*').eq('lawyer_id', id).order('expense_date', { ascending: false })
      expenseRows = refreshedResult.data || []
    }

    setExpenses(expenseRows.filter(function (e) { return !e.is_skipped }))
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

      const lawyerResult = await supabase.from('lawyers').select('id, full_name, is_active, is_comped, savings_goal_percent').eq('user_id', userId).maybeSingle()

      if (lawyerResult.data) {
        if (!lawyerResult.data.is_active && !lawyerResult.data.is_comped) {
          setNotSubscribed(true)
          setLoading(false)
          return
        }

        setAccountType('lawyer')
        setAccountId(lawyerResult.data.id)
        setLawyerFullName(lawyerResult.data.full_name || '')
        setSavingsGoalPercent(lawyerResult.data.savings_goal_percent ? String(lawyerResult.data.savings_goal_percent) : '')

        const unreadResult = await supabase.from('lawyer_messages').select('sender_lawyer_id, sender_firm_id').eq('recipient_lawyer_id', lawyerResult.data.id).eq('is_read', false)
        setTotalUnread(countConversations(unreadResult.data || []))

        setPendingConsultations(await getLawyerBadgeCount(supabase, lawyerResult.data.id))

        await loadAll('lawyer', lawyerResult.data.id, [])
        setLoading(false)
        return
      }

      const firmResult = await supabase.from('firms').select('*').eq('user_id', userId).maybeSingle()

      if (!firmResult.data) {
        setNotAllowed(true)
        setLoading(false)
        return
      }

      const firmRow: any = firmResult.data

      if (!firmRow.is_active && !firmRow.is_comped) {
        setNotSubscribed(true)
        setLoading(false)
        return
      }

      setAccountType('firm')
      setAccountId(firmRow.id)

      const rosterResult = await supabase.from('lawyers').select('id, full_name').eq('firm_id', firmRow.id)
      const rosterRows: RosterLawyer[] = rosterResult.data || []
      setRoster(rosterRows)
      const rosterIds = rosterRows.map(function (l) { return l.id })

      const firmUnreadResult = await supabase.from('lawyer_messages').select('sender_lawyer_id, sender_firm_id').eq('recipient_firm_id', firmRow.id).eq('is_read', false)
      setTotalUnread(countConversations(firmUnreadResult.data || []))

      setPendingConsultations(await getFirmBadgeCount(supabase, firmRow.id))

      await loadAll('firm', firmRow.id, rosterIds)
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

  async function handleSaveSavingsGoal() {
    if (!lawyerId) return
    setSavingGoal(true)
    await supabase.from('lawyers').update({ savings_goal_percent: savingsGoalPercent ? Number(savingsGoalPercent) : null }).eq('id', lawyerId)
    setSavingGoal(false)
  }

  async function handleAddInvoice() {
    if (!clientName.trim() || !amount || !lawyerId) return
    setSavingInvoice(true)

    const dueDateStr = (dueDay && dueMonth && dueYear) ? dueYear + '-' + dueMonth.padStart(2, '0') + '-' + dueDay.padStart(2, '0') : null

    await supabase.from('invoices').insert({
      lawyer_id: lawyerId,
      client_name: clientName,
      client_phone: clientPhone,
      amount: Number(amount),
      status: 'unpaid',
      due_date: dueDateStr,
    })

    setClientName('')
    setClientPhone('')
    setAmount('')
    setDueDay('')
    setDueMonth('')
    setDueYear('')
    await loadAll('lawyer', lawyerId, [])
    setSavingInvoice(false)
  }

  async function handleMarkPaid(invoiceId: number) {
    if (!lawyerId) return
    await supabase.from('invoices').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', invoiceId)
    await loadAll('lawyer', lawyerId, [])
  }

  async function handleMarkUnpaid(invoiceId: number) {
    if (!lawyerId) return
    await supabase.from('invoices').update({ status: 'unpaid', paid_at: null }).eq('id', invoiceId)
    await loadAll('lawyer', lawyerId, [])
  }

  async function handleAddExpense() {
    if (!expAmount || !expDay || !expMonth || !expYear || !lawyerId) return
    setSavingExpense(true)

    const expenseDateStr = expYear + '-' + expMonth.padStart(2, '0') + '-' + expDay.padStart(2, '0')

    await supabase.from('expenses').insert({
      lawyer_id: lawyerId,
      category: expCategory,
      amount: Number(expAmount),
      expense_date: expenseDateStr,
      notes: expNotes,
      is_recurring: expRecurring,
    })

    setExpAmount('')
    setExpDay('')
    setExpMonth('')
    setExpYear('')
    setExpNotes('')
    setExpRecurring(false)
    await loadAll('lawyer', lawyerId, [])
    setSavingExpense(false)
  }

  async function handleDeleteExpense(e: Expense) {
    if (!lawyerId) return
    setActionError('')

    if (e.recurring_source_id) {
      const skipResult = await supabase.from('expenses').update({ is_skipped: true }).eq('id', e.id).select('id')
      if (skipResult.error || !skipResult.data || skipResult.data.length === 0) {
        setActionError('تعذر حذف المصروف، حاول مرة أخرى')
        return
      }
    } else {
      await supabase.from('expenses').delete().eq('id', e.id)
    }

    await loadAll('lawyer', lawyerId, [])
  }

  async function handleStopRecurring(id: number) {
    if (!lawyerId) return
    setActionError('')

    const stopResult = await supabase.from('expenses').update({ is_recurring: false }).eq('id', id).select('id')
    if (stopResult.error || !stopResult.data || stopResult.data.length === 0) {
      setActionError('تعذر إيقاف التكرار، حاول مرة أخرى')
      return
    }

    await loadAll('lawyer', lawyerId, [])
  }

  function getLawyerName(id: number) {
    const found = roster.find(function (l) { return l.id === id })
    return found ? found.full_name : ''
  }

  const invoices = (accountType === 'firm' && filter !== 'all')
    ? allInvoices.filter(function (inv) { return inv.lawyer_id === Number(filter) })
    : allInvoices

  const expenses = (accountType === 'firm' && filter !== 'all')
    ? allExpenses.filter(function (e) { return e.lawyer_id === Number(filter) })
    : allExpenses

  function isInSelectedMonth(dateStr: string) {
    const d = new Date(dateStr)
    return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear
  }

  function isInSelectedDay(dateStr: string) {
    const d = new Date(dateStr)
    return d.getFullYear() === selectedDay.getFullYear() && d.getMonth() === selectedDay.getMonth() && d.getDate() === selectedDay.getDate()
  }

  const paidInvoices = invoices.filter(function (inv) { return inv.status === 'paid' && inv.paid_at })

  const scopedPaidInvoices = viewMode === 'monthly'
    ? paidInvoices.filter(function (inv) { return isInSelectedMonth(inv.paid_at as string) })
    : paidInvoices.filter(function (inv) { return isInSelectedDay(inv.paid_at as string) })

  const scopedExpenses = viewMode === 'monthly'
    ? expenses.filter(function (e) { return isInSelectedMonth(e.expense_date) })
    : expenses.filter(function (e) { return isInSelectedDay(e.expense_date) })

  let periodRevenue = 0
  scopedPaidInvoices.forEach(function (inv) { periodRevenue = periodRevenue + Number(inv.amount) })

  let periodExpenses = 0
  scopedExpenses.forEach(function (e) { periodExpenses = periodExpenses + Number(e.amount) })

  const netProfit = periodRevenue - periodExpenses
  const profitMargin = periodRevenue > 0 ? (netProfit / periodRevenue) * 100 : 0

  let monthRevenue = 0
  paidInvoices.forEach(function (inv) {
    if (isInSelectedMonth(inv.paid_at as string)) monthRevenue = monthRevenue + Number(inv.amount)
  })

  let monthExpenses = 0
  expenses.forEach(function (e) {
    if (isInSelectedMonth(e.expense_date)) monthExpenses = monthExpenses + Number(e.amount)
  })

  const monthNet = monthRevenue - monthExpenses
  const savingsPct = Math.min(Math.max(Number(savingsGoalPercent) || 0, 0), 100)
  const monthSavings = monthNet > 0 ? (monthNet * savingsPct) / 100 : 0
  const daysInSelectedMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate()
  const dailySavings = monthSavings / daysInSelectedMonth

  const now = new Date()
  const today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0')

  const overdueInvoices = invoices.filter(function (inv) { return inv.status !== 'paid' && inv.due_date && inv.due_date <= today })

  let totalPaidAll = 0
  paidInvoices.forEach(function (inv) { totalPaidAll = totalPaidAll + Number(inv.amount) })

  function getTopClients() {
    const totals: { [key: string]: number } = {}
    paidInvoices.forEach(function (inv) {
      totals[inv.client_name] = (totals[inv.client_name] || 0) + Number(inv.amount)
    })
    return Object.entries(totals).sort(function (a, b) { return b[1] - a[1] }).slice(0, 5)
  }
  const topClients = getTopClients()

  function sumPaidWhere(test: (d: Date) => boolean) {
    let total = 0
    paidInvoices.forEach(function (inv) {
      if (test(new Date(inv.paid_at as string))) total = total + Number(inv.amount)
    })
    return total
  }

  function revenueForYear(year: number) {
    return sumPaidWhere(function (d) { return d.getFullYear() === year })
  }

  function revenueForMonth(year: number, month: number) {
    return sumPaidWhere(function (d) { return d.getFullYear() === year && d.getMonth() === month })
  }

  function inIndicatorScope(dateValue: string) {
    const d = new Date(dateValue)
    if (indicatorScope === 'all') return true
    if (indicatorScope === 'year') return d.getFullYear() === indicatorYear
    return d.getFullYear() === indicatorYear && d.getMonth() === indicatorMonth
  }

  const scopedInvoices = invoices.filter(function (inv) { return inIndicatorScope(inv.created_at) })

  let scopedInvoicedTotal = 0
  let scopedPaidTotal = 0
  let scopedUnpaidTotal = 0
  let scopedOverdueTotal = 0
  let daysSum = 0
  let daysCount = 0

  scopedInvoices.forEach(function (inv) {
    const amt = Number(inv.amount)
    scopedInvoicedTotal = scopedInvoicedTotal + amt
    if (inv.status === 'paid') {
      scopedPaidTotal = scopedPaidTotal + amt
      if (inv.paid_at) {
        daysSum = daysSum + (new Date(inv.paid_at).getTime() - new Date(inv.created_at).getTime()) / (1000 * 60 * 60 * 24)
        daysCount = daysCount + 1
      }
    } else {
      scopedUnpaidTotal = scopedUnpaidTotal + amt
      if (inv.due_date && inv.due_date <= today) scopedOverdueTotal = scopedOverdueTotal + amt
    }
  })

  const collectionRate = scopedInvoicedTotal > 0 ? (scopedPaidTotal / scopedInvoicedTotal) * 100 : null
  const avgInvoiceValue = scopedInvoices.length > 0 ? scopedInvoicedTotal / scopedInvoices.length : null
  const avgPaymentDays = daysCount > 0 ? Math.round(daysSum / daysCount) : null

  const prevMonthIndex = indicatorMonth === 0 ? 11 : indicatorMonth - 1
  const prevMonthYear = indicatorMonth === 0 ? indicatorYear - 1 : indicatorYear

  let scopeRevenue = totalPaidAll
  let previousScopeRevenue = 0
  if (indicatorScope === 'year') {
    scopeRevenue = revenueForYear(indicatorYear)
    previousScopeRevenue = revenueForYear(indicatorYear - 1)
  }
  if (indicatorScope === 'month') {
    scopeRevenue = revenueForMonth(indicatorYear, indicatorMonth)
    previousScopeRevenue = revenueForMonth(prevMonthYear, prevMonthIndex)
  }

  const scopeChange = previousScopeRevenue > 0 ? ((scopeRevenue - previousScopeRevenue) / previousScopeRevenue) * 100 : null
  const sameMonthLastYearRevenue = revenueForMonth(indicatorYear - 1, indicatorMonth)
  const sameMonthChange = sameMonthLastYearRevenue > 0 ? ((scopeRevenue - sameMonthLastYearRevenue) / sameMonthLastYearRevenue) * 100 : null

  let monthsCounted = 1
  if (indicatorScope === 'year') {
    monthsCounted = indicatorYear === now.getFullYear() ? now.getMonth() + 1 : 12
  }
  if (indicatorScope === 'all') {
    let firstTime = Infinity
    for (let i = 0; i < paidInvoices.length; i++) {
      const t = new Date(paidInvoices[i].paid_at as string).getTime()
      if (t < firstTime) firstTime = t
    }
    if (firstTime !== Infinity) {
      const firstDate = new Date(firstTime)
      monthsCounted = Math.max(1, (now.getFullYear() - firstDate.getFullYear()) * 12 + (now.getMonth() - firstDate.getMonth()) + 1)
    }
  }
  const monthlyAverage = scopeRevenue / monthsCounted
  const scopeHint = indicatorScope === 'all' ? 'في كل الفترات' : 'في الفترة المحددة'

  function formatChange(pct: number | null) {
    if (pct === null) return 'لا توجد بيانات للمقارنة'
    return (pct >= 0 ? '▲ ' : '▼ ') + Math.abs(pct).toFixed(0) + '%'
  }

  function changeColor(pct: number | null) {
    if (pct === null) return 'text-[#4A473F]'
    return pct >= 0 ? 'text-[#2F4538]' : 'text-[#7A2E2E]'
  }

  function changeIndicatorYear(direction: number) {
    setIndicatorYear(indicatorYear + direction)
  }

  function changeIndicatorMonth(direction: number) {
    let newMonth = indicatorMonth + direction
    let newYear = indicatorYear
    if (newMonth < 0) { newMonth = 11; newYear = newYear - 1 }
    if (newMonth > 11) { newMonth = 0; newYear = newYear + 1 }
    setIndicatorMonth(newMonth)
    setIndicatorYear(newYear)
  }

  function buildDailyRevenueData() {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate()
    const data = []
    for (let day = 1; day <= daysInMonth; day++) {
      let dayTotal = 0
      scopedPaidInvoices.forEach(function (inv) {
        const d = new Date(inv.paid_at as string)
        if (d.getDate() === day) dayTotal = dayTotal + Number(inv.amount)
      })
      data.push({ label: String(day), revenue: dayTotal })
    }
    return data
  }

  function buildHourlyRevenueData() {
    const data = []
    for (let hour = 0; hour < 24; hour++) {
      let hourTotal = 0
      scopedPaidInvoices.forEach(function (inv) {
        const d = new Date(inv.paid_at as string)
        if (d.getHours() === hour) hourTotal = hourTotal + Number(inv.amount)
      })
      data.push({ label: hour + ':00', revenue: hourTotal })
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
    setSelectedMonth(newDay.getMonth())
    setSelectedYear(newDay.getFullYear())
  }

  function handleExportCsv() {
    let csv = 'النوع,الوصف/العميل,المبلغ,التاريخ,الحالة\n'
    scopedPaidInvoices.forEach(function (inv) {
      const ownerSuffix = accountType === 'firm' ? ' - ' + getLawyerName(inv.lawyer_id) : ''
      csv = csv + 'إيراد,' + inv.client_name + ownerSuffix + ',' + inv.amount + ',' + (inv.paid_at || '') + ',مدفوعة\n'
    })
    scopedExpenses.forEach(function (e) {
      const ownerSuffix = accountType === 'firm' ? ' - ' + getLawyerName(e.lawyer_id) : ''
      csv = csv + 'مصروف,' + e.category + ownerSuffix + ',' + e.amount + ',' + e.expense_date + ',-\n'
    })

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'التقرير-المالي.csv'
    link.click()
  }

  function renderIndicator(label: string, value: string, hint: string, valueClass?: string) {
    return (
      <div className="bg-[#F3EEE4] rounded-md p-4">
        <p className="font-['Tajawal'] text-xs text-[#4A473F] mb-1">{label}</p>
        <p className={"font-['Tajawal'] font-bold text-lg mb-1 " + (valueClass || 'text-[#1B1A17]')}>{value}</p>
        <p className="font-['Tajawal'] text-xs text-[#4A473F] leading-relaxed">{hint}</p>
      </div>
    )
  }

  function renderSavingsRow(label: string, value: string, bold?: boolean) {
    return (
      <div className="flex justify-between items-center py-2 border-b border-[#D8D2C4] last:border-b-0">
        <p className="font-['Tajawal'] text-sm text-[#4A473F]">{label}</p>
        <p className={"font-['Tajawal'] text-sm text-[#1B1A17] " + (bold ? 'font-bold' : 'font-medium')}>{value}</p>
      </div>
    )
  }

  function renderInvoice(invoice: Invoice) {
    const isOverdue = invoice.status !== 'paid' && invoice.due_date && invoice.due_date < today

    function paidClick() { handleMarkPaid(invoice.id) }
    function unpaidClick() { handleMarkUnpaid(invoice.id) }

    return (
      <div key={invoice.id} className={"border rounded-lg p-4 mb-3 " + (isOverdue ? 'bg-[#F8EAEA] border-[#7A2E2E]' : 'bg-white border-[#D8D2C4]')}>
        <div className="flex justify-between items-start mb-2">
          <p className="font-['Tajawal'] font-bold text-[#1B1A17]">{invoice.client_name}</p>
          <span className={"px-3 py-1 rounded-full text-xs font-['Tajawal'] " + (invoice.status === 'paid' ? 'bg-[#2F4538] text-white' : 'bg-[#7A2E2E] text-white')}>
            {invoice.status === 'paid' ? 'مدفوعة' : isOverdue ? 'متأخرة' : 'غير مدفوعة'}
          </span>
        </div>
        {accountType === 'firm' && (
          <p className="font-['Tajawal'] text-xs text-[#AD8A4E] mb-1">المحامي: {getLawyerName(invoice.lawyer_id)}</p>
        )}
        <p className="font-['Tajawal'] text-sm text-[#4A473F] mb-1">المبلغ: {invoice.amount} د.أ</p>
        {invoice.due_date && <p className="font-['Tajawal'] text-xs text-[#4A473F] mb-3">تاريخ الاستحقاق: {formatDateDisplay(invoice.due_date)}</p>}
        {accountType === 'lawyer' && invoice.status !== 'paid' && (
          <button onClick={paidClick} className="px-3 py-2 bg-[#2F4538] text-white rounded-md font-['Tajawal'] text-xs">تحديد كمدفوعة</button>
        )}
        {accountType === 'lawyer' && invoice.status === 'paid' && (
          <button onClick={unpaidClick} className="px-3 py-2 bg-[#F3EEE4] text-[#4A473F] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-xs">إلغاء الدفع</button>
        )}
      </div>
    )
  }

  function renderExpense(e: Expense) {
    function deleteClick() { handleDeleteExpense(e) }
    function stopClick() { handleStopRecurring(e.id) }
    const isTemplate = e.is_recurring && !e.recurring_source_id
    const isAuto = !!e.recurring_source_id

    return (
      <div key={e.id} className="flex justify-between items-center bg-white border border-[#D8D2C4] rounded-lg p-4 mb-2">
        <div>
          <p className="font-['Tajawal'] font-bold text-sm text-[#1B1A17]">
            {e.category}
            {isTemplate && <span className="text-xs text-[#AD8A4E]"> (متكرر شهرياً)</span>}
            {isAuto && <span className="text-xs text-[#4A473F]"> (أضيف تلقائياً)</span>}
          </p>
          {accountType === 'firm' && (
            <p className="font-['Tajawal'] text-xs text-[#AD8A4E]">المحامي: {getLawyerName(e.lawyer_id)}</p>
          )}
          <p className="font-['Tajawal'] text-xs text-[#4A473F]">{e.amount} د.أ — {formatDateDisplay(e.expense_date)}</p>
          {e.notes && <p className="font-['Tajawal'] text-xs text-[#4A473F]">{e.notes}</p>}
        </div>
        {accountType === 'lawyer' && (
          <div className="flex flex-col items-end gap-2">
            {isTemplate && (
              <button onClick={stopClick} className="font-['Tajawal'] text-xs text-[#AD8A4E]">إيقاف التكرار</button>
            )}
            <button onClick={deleteClick} className="font-['Tajawal'] text-xs text-[#7A2E2E]">حذف</button>
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
            <h1 className="font-['Tajawal'] font-bold text-2xl text-[#1B1A17] mb-3">يلزم الاشتراك للوصول إلى الفواتير</h1>
            <a href="/subscription" className="inline-block mt-4 px-6 py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal']">عرض خطط الاشتراك</a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div dir="rtl" className="min-h-screen pattern-bg flex flex-col">
      <div className="bg-[#1B1A17] text-[#F3EEE4] py-12 px-6">
        <div className="max-w-2xl mx-auto">
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
          <h1 className="font-['Tajawal'] font-bold text-4xl mb-2">الفواتير والمالية</h1>
          <p className="font-['Tajawal'] text-sm text-[#D8D2C4]">تابع دخلك ومصاريفك وأرباحك الحقيقية بشكل واضح</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10 flex-1 w-full">
        {accountType === 'lawyer' && <WorkspaceSwitch />}

        {accountType === 'firm' && (
          <div className="bg-white border border-[#D8D2C4] rounded-lg p-4 mb-6">
            <select
              value={filter}
              onChange={function (e) { setFilter(e.target.value) }}
              className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
            >
              <option value="all">جميع المحامين</option>
              {roster.map(function (l) {
                return <option key={l.id} value={String(l.id)}>{l.full_name}</option>
              })}
            </select>
          </div>
        )}

        <div className="flex justify-center mb-4">
          <div className="flex bg-white border border-[#D8D2C4] rounded-md p-1 w-fit">
            <button onClick={function () { setViewMode('monthly') }} className={"px-5 py-2 rounded font-['Tajawal'] text-sm font-medium transition " + (viewMode === 'monthly' ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'text-[#4A473F]')}>شهري</button>
            <button onClick={function () { setViewMode('daily') }} className={"px-5 py-2 rounded font-['Tajawal'] text-sm font-medium transition " + (viewMode === 'daily' ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'text-[#4A473F]')}>يومي</button>
          </div>
        </div>

        {viewMode === 'monthly' ? (
          <div className="flex items-center justify-center gap-4 mb-6 bg-white border border-[#D8D2C4] rounded-lg p-3 w-fit mx-auto">
            <button onClick={function () { changeMonth(-1) }} className="px-3 py-2 bg-[#F3EEE4] text-[#1B1A17] hover:bg-[#D8D2C4] transition rounded-md font-['Tajawal'] text-sm">السابق</button>
            <p className="font-['Tajawal'] font-bold text-[#1B1A17] w-28 text-center">{monthNames[selectedMonth]} {selectedYear}</p>
            <button onClick={function () { changeMonth(1) }} className="px-3 py-2 bg-[#F3EEE4] text-[#1B1A17] hover:bg-[#D8D2C4] transition rounded-md font-['Tajawal'] text-sm">التالي</button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-4 mb-6 bg-white border border-[#D8D2C4] rounded-lg p-3 w-fit mx-auto">
            <button onClick={function () { changeDay(-1) }} className="px-3 py-2 bg-[#F3EEE4] text-[#1B1A17] hover:bg-[#D8D2C4] transition rounded-md font-['Tajawal'] text-sm">السابق</button>
            <p className="font-['Tajawal'] font-bold text-[#1B1A17] w-32 text-center">{selectedDay.getDate()} {monthNames[selectedDay.getMonth()]}</p>
            <button onClick={function () { changeDay(1) }} className="px-3 py-2 bg-[#F3EEE4] text-[#1B1A17] hover:bg-[#D8D2C4] transition rounded-md font-['Tajawal'] text-sm">التالي</button>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <div className="bg-white border border-[#D8D2C4] rounded-lg p-4 text-center">
            <p className="font-['Tajawal'] text-xs text-[#4A473F] mb-1">الإيرادات</p>
            <p className="font-['Tajawal'] font-bold text-lg text-[#2F4538]">{periodRevenue} د.أ</p>
          </div>
          <div className="bg-white border border-[#D8D2C4] rounded-lg p-4 text-center">
            <p className="font-['Tajawal'] text-xs text-[#4A473F] mb-1">المصاريف</p>
            <p className="font-['Tajawal'] font-bold text-lg text-[#7A2E2E]">{periodExpenses} د.أ</p>
          </div>
          <div className="bg-white border border-[#D8D2C4] rounded-lg p-4 text-center">
            <p className="font-['Tajawal'] text-xs text-[#4A473F] mb-1">صافي الربح</p>
            <p className="font-['Tajawal'] font-bold text-lg text-[#1B1A17]">{netProfit} د.أ</p>
          </div>
          <div className="bg-white border border-[#D8D2C4] rounded-lg p-4 text-center">
            <p className="font-['Tajawal'] text-xs text-[#4A473F] mb-1">هامش الربح</p>
            <p className="font-['Tajawal'] font-bold text-lg text-[#AD8A4E]">{profitMargin.toFixed(0)}%</p>
          </div>
          <div className="bg-white border border-[#D8D2C4] rounded-lg p-4 text-center">
            <p className="font-['Tajawal'] text-xs text-[#4A473F] mb-1">مدفوعات معلّقة</p>
            <p className="font-['Tajawal'] font-bold text-lg text-[#7A2E2E]">{overdueInvoices.length}</p>
          </div>
        </div>

        <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-6">
          <h2 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mb-4">{viewMode === 'monthly' ? 'الإيرادات اليومية' : 'الإيرادات بالساعة'}</h2>
          <div style={{ width: '100%', height: 220 }}>
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

        <button onClick={handleExportCsv} className="w-full py-3 mb-6 bg-[#1B1A17] text-white rounded-md font-['Tajawal'] text-sm">
          تصدير تقرير الفترة الحالية (CSV)
        </button>

        {overdueInvoices.length > 0 && (
          <div className="bg-[#F8EAEA] border-2 border-[#7A2E2E] rounded-lg p-6 mb-6">
            <h2 className="font-['Tajawal'] font-bold text-[#7A2E2E] mb-3">⚠️ المدفوعات المتأخرة ({overdueInvoices.length})</h2>
            {overdueInvoices.map(function (inv) {
              function normalizePhone(phone: string) {
                let cleaned = phone.replace(/\D/g, '')
                if (cleaned.startsWith('0')) cleaned = cleaned.substring(1)
                if (!cleaned.startsWith('962')) cleaned = '962' + cleaned
                return cleaned
              }

              const senderLine = lawyerFullName ? 'معك مكتب المحامي ' + lawyerFullName + '. ' : ''
              const message = 'مرحباً ' + inv.client_name + '، ' + senderLine + 'هذا تذكير بخصوص فاتورة بمبلغ ' + inv.amount + ' د.أ مستحقة منذ ' + formatDateDisplay(inv.due_date) + '. نرجو التكرم بالسداد في أقرب وقت ممكن. شكراً لكم.'
              const whatsappLink = inv.client_phone ? 'https://wa.me/' + normalizePhone(inv.client_phone) + '?text=' + encodeURIComponent(message) : ''

              return (
                <div key={inv.id} className="flex justify-between items-center py-2 border-b border-[#e5c9c9] last:border-0">
                  <p className="font-['Tajawal'] text-sm text-[#7A2E2E]">{inv.client_name} — {inv.amount} د.أ (استحقت {formatDateDisplay(inv.due_date)})</p>
                  {accountType === 'firm' ? (
                    <span className="font-['Tajawal'] text-xs text-[#4A473F]">{getLawyerName(inv.lawyer_id)}</span>
                  ) : whatsappLink ? (
                    <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-[#2F4538] text-white rounded-md font-['Tajawal'] text-xs">
                      إرسال تذكير واتساب
                    </a>
                  ) : (
                    <span className="font-['Tajawal'] text-xs text-[#4A473F]">لا يوجد رقم هاتف</span>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-6">
          <h3 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mb-1">أفضل 5 عملاء</h3>
          <p className="font-['Tajawal'] text-xs text-[#4A473F] mb-4">حسب إجمالي ما دفعوه لك في كل الفترات، والنسبة من إجمالي إيراداتك</p>
          {topClients.length === 0 && <p className="font-['Tajawal'] text-sm text-[#4A473F]">لا توجد بيانات بعد</p>}
          {topClients.map(function (entry, index) {
            const share = totalPaidAll > 0 ? (entry[1] / totalPaidAll) * 100 : 0
            return (
              <div key={entry[0]} className="mb-3 last:mb-0">
                <div className="flex justify-between items-center gap-3 font-['Tajawal'] text-sm mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-[#F3EEE4] text-[#AD8A4E] font-bold text-xs flex items-center justify-center flex-shrink-0">{index + 1}</span>
                    <span className="text-[#1B1A17] truncate">{entry[0]}</span>
                  </div>
                  <div className="flex-shrink-0">
                    <span className="text-[#2F4538] font-bold">{entry[1]} د.أ</span>
                    <span dir="ltr" className="inline-block text-xs text-[#4A473F] mr-1">({share.toFixed(0)}%)</span>
                  </div>
                </div>
                <div className="w-full h-2 bg-[#F3EEE4] rounded-full">
                  <div className="h-2 bg-[#AD8A4E] rounded-full" style={{ width: share + '%' }}></div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-6">
          <h3 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mb-4">مؤشرات الأداء المالي</h3>

          <div className="flex justify-center mb-3">
            <div className="flex bg-[#F3EEE4] border border-[#D8D2C4] rounded-md p-1 w-fit">
              <button onClick={function () { setIndicatorScope('all') }} className={"px-4 py-2 rounded font-['Tajawal'] text-sm font-medium transition " + (indicatorScope === 'all' ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'text-[#4A473F]')}>كل الفترات</button>
              <button onClick={function () { setIndicatorScope('year') }} className={"px-4 py-2 rounded font-['Tajawal'] text-sm font-medium transition " + (indicatorScope === 'year' ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'text-[#4A473F]')}>سنة</button>
              <button onClick={function () { setIndicatorScope('month') }} className={"px-4 py-2 rounded font-['Tajawal'] text-sm font-medium transition " + (indicatorScope === 'month' ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'text-[#4A473F]')}>شهر</button>
            </div>
          </div>

          {indicatorScope === 'year' && (
            <div className="flex items-center justify-center gap-4 mb-4">
              <button onClick={function () { changeIndicatorYear(-1) }} className="px-3 py-2 bg-[#F3EEE4] text-[#1B1A17] hover:bg-[#D8D2C4] transition rounded-md font-['Tajawal'] text-sm">السابق</button>
              <p className="font-['Tajawal'] font-bold text-[#1B1A17] w-28 text-center">{indicatorYear}</p>
              <button onClick={function () { changeIndicatorYear(1) }} className="px-3 py-2 bg-[#F3EEE4] text-[#1B1A17] hover:bg-[#D8D2C4] transition rounded-md font-['Tajawal'] text-sm">التالي</button>
            </div>
          )}

          {indicatorScope === 'month' && (
            <div className="flex items-center justify-center gap-4 mb-4">
              <button onClick={function () { changeIndicatorMonth(-1) }} className="px-3 py-2 bg-[#F3EEE4] text-[#1B1A17] hover:bg-[#D8D2C4] transition rounded-md font-['Tajawal'] text-sm">السابق</button>
              <p className="font-['Tajawal'] font-bold text-[#1B1A17] w-28 text-center">{monthNames[indicatorMonth]} {indicatorYear}</p>
              <button onClick={function () { changeIndicatorMonth(1) }} className="px-3 py-2 bg-[#F3EEE4] text-[#1B1A17] hover:bg-[#D8D2C4] transition rounded-md font-['Tajawal'] text-sm">التالي</button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            {renderIndicator(
              'المبلغ غير المحصّل',
              scopedUnpaidTotal + ' د.أ',
              'فواتير صدرت ' + scopeHint + ' ولم تُدفع بعد' + (scopedOverdueTotal > 0 ? '، منها ' + scopedOverdueTotal + ' د.أ متأخرة عن موعدها' : '')
            )}
            {renderIndicator(
              'نسبة التحصيل',
              collectionRate !== null ? collectionRate.toFixed(0) + '%' : '-',
              'كم من قيمة الفواتير الصادرة ' + scopeHint + ' تم تحصيله فعلاً. كلما ارتفعت كان أفضل'
            )}
            {renderIndicator(
              'متوسط مدة التحصيل',
              avgPaymentDays !== null ? avgPaymentDays + ' يوم' : '-',
              'من إنشاء الفاتورة حتى دفعها، للفواتير الصادرة ' + scopeHint + '. كلما قلّت كان أفضل'
            )}
            {renderIndicator(
              'متوسط قيمة الفاتورة',
              avgInvoiceValue !== null ? avgInvoiceValue.toFixed(0) + ' د.أ' : '-',
              'إجمالي الفواتير الصادرة ' + scopeHint + ' مقسوماً على عددها'
            )}

            {indicatorScope === 'month' && renderIndicator(
              'مقارنة بالشهر السابق',
              formatChange(scopeChange),
              'إيراداتك في ' + monthNames[indicatorMonth] + ' (' + scopeRevenue + ' د.أ) مقابل ' + monthNames[prevMonthIndex] + ' (' + previousScopeRevenue + ' د.أ)',
              changeColor(scopeChange)
            )}
            {indicatorScope === 'year' && renderIndicator(
              'مقارنة بالسنة السابقة',
              formatChange(scopeChange),
              indicatorYear + ': ' + scopeRevenue + ' د.أ مقابل ' + (indicatorYear - 1) + ': ' + previousScopeRevenue + ' د.أ',
              changeColor(scopeChange)
            )}
            {indicatorScope === 'all' && renderIndicator(
              'إجمالي الإيرادات',
              totalPaidAll + ' د.أ',
              'مجموع كل ما دُفع لك من الفواتير'
            )}

            {indicatorScope === 'month' && renderIndicator(
              'مقارنة بنفس الشهر من العام الماضي',
              formatChange(sameMonthChange),
              monthNames[indicatorMonth] + ' ' + indicatorYear + ': ' + scopeRevenue + ' د.أ مقابل ' + (indicatorYear - 1) + ': ' + sameMonthLastYearRevenue + ' د.أ',
              changeColor(sameMonthChange)
            )}
            {indicatorScope === 'year' && renderIndicator(
              'متوسط الإيراد الشهري',
              scopeRevenue > 0 ? monthlyAverage.toFixed(0) + ' د.أ' : '-',
              'إيراد السنة مقسوماً على ' + monthsCounted + ' شهر'
            )}
            {indicatorScope === 'all' && renderIndicator(
              'متوسط الإيراد الشهري',
              scopeRevenue > 0 ? monthlyAverage.toFixed(0) + ' د.أ' : '-',
              'منذ أول دفعة استلمتها (' + monthsCounted + ' شهر)'
            )}
          </div>
        </div>

        {accountType === 'lawyer' && (
          <div className="bg-white border-2 border-[#AD8A4E] rounded-lg p-6 mb-6">
            <h3 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mb-2">هدف الادخار</h3>
            <p className="font-['Tajawal'] text-sm text-[#4A473F] leading-relaxed mb-4">
              حدّد نسبة تريد ادخارها من <strong>صافي الربح</strong> كل شهر، وسنحسب لك كم تدّخر شهرياً ويومياً وعلى المدى الأطول.
            </p>

            <div className="bg-[#F3EEE4] rounded-md p-4 mb-4 space-y-2">
              <p className="font-['Tajawal'] text-xs text-[#4A473F] leading-relaxed"><strong className="text-[#2F4538]">الإيرادات:</strong> ما دخل فعلاً من الفواتير المدفوعة.</p>
              <p className="font-['Tajawal'] text-xs text-[#4A473F] leading-relaxed"><strong className="text-[#7A2E2E]">المصاريف:</strong> ما أنفقته على المكتب والعمل.</p>
              <p className="font-['Tajawal'] text-xs text-[#4A473F] leading-relaxed"><strong className="text-[#1B1A17]">صافي الربح:</strong> الإيرادات ناقص المصاريف، وهو المبلغ الذي يمكنك ادخار جزء منه فعلاً.</p>
            </div>

            <div className="flex gap-2 mb-4">
              <input type="number" min="0" max="100" value={savingsGoalPercent} onChange={function (e) { setSavingsGoalPercent(e.target.value) }} placeholder="نسبة الادخار %" className="flex-1 px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
              <button onClick={handleSaveSavingsGoal} disabled={savingGoal} className="px-4 py-2 bg-[#1B1A17] text-white rounded-md font-['Tajawal'] text-sm disabled:opacity-60">{savingGoal ? 'جاري الحفظ...' : 'حفظ'}</button>
            </div>

            {savingsPct === 0 && (
              <p className="font-['Tajawal'] text-sm text-[#4A473F]">أدخل نسبة الادخار واضغط حفظ لتظهر لك خطة الادخار.</p>
            )}

            {savingsPct > 0 && (
              <div>
                <p className="font-['Tajawal'] font-bold text-sm text-[#1B1A17] mb-2">حساب شهر {monthNames[selectedMonth]} {selectedYear}</p>
                <div className="border border-[#D8D2C4] rounded-md px-4 mb-4">
                  {renderSavingsRow('الإيرادات', monthRevenue + ' د.أ')}
                  {renderSavingsRow('المصاريف', '- ' + monthExpenses + ' د.أ')}
                  {renderSavingsRow('صافي الربح', monthNet + ' د.أ', true)}
                  {renderSavingsRow('نسبة الادخار', savingsPct + '%')}
                  {renderSavingsRow('المبلغ المقترح ادخاره هذا الشهر', monthSavings.toFixed(0) + ' د.أ', true)}
                </div>

                {monthNet <= 0 ? (
                  <p className="font-['Tajawal'] text-sm text-[#7A2E2E]">لا يوجد ربح في هذا الشهر حتى الآن، لذلك لا يوجد مبلغ مقترح للادخار.</p>
                ) : (
                  <div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                      <div className="bg-[#F3EEE4] rounded-md p-3 text-center">
                        <p className="font-['Tajawal'] font-bold text-[#1B1A17]">{dailySavings.toFixed(1)} د.أ</p>
                        <p className="font-['Tajawal'] text-xs text-[#4A473F] mt-1">يومياً</p>
                      </div>
                      <div className="bg-[#F3EEE4] rounded-md p-3 text-center">
                        <p className="font-['Tajawal'] font-bold text-[#1B1A17]">{monthSavings.toFixed(0)} د.أ</p>
                        <p className="font-['Tajawal'] text-xs text-[#4A473F] mt-1">شهرياً</p>
                      </div>
                      <div className="bg-[#F3EEE4] rounded-md p-3 text-center">
                        <p className="font-['Tajawal'] font-bold text-[#1B1A17]">{(monthSavings * 6).toFixed(0)} د.أ</p>
                        <p className="font-['Tajawal'] text-xs text-[#4A473F] mt-1">خلال 6 أشهر</p>
                      </div>
                      <div className="bg-[#F3EEE4] rounded-md p-3 text-center">
                        <p className="font-['Tajawal'] font-bold text-[#1B1A17]">{(monthSavings * 12).toFixed(0)} د.أ</p>
                        <p className="font-['Tajawal'] text-xs text-[#4A473F] mt-1">خلال سنة</p>
                      </div>
                    </div>

                    <div className="bg-[#F3EEE4] border border-[#D8D2C4] rounded-md p-4">
                      <p className="font-['Tajawal'] font-bold text-sm text-[#1B1A17] mb-1">ماذا تفعل؟</p>
                      <p className="font-['Tajawal'] text-sm text-[#4A473F] leading-relaxed">
                        في نهاية الشهر، بعد تحصيل فواتيرك، حوّل <strong>{monthSavings.toFixed(0)} د.أ</strong> إلى حساب ادخار منفصل. وإن فضّلت الادخار اليومي فخصّص نحو <strong>{dailySavings.toFixed(1)} د.أ</strong> كل يوم.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            <p className="font-['Tajawal'] text-xs text-[#4A473F] leading-relaxed mt-4 pt-4 border-t border-[#D8D2C4]">
              تنبيه: حمورابي ليس مستشاراً مالياً. هذه الأرقام حساب شهري تقديري بسيط مبني على الإيرادات والمصاريف التي أدخلتها، وهي للاستئناس فقط وليست نصيحة مالية أو استثمارية.
            </p>
          </div>
        )}

        {accountType === 'lawyer' && (
          <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-6">
            <h2 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mb-4">إضافة مصروف</h2>
            <div className="space-y-3">
              <select value={expCategory} onChange={function (e) { setExpCategory(e.target.value) }} className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]">
                {expenseCategories.map(function (cat) { return <option key={cat} value={cat}>{cat}</option> })}
              </select>
              <input type="number" value={expAmount} onChange={function (e) { setExpAmount(e.target.value) }} placeholder="المبلغ" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
              <div>
                <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-1">تاريخ المصروف (يوم / شهر / سنة)</label>
                <div className="grid grid-cols-3 gap-2">
                  <input type="number" value={expDay} onChange={function (e) { setExpDay(e.target.value) }} placeholder="يوم" min="1" max="31" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
                  <input type="number" value={expMonth} onChange={function (e) { setExpMonth(e.target.value) }} placeholder="شهر" min="1" max="12" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
                  <input type="number" value={expYear} onChange={function (e) { setExpYear(e.target.value) }} placeholder="سنة" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
                </div>
              </div>
              <input type="text" value={expNotes} onChange={function (e) { setExpNotes(e.target.value) }} placeholder="ملاحظات (اختياري)" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
              <label className="flex items-center gap-2 font-['Tajawal'] text-xs text-[#4A473F]">
                <input type="checkbox" checked={expRecurring} onChange={function (e) { setExpRecurring(e.target.checked) }} />
                مصروف متكرر شهرياً (يُضاف تلقائياً كل شهر بنفس المبلغ في نفس اليوم)
              </label>
              <button onClick={handleAddExpense} disabled={savingExpense} className="w-full py-3 bg-[#1B1A17] text-white rounded-md font-['Tajawal'] font-medium">
                {savingExpense ? 'جاري الإضافة...' : 'إضافة المصروف'}
              </button>
            </div>
          </div>
        )}

        {expenses.length > 0 && (
          <div className="mb-6">
            <h2 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mb-3">جميع المصاريف</h2>
            {actionError && <p className="font-['Tajawal'] text-sm text-[#7A2E2E] mb-2">{actionError}</p>}
            {expenses.map(renderExpense)}
          </div>
        )}

        {accountType === 'lawyer' && (
          <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-6">
            <h2 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mb-3">إنشاء فاتورة جديدة</h2>
            <div className="space-y-3">
              <input type="text" value={clientName} onChange={function (e) { setClientName(e.target.value) }} placeholder="اسم العميل" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
              <input type="tel" value={clientPhone} onChange={function (e) { setClientPhone(e.target.value) }} placeholder="رقم هاتف العميل (لإرسال تذكير واتساب)" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
              <input type="number" value={amount} onChange={function (e) { setAmount(e.target.value) }} placeholder="المبلغ (د.أ)" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
              <div>
                <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-1">تاريخ الاستحقاق (يوم / شهر / سنة) — اختياري</label>
                <div className="grid grid-cols-3 gap-2">
                  <input type="number" value={dueDay} onChange={function (e) { setDueDay(e.target.value) }} placeholder="يوم" min="1" max="31" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
                  <input type="number" value={dueMonth} onChange={function (e) { setDueMonth(e.target.value) }} placeholder="شهر" min="1" max="12" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
                  <input type="number" value={dueYear} onChange={function (e) { setDueYear(e.target.value) }} placeholder="سنة" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
                </div>
              </div>
              <button onClick={handleAddInvoice} disabled={savingInvoice} className="w-full py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal'] font-medium hover:bg-[#AD8A4E] transition disabled:opacity-60">
                {savingInvoice ? 'جاري الإنشاء...' : 'إنشاء فاتورة'}
              </button>
              <p className="font-['Tajawal'] text-xs text-[#4A473F] leading-relaxed">
                هذه فاتورة لمتابعة مستحقاتك داخل حمورابي. لإصدار فاتورة ضريبية رسمية، استخدم{' '}
                <a href="https://portal.jofotara.gov.jo/ar" target="_blank" rel="noopener noreferrer" className="text-[#AD8A4E] underline">نظام الفوترة الوطني (جوفوترة)</a>.
              </p>
            </div>
          </div>
        )}

        <h2 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mb-3">جميع الفواتير</h2>
        {invoices.length === 0 && <p className="font-['Tajawal'] text-center text-[#4A473F]">لا توجد فواتير بعد</p>}
        {invoices.map(renderInvoice)}
      </div>

      <Footer variant={accountType === 'firm' ? 'firm' : 'lawyer'} />
    </div>
  )
}