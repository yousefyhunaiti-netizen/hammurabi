'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase'

type Invoice = {
  id: number
  client_name: string
  amount: number
  status: string
  due_date: string
  created_at: string
}

export default function LawyerInvoicesPage() {
  const [loading, setLoading] = useState(true)
  const [lawyerId, setLawyerId] = useState<number | null>(null)
  const [notAllowed, setNotAllowed] = useState(false)
  const [invoices, setInvoices] = useState<Invoice[]>([])

  const [clientName, setClientName] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)

  const supabase = createClient()

  async function loadInvoices(id: number) {
    const result = await supabase
      .from('invoices')
      .select('*')
      .eq('lawyer_id', id)
      .order('created_at', { ascending: false })
    setInvoices(result.data || [])
  }

  useEffect(function () {
    async function loadData() {
      const userResult = await supabase.auth.getUser()

      if (!userResult.data.user) {
        setNotAllowed(true)
        setLoading(false)
        return
      }

      const lawyerResult = await supabase
        .from('lawyers')
        .select('id')
        .eq('user_id', userResult.data.user.id)
        .maybeSingle()

      if (!lawyerResult.data) {
        setNotAllowed(true)
        setLoading(false)
        return
      }

      setLawyerId(lawyerResult.data.id)
      await loadInvoices(lawyerResult.data.id)
      setLoading(false)
    }

    loadData()
  }, [])

  async function handleAddInvoice() {
    if (!clientName.trim() || !amount || !lawyerId) return
    setSaving(true)

    await supabase.from('invoices').insert({
      lawyer_id: lawyerId,
      client_name: clientName,
      amount: Number(amount),
      status: 'unpaid',
      due_date: dueDate || null,
    })

    setClientName('')
    setAmount('')
    setDueDate('')
    await loadInvoices(lawyerId)
    setSaving(false)
  }

  async function handleMarkPaid(invoiceId: number) {
    if (!lawyerId) return
    await supabase.from('invoices').update({ status: 'paid' }).eq('id', invoiceId)
    await loadInvoices(lawyerId)
  }

  async function handleSendReminder(clientName: string) {
    alert('تم إرسال تذكير إلى ' + clientName + ' (ميزة الإرسال التلقائي عبر البريد ستُضاف لاحقاً)')
  }

  function getStatusLabel(status: string) {
    if (status === 'paid') return 'مدفوعة'
    if (status === 'unpaid') return 'غير مدفوعة'
    return status
  }

  function getStatusColor(status: string) {
    if (status === 'paid') return 'bg-[#2F4538] text-white'
    return 'bg-[#7A2E2E] text-white'
  }

  let totalPaid = 0
  let totalUnpaid = 0
  for (let i = 0; i < invoices.length; i++) {
    if (invoices[i].status === 'paid') {
      totalPaid = totalPaid + Number(invoices[i].amount)
    } else {
      totalUnpaid = totalUnpaid + Number(invoices[i].amount)
    }
  }

  function renderInvoice(invoice: Invoice) {
    function paidClick() {
      handleMarkPaid(invoice.id)
    }
    function reminderClick() {
      handleSendReminder(invoice.client_name)
    }

    return (
      <div key={invoice.id} className="bg-white border border-[#D8D2C4] rounded-lg p-5 mb-3">
        <div className="flex justify-between items-start mb-2">
          <p className="font-['Tajawal'] font-bold text-[#1B1A17]">{invoice.client_name}</p>
          <span className={"px-3 py-1 rounded-full text-xs font-['Tajawal'] " + getStatusColor(invoice.status)}>
            {getStatusLabel(invoice.status)}
          </span>
        </div>
        <p className="font-['Tajawal'] text-sm text-[#4A473F] mb-1">المبلغ: {invoice.amount} د.أ</p>
        {invoice.due_date && (
          <p className="font-['Tajawal'] text-xs text-[#4A473F] mb-3">تاريخ الاستحقاق: {invoice.due_date}</p>
        )}
        <div className="flex gap-2">
          {invoice.status !== 'paid' && (
            <button onClick={paidClick} className="px-3 py-2 bg-[#2F4538] text-white rounded-md font-['Tajawal'] text-xs">
              تحديد كمدفوعة
            </button>
          )}
          {invoice.status !== 'paid' && (
            <button onClick={reminderClick} className="px-3 py-2 bg-[#F3EEE4] text-[#4A473F] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-xs">
              إرسال تذكير
            </button>
          )}
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
        <div className="max-w-2xl mx-auto">
          <h1 className="font-['Amiri'] text-4xl mb-2">الفواتير</h1>
          <div className="w-16 h-[2px] bg-[#AD8A4E]"></div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white border border-[#D8D2C4] rounded-lg p-4 text-center">
            <p className="font-['Tajawal'] text-xs text-[#4A473F] mb-1">إجمالي المدفوع</p>
            <p className="font-['Tajawal'] font-bold text-xl text-[#2F4538]">{totalPaid} د.أ</p>
          </div>
          <div className="bg-white border border-[#D8D2C4] rounded-lg p-4 text-center">
            <p className="font-['Tajawal'] text-xs text-[#4A473F] mb-1">إجمالي غير المدفوع</p>
            <p className="font-['Tajawal'] font-bold text-xl text-[#7A2E2E]">{totalUnpaid} د.أ</p>
          </div>
        </div>

        <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-6">
          <h2 className="font-['Tajawal'] font-bold text-[#1B1A17] mb-3">إنشاء فاتورة جديدة</h2>
          <div className="space-y-3">
            <input
              type="text"
              value={clientName}
              onChange={function (e) { setClientName(e.target.value) }}
              placeholder="اسم العميل"
              className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
            />
            <input
              type="number"
              value={amount}
              onChange={function (e) { setAmount(e.target.value) }}
              placeholder="المبلغ (د.أ)"
              className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
            />
            <input
              type="date"
              value={dueDate}
              onChange={function (e) { setDueDate(e.target.value) }}
              className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
            />
            <button
              onClick={handleAddInvoice}
              disabled={saving}
              className="w-full py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal'] font-medium hover:bg-[#AD8A4E] transition disabled:opacity-60"
            >
              {saving ? 'جاري الإنشاء...' : 'إنشاء فاتورة'}
            </button>
          </div>
        </div>

        {invoices.length === 0 && (
          <p className="font-['Tajawal'] text-center text-[#4A473F]">لا توجد فواتير بعد</p>
        )}

        {invoices.map(renderInvoice)}
      </div>
    </div>
  )
}