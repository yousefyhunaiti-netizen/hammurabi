'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

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
  tier: string
  status: string
  price: number
  started_at: string
}

const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [payments, setPayments] = useState<Payment[]>([])
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [customerCount, setCustomerCount] = useState(0)
  const [lawyerCount, setLawyerCount] = useState(0)
  const [firmCount, setFirmCount] = useState(0)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  const supabase = createClient()

  useEffect(function () {
    async function loadData() {
      const userResult = await supabase.auth.getUser()

      if (!userResult.data.user) {
        setLoading(false)
        return
      }

      const adminResult = await supabase
        .from('admins')
        .select('user_id')
        .eq('user_id', userResult.data.user.id)
        .maybeSingle()

      if (!adminResult.data) {
        setLoading(false)
        return
      }

      setIsAdmin(true)

      const paymentsResult = await supabase.from('payments').select('*')
      const subsResult = await supabase.from('subscriptions').select('*')

      const customersCountResult = await supabase.from('customers').select('id', { count: 'exact', head: true })
      const lawyersCountResult = await supabase.from('lawyers').select('id', { count: 'exact', head: true })
      const firmsCountResult = await supabase.from('firms').select('id', { count: 'exact', head: true })

      setPayments(paymentsResult.data || [])
      setSubscriptions(subsResult.data || [])
      setCustomerCount(customersCountResult.count || 0)
      setLawyerCount(lawyersCountResult.count || 0)
      setFirmCount(firmsCountResult.count || 0)

      setLoading(false)
    }

    loadData()
  }, [])

  function isInSelectedMonth(dateStr: string) {
    const d = new Date(dateStr)
    return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear
  }

  const monthPayments = payments.filter(function (p) {
    return isInSelectedMonth(p.created_at) && p.status === 'completed'
  })

  let monthRevenue = 0
  for (let i = 0; i < monthPayments.length; i++) {
    monthRevenue = monthRevenue + Number(monthPayments[i].amount)
  }

  const activeSubscriptions = subscriptions.filter(function (s) { return s.status === 'active' })
  const cancelledThisMonth = subscriptions.filter(function (s) {
    return s.status === 'cancelled' && isInSelectedMonth(s.started_at)
  })

  function buildDailyRevenueData() {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate()
    const data = []
    for (let day = 1; day <= daysInMonth; day++) {
      let dayTotal = 0
      for (let i = 0; i < monthPayments.length; i++) {
        const d = new Date(monthPayments[i].created_at)
        if (d.getDate() === day) {
          dayTotal = dayTotal + Number(monthPayments[i].amount)
        }
      }
      data.push({ day: String(day), revenue: dayTotal })
    }
    return data
  }

  const chartData = buildDailyRevenueData()

  function changeMonth(direction: number) {
    let newMonth = selectedMonth + direction
    let newYear = selectedYear
    if (newMonth < 0) {
      newMonth = 11
      newYear = newYear - 1
    }
    if (newMonth > 11) {
      newMonth = 0
      newYear = newYear + 1
    }
    setSelectedMonth(newMonth)
    setSelectedYear(newYear)
  }

  if (loading) {
    return (
      <div dir="rtl" className="min-h-screen pattern-bg flex items-center justify-center">
        <p className="font-['Tajawal'] text-[#4A473F]">جاري التحميل...</p>
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

  return (
    <div dir="rtl" className="min-h-screen pattern-bg">
      <div className="bg-[#1B1A17] text-[#F3EEE4] py-10 px-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="font-['Amiri'] text-4xl mb-2">لوحة تحكم المدير</h1>
          <div className="w-16 h-[2px] bg-[#AD8A4E]"></div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-center gap-4 mb-8 bg-white border border-[#D8D2C4] rounded-lg p-4 w-fit mx-auto">
          <button onClick={function () { changeMonth(-1) }} className="px-3 py-2 bg-[#F3EEE4] rounded-md font-['Tajawal'] text-sm">السابق</button>
          <p className="font-['Tajawal'] font-bold text-[#1B1A17] w-32 text-center">{monthNames[selectedMonth]} {selectedYear}</p>
          <button onClick={function () { changeMonth(1) }} className="px-3 py-2 bg-[#F3EEE4] rounded-md font-['Tajawal'] text-sm">التالي</button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white border border-[#D8D2C4] rounded-lg p-5 text-center">
            <p className="font-['Tajawal'] text-xs text-[#4A473F] mb-2">الأرباح هذا الشهر</p>
            <p className="font-['Tajawal'] font-bold text-2xl text-[#1B1A17]">{monthRevenue.toFixed(0)} د.أ</p>
          </div>
          <div className="bg-white border border-[#D8D2C4] rounded-lg p-5 text-center">
            <p className="font-['Tajawal'] text-xs text-[#4A473F] mb-2">اشتراكات فعّالة</p>
            <p className="font-['Tajawal'] font-bold text-2xl text-[#2F4538]">{activeSubscriptions.length}</p>
          </div>
          <div className="bg-white border border-[#D8D2C4] rounded-lg p-5 text-center">
            <p className="font-['Tajawal'] text-xs text-[#4A473F] mb-2">إلغاءات هذا الشهر</p>
            <p className="font-['Tajawal'] font-bold text-2xl text-[#7A2E2E]">{cancelledThisMonth.length}</p>
          </div>
          <div className="bg-white border border-[#D8D2C4] rounded-lg p-5 text-center">
            <p className="font-['Tajawal'] text-xs text-[#4A473F] mb-2">إجمالي المستخدمين</p>
            <p className="font-['Tajawal'] font-bold text-2xl text-[#AD8A4E]">{customerCount + lawyerCount + firmCount}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white border border-[#D8D2C4] rounded-lg p-5 text-center">
            <p className="font-['Tajawal'] text-xs text-[#4A473F] mb-2">عملاء</p>
            <p className="font-['Tajawal'] font-bold text-xl text-[#1B1A17]">{customerCount}</p>
          </div>
          <div className="bg-white border border-[#D8D2C4] rounded-lg p-5 text-center">
            <p className="font-['Tajawal'] text-xs text-[#4A473F] mb-2">محامون</p>
            <p className="font-['Tajawal'] font-bold text-xl text-[#1B1A17]">{lawyerCount}</p>
          </div>
          <div className="bg-white border border-[#D8D2C4] rounded-lg p-5 text-center">
            <p className="font-['Tajawal'] text-xs text-[#4A473F] mb-2">مكاتب محاماة</p>
            <p className="font-['Tajawal'] font-bold text-xl text-[#1B1A17]">{firmCount}</p>
          </div>
        </div>

        <div className="bg-white border border-[#D8D2C4] rounded-lg p-6">
          <h2 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mb-4">الإيرادات اليومية</h2>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#D8D2C4" />
                <XAxis dataKey="day" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Bar dataKey="revenue" fill="#AD8A4E" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}