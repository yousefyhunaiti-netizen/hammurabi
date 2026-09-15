'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

type Invoice = {
  id: number
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
  category: string
  amount: number
  expense_date: string
  notes: string | null
  is_recurring: boolean | null
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
  const [loading, setLoading] = useState(true)
  const [lawyerId, setLawyerId] = useState<number | null>(null)
  const [notAllowed, setNotAllowed] = useState(false)
  const [notSubscribed, setNotSubscribed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [savingsGoalPercent, setSavingsGoalPercent] = useState('')
  const [savingGoal, setSavingGoal] = useState(false)

  const [viewMode, setViewMode] = useState('monthly')
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedDay, setSelectedDay] = useState(new Date())

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

  async function loadAll(id: number) {
    const invoicesResult = await supabase.from('invoices').select('*').eq('lawyer_id', id).order('created_at', { ascending: false })
    setInvoices(invoicesResult.data || [])

    const expensesResult = await supabase.from('expenses').select('*').eq('lawyer_id', id).order('expense_date', { ascending: false })
    setExpenses(expensesResult.data || [])
  }

  useEffect(function () {
    async function loadData() {
      const userResult = await supabase.auth.getUser()

      if (!userResult.data.user) {
        setNotAllowed(true)
        setLoading(false)
        return
      }

      const lawyerResult = await supabase.from('lawyers').select('id, is_active, is_comped, savings_goal_percent').eq('user_id', userResult.data.user.id).maybeSingle()

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
      setSavingsGoalPercent(lawyerResult.data.savings_goal_percent ? String(lawyerResult.data.savings_goal_percent) : '')

      await loadAll(lawyerResult.data.id)
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
    await loadAll(lawyerId)
    setSavingInvoice(false)
  }

  async function handleMarkPaid(invoiceId: number) {
    if (!lawyerId) return
    await supabase.from('invoices').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', invoiceId)
    await loadAll(lawyerId)
  }

  async function handleMarkUnpaid(invoiceId: number) {
    if (!lawyerId) return
    await supabase.from('invoices').update({ status: 'unpaid', paid_at: null }).eq('id', invoiceId)
    await loadAll(lawyerId)
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
    await loadAll(lawyerId)
    setSavingExpense(false)
  }

  async function handleDeleteExpense(id: number) {
    if (!lawyerId) return
    await supabase.from('expenses').delete().eq('id', id)
    await loadAll(lawyerId)
  }

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
  const savingsAmount = savingsGoalPercent ? (netProfit * Number(savingsGoalPercent)) / 100 : 0

  const now = new Date()
  const today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0')

  const overdueInvoices = invoices.filter(function (inv) { return inv.status !== 'paid' && inv.due_date && inv.due_date <= today })
    function getTopClients() {
    const totals: { [key: string]: number } = {}
    paidInvoices.forEach(function (inv) {
      totals[inv.client_name] = (totals[inv.client_name] || 0) + Number(inv.amount)
    })
    return Object.entries(totals).sort(function (a, b) { return b[1] - a[1] }).slice(0, 5)
  }
  const topClients = getTopClients()

  function getAvgPaymentDays() {
    const withBoth = paidInvoices.filter(function (inv) { return inv.paid_at && inv.created_at })
    if (withBoth.length === 0) return null
    let totalDays = 0
    withBoth.forEach(function (inv) {
      const created = new Date(inv.created_at).getTime()
      const paid = new Date(inv.paid_at as string).getTime()
      totalDays = totalDays + (paid - created) / (1000 * 60 * 60 * 24)
    })
    return Math.round(totalDays / withBoth.length)
  }
  const avgPaymentDays = getAvgPaymentDays()

  function getYearTotal(year: number) {
    let total = 0
    paidInvoices.forEach(function (inv) {
      if (new Date(inv.paid_at as string).getFullYear() === year) {
        total = total + Number(inv.amount)
      }
    })
    return total
  }
  const thisYearTotal = getYearTotal(selectedYear)
  const lastYearTotal = getYearTotal(selectedYear - 1)

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
  }

  function handleExportCsv() {
    let csv = 'النوع,الوصف/العميل,المبلغ,التاريخ,الحالة\n'
    scopedPaidInvoices.forEach(function (inv) {
      csv = csv + 'إيراد,' + inv.client_name + ',' + inv.amount + ',' + (inv.paid_at || '') + ',مدفوعة\n'
    })
    scopedExpenses.forEach(function (e) {
      csv = csv + 'مصروف,' + e.category + ',' + e.amount + ',' + e.expense_date + ',-\n'
    })

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'التقرير-المالي.csv'
    link.click()
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
        <p className="font-['Tajawal'] text-sm text-[#4A473F] mb-1">المبلغ: {invoice.amount} د.أ</p>
        {invoice.due_date && <p className="font-['Tajawal'] text-xs text-[#4A473F] mb-3">تاريخ الاستحقاق: {formatDateDisplay(invoice.due_date)}</p>}        {invoice.status !== 'paid' && (
          <button onClick={paidClick} className="px-3 py-2 bg-[#2F4538] text-white rounded-md font-['Tajawal'] text-xs">تحديد كمدفوعة</button>
        )}
        {invoice.status === 'paid' && (
          <button onClick={unpaidClick} className="px-3 py-2 bg-[#F3EEE4] text-[#4A473F] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-xs">إلغاء الدفع</button>
        )}
      </div>
    )
  }

  function renderExpense(e: Expense) {
    function deleteClick() { handleDeleteExpense(e.id) }
    return (
      <div key={e.id} className="flex justify-between items-center bg-white border border-[#D8D2C4] rounded-lg p-4 mb-2">
        <div>
          <p className="font-['Tajawal'] font-bold text-sm text-[#1B1A17]">{e.category} {e.is_recurring && <span className="text-xs text-[#AD8A4E]">(متكرر شهرياً)</span>}</p>
          <p className="font-['Tajawal'] text-xs text-[#4A473F]">{e.amount} د.أ — {formatDateDisplay(e.expense_date)}</p>          {e.notes && <p className="font-['Tajawal'] text-xs text-[#4A473F]">{e.notes}</p>}
        </div>
        <button onClick={deleteClick} className="font-['Tajawal'] text-xs text-[#7A2E2E]">حذف</button>
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
            <h1 className="font-['Amiri'] text-2xl text-[#1B1A17] mb-3">يلزم الاشتراك للوصول إلى الفواتير</h1>
            <a href="/subscription" className="inline-block mt-4 px-6 py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal']">عرض خطط الاشتراك</a>
          </div>
        </div>
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
              <a href="/my-appointments" className="hover:text-[#AD8A4E] transition">مواعيدي</a>
              <a href="/my-consultations" className="hover:text-[#AD8A4E] transition">استشاراتي</a>
              <a href="/ai-assistant" className="hover:text-[#AD8A4E] transition">مساعد ذكي</a>
              <a href="/lawyer-tools" className="hover:text-[#AD8A4E] transition">أدواتي</a>
              <a href="/community" className="hover:text-[#AD8A4E] transition">المجتمع</a>
              <a href="/lawyer-messages" className="hover:text-[#AD8A4E] transition">الرسائل</a>
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
          <h1 className="font-['Tajawal'] font-bold text-4xl mb-2">الفواتير والمالية</h1>
          <p className="font-['Tajawal'] text-sm text-[#D8D2C4]">تابع دخلك ومصاريفك وأرباحك الحقيقية بشكل واضح</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="flex justify-center mb-4">
          <div className="flex bg-white border border-[#D8D2C4] rounded-md p-1 w-fit">
            <button onClick={function () { setViewMode('monthly') }} className={"px-5 py-2 rounded font-['Tajawal'] text-sm font-medium transition " + (viewMode === 'monthly' ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'text-[#4A473F]')}>شهري</button>
            <button onClick={function () { setViewMode('daily') }} className={"px-5 py-2 rounded font-['Tajawal'] text-sm font-medium transition " + (viewMode === 'daily' ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'text-[#4A473F]')}>يومي</button>
          </div>
        </div>

        {viewMode === 'monthly' ? (
          <div className="flex items-center justify-center gap-4 mb-6 bg-white border border-[#D8D2C4] rounded-lg p-3 w-fit mx-auto">
            <button onClick={function () { changeMonth(-1) }} className="px-3 py-2 bg-[#F3EEE4] rounded-md font-['Tajawal'] text-sm">السابق</button>
            <p className="font-['Tajawal'] font-bold text-[#1B1A17] w-28 text-center">{monthNames[selectedMonth]} {selectedYear}</p>
            <button onClick={function () { changeMonth(1) }} className="px-3 py-2 bg-[#F3EEE4] rounded-md font-['Tajawal'] text-sm">التالي</button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-4 mb-6 bg-white border border-[#D8D2C4] rounded-lg p-3 w-fit mx-auto">
            <button onClick={function () { changeDay(-1) }} className="px-3 py-2 bg-[#F3EEE4] rounded-md font-['Tajawal'] text-sm">السابق</button>
            <p className="font-['Tajawal'] font-bold text-[#1B1A17] w-32 text-center">{selectedDay.getDate()} {monthNames[selectedDay.getMonth()]}</p>
            <button onClick={function () { changeDay(1) }} className="px-3 py-2 bg-[#F3EEE4] rounded-md font-['Tajawal'] text-sm">التالي</button>
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

              const message = 'مرحباً ' + inv.client_name + '، هذا تذكير بخصوص فاتورة بمبلغ ' + inv.amount + ' د.أ مستحقة منذ ' + inv.due_date + '. نرجو التكرم بالسداد في أقرب وقت ممكن. شكراً لكم.'
              const whatsappLink = inv.client_phone ? 'https://wa.me/' + normalizePhone(inv.client_phone) + '?text=' + encodeURIComponent(message) : ''

              return (
                <div key={inv.id} className="flex justify-between items-center py-2 border-b border-[#e5c9c9] last:border-0">
                  <p className="font-['Tajawal'] text-sm text-[#7A2E2E]">{inv.client_name} — {inv.amount} د.أ (استحقت {formatDateDisplay(inv.due_date)})</p>
                  {whatsappLink ? (
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white border border-[#D8D2C4] rounded-lg p-5">
            <h3 className="font-['Tajawal'] font-bold text-sm text-[#1B1A17] mb-3">أفضل العملاء (حسب الدخل)</h3>
            {topClients.length === 0 && <p className="font-['Tajawal'] text-xs text-[#4A473F]">لا توجد بيانات بعد</p>}
            {topClients.map(function (entry) {
              return (
                <div key={entry[0]} className="flex justify-between font-['Tajawal'] text-xs mb-1">
                  <span className="text-[#1B1A17]">{entry[0]}</span>
                  <span className="text-[#2F4538] font-bold">{entry[1]} د.أ</span>
                </div>
              )
            })}
          </div>

          <div className="bg-white border border-[#D8D2C4] rounded-lg p-5">
            <h3 className="font-['Tajawal'] font-bold text-sm text-[#1B1A17] mb-3">مؤشرات أخرى</h3>
            <p className="font-['Tajawal'] text-xs text-[#4A473F] mb-2">متوسط مدة الدفع: <span className="font-bold text-[#1B1A17]">{avgPaymentDays !== null ? avgPaymentDays + ' يوم' : '-'}</span></p>
            <p className="font-['Tajawal'] text-xs text-[#4A473F]">مقارنة سنوية: {selectedYear}: <span className="font-bold text-[#1B1A17]">{thisYearTotal} د.أ</span> مقابل {selectedYear - 1}: <span className="font-bold text-[#1B1A17]">{lastYearTotal} د.أ</span></p>
          </div>
        </div>

        <div className="bg-white border border-[#AD8A4E] border-2 rounded-lg p-6 mb-6">
          <h3 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mb-3">هدف الادخار</h3>
          <div className="flex gap-2 mb-3">
            <input type="number" value={savingsGoalPercent} onChange={function (e) { setSavingsGoalPercent(e.target.value) }} placeholder="نسبة الادخار %" className="flex-1 px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
            <button onClick={handleSaveSavingsGoal} disabled={savingGoal} className="px-4 py-2 bg-[#1B1A17] text-white rounded-md font-['Tajawal'] text-sm">حفظ</button>
          </div>
          {savingsGoalPercent && (
            <p className="font-['Tajawal'] text-sm text-[#2F4538]">بناءً على أرباح هذه الفترة، يُنصح بادخار <strong>{savingsAmount.toFixed(0)} د.أ</strong></p>
          )}
        </div>

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
              مصروف متكرر شهرياً (للتذكير فقط، لن يُضاف تلقائياً)
            </label>
            <button onClick={handleAddExpense} disabled={savingExpense} className="w-full py-3 bg-[#1B1A17] text-white rounded-md font-['Tajawal'] font-medium">
              {savingExpense ? 'جاري الإضافة...' : 'إضافة المصروف'}
            </button>
          </div>
        </div>

        {expenses.length > 0 && (
          <div className="mb-6">
            <h2 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mb-3">جميع المصاريف</h2>
            {expenses.map(renderExpense)}
          </div>
        )}

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
          </div>
        </div>

        <h2 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mb-3">جميع الفواتير</h2>
        {invoices.length === 0 && <p className="font-['Tajawal'] text-center text-[#4A473F]">لا توجد فواتير بعد</p>}
        {invoices.map(renderInvoice)}
      </div>
    </div>
  )
}