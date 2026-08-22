'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase'

type Customer = {
  id: number
  full_name: string
  email: string
  phone: string
}

export default function MyAccountPage() {
  const [loading, setLoading] = useState(true)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [notCustomer, setNotCustomer] = useState(false)

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')

  const [saveMessage, setSaveMessage] = useState('')
  const [saving, setSaving] = useState(false)

  const supabase = createClient()

  useEffect(function () {
    async function loadData() {
      const userResult = await supabase.auth.getUser()

      if (!userResult.data.user) {
        setNotCustomer(true)
        setLoading(false)
        return
      }

      const customerResult = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', userResult.data.user.id)
        .single()

      if (!customerResult.data) {
        setNotCustomer(true)
        setLoading(false)
        return
      }

      const c: Customer = customerResult.data
      setCustomer(c)
      setFullName(c.full_name || '')
      setPhone(c.phone || '')
      setLoading(false)
    }

    loadData()
  }, [])

  async function handleSave() {
    if (!customer) return
    setSaveMessage('')
    setSaving(true)

    const updateResult = await supabase
      .from('customers')
      .update({
        full_name: fullName,
        phone: phone,
      })
      .eq('id', customer.id)

    setSaving(false)

    if (updateResult.error) {
      setSaveMessage('حدث خطأ أثناء الحفظ، حاول مرة أخرى')
      return
    }

    setSaveMessage('تم حفظ التغييرات بنجاح')
  }

  if (loading) {
    return (
      <div dir="rtl" className="min-h-screen pattern-bg flex items-center justify-center">
        <p className="font-['Tajawal'] text-[#4A473F]">جاري التحميل...</p>
      </div>
    )
  }

  if (notCustomer) {
    return (
      <div dir="rtl" className="min-h-screen pattern-bg flex items-center justify-center px-6">
        <div className="text-center">
          <p className="font-['Tajawal'] text-[#4A473F] mb-4">يرجى تسجيل الدخول لعرض معلوماتك الشخصية</p>
          <a href="/login" className="inline-block px-6 py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal']">تسجيل الدخول</a>
        </div>
      </div>
    )
  }

  return (
    <div dir="rtl" className="min-h-screen pattern-bg">
      <div className="bg-[#1B1A17] text-[#F3EEE4] py-12 px-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="font-['Amiri'] text-4xl mb-2">معلوماتي الشخصية</h1>
          <div className="w-16 h-[2px] bg-[#AD8A4E]"></div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-6">
          <div className="space-y-3">
            <div>
              <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-1">الاسم الكامل</label>
              <input
                type="text"
                value={fullName}
                onChange={function (e) { setFullName(e.target.value) }}
                className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
              />
            </div>
            <div>
              <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-1">البريد الإلكتروني</label>
              <input
                type="email"
                value={customer ? customer.email : ''}
                disabled
                className="w-full px-3 py-2 bg-[#E5E0D5] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#4A473F] cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-1">رقم الهاتف</label>
              <input
                type="tel"
                value={phone}
                onChange={function (e) { setPhone(e.target.value) }}
                className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
              />
            </div>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal'] font-medium hover:bg-[#AD8A4E] transition disabled:opacity-60 mb-4"
        >
          {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
        </button>

        {saveMessage && (
          <p className="text-center font-['Tajawal'] text-sm text-[#2F4538] mb-4">{saveMessage}</p>
        )}

        <div className="text-center">
          <a href="/change-password" className="font-['Tajawal'] text-sm text-[#AD8A4E] hover:underline">تغيير كلمة المرور</a>
        </div>
      </div>
    </div>
  )
}