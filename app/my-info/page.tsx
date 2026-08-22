'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase'

type Customer = {
  id: number
  full_name: string
  email: string
  phone: string
}

export default function MyInfoPage() {
  const [loading, setLoading] = useState(true)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [notCustomer, setNotCustomer] = useState(false)

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

      setCustomer(customerResult.data)
      setLoading(false)
    }

    loadData()
  }, [])

  if (loading) {
    return (
      <div dir="rtl" className="min-h-screen pattern-bg flex items-center justify-center">
        <p className="font-['Tajawal'] text-[#4A473F]">جاري التحميل...</p>
      </div>
    )
  }

  if (notCustomer || !customer) {
    return (
      <div dir="rtl" className="min-h-screen pattern-bg flex items-center justify-center px-6">
        <div className="text-center">
          <p className="font-['Tajawal'] text-[#4A473F] mb-4">يرجى تسجيل الدخول لعرض معلوماتك</p>
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
          <div className="grid grid-cols-2 gap-4 font-['Tajawal'] text-sm">
            <div>
              <p className="text-[#4A473F] mb-1">الاسم الكامل</p>
              <p className="text-[#1B1A17] font-medium">{customer.full_name}</p>
            </div>
            <div>
              <p className="text-[#4A473F] mb-1">البريد الإلكتروني</p>
              <p className="text-[#1B1A17] font-medium">{customer.email}</p>
            </div>
            <div>
              <p className="text-[#4A473F] mb-1">رقم الهاتف</p>
              <p className="text-[#1B1A17] font-medium">{customer.phone || '-'}</p>
            </div>
          </div>
        </div>

        
          href="/my-account"
          className="block w-full text-center py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal'] font-medium hover:bg-[#AD8A4E] transition mb-4"
        >
          تعديل المعلومات
        </a>

        <div className="text-center">
          <a href="/change-password" className="font-['Tajawal'] text-sm text-[#AD8A4E] hover:underline">تغيير كلمة المرور</a>
        </div>
      </div>
    </div>
  )
}