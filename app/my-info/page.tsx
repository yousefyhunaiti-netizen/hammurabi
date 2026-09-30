'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'
import Footer from '../components/Footer'
import DeleteAccount from '../components/DeleteAccount'

type Customer = {
  id: number
  full_name: string
  email: string | null
  phone: string | null
}

export default function MyInfoPage() {
  const [loading, setLoading] = useState(true)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [notAllowed, setNotAllowed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const supabase = createClient()
  const router = useRouter()
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

  useEffect(function () {
    async function loadData() {
      const userResult = await supabase.auth.getUser()

      if (!userResult.data.user) {
        setNotAllowed(true)
        setLoading(false)
        return
      }

      const customerResult = await supabase.from('customers').select('*').eq('user_id', userResult.data.user.id).maybeSingle()

      if (!customerResult.data) {
        setNotAllowed(true)
        setLoading(false)
        return
      }

      setCustomer(customerResult.data)
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

  function renderSectionTitle(text: string) {
    return (
      <div className="flex items-center gap-2 mb-3">
        <span className="w-1 h-5 bg-[#AD8A4E] rounded"></span>
        <h2 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17]">{text}</h2>
      </div>
    )
  }

  function renderRow(label: string, value: string, ltr?: boolean) {
    return (
      <div className="flex justify-between items-start gap-4 py-3 border-b border-[#F3EEE4] last:border-b-0">
        <p className="font-['Tajawal'] text-sm text-[#4A473F] flex-shrink-0">{label}</p>
        <p dir={ltr ? 'ltr' : undefined} className={"font-['Tajawal'] text-sm text-[#1B1A17] font-medium " + (ltr ? 'text-left' : 'text-right')}>{value}</p>
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

  if (notAllowed || !customer) {
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
    <div dir="rtl" className="min-h-screen pattern-bg flex flex-col">
      <div className="bg-[#1B1A17] text-[#F3EEE4] py-12 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-8 font-['Tajawal'] text-sm">
            <a href="/"><img src="/logo.png" alt="حمورابي" className="h-12 w-auto" /></a>
            <div className="flex gap-5 items-center">
              <a href="/my-appointments" className="hover:text-[#AD8A4E] transition">مواعيدي</a>
              <a href="/my-consultations" className="hover:text-[#AD8A4E] transition">استشاراتي</a>
              <a href="/lawyers" className="hover:text-[#AD8A4E] transition">دليل المحامين</a>
              <a href="/ai-assistant" className="hover:text-[#AD8A4E] transition">مساعد ذكي</a>
              <a href="/legal-articles" className="hover:text-[#AD8A4E] transition">مقالات قانونية</a>
              <div className="relative" ref={menuRef}>
                <button onClick={toggleMenu} className="w-8 h-8 rounded-full bg-[#AD8A4E] flex items-center justify-center hover:bg-[#c49b58] transition">
                  <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.5c-3.3 0-9.8 1.6-9.8 4.9v2.4h19.6v-2.4c0-3.3-6.5-4.9-9.8-4.9z" /></svg>
                </button>
                {menuOpen && (
                  <div className="absolute left-0 top-full mt-2 w-52 bg-white border border-[#D8D2C4] rounded-md shadow-lg overflow-hidden z-20">
                    <a href="/my-info" className="block px-4 py-3 font-['Tajawal'] text-sm text-[#1B1A17] hover:bg-[#F3EEE4] transition">معلوماتي الشخصية</a>
                    <button onClick={handleLogout} className="w-full text-right px-4 py-3 font-['Tajawal'] text-sm text-[#7A2E2E] hover:bg-[#F3EEE4] transition border-t border-[#D8D2C4]">تسجيل الخروج</button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <h1 className="font-['Tajawal'] font-bold text-4xl mb-2">معلوماتي الشخصية</h1>
          <div className="w-16 h-[2px] bg-[#AD8A4E]"></div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10 flex-1 w-full">
        <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-full bg-[#1B1A17] text-[#F3EEE4] flex items-center justify-center font-['Tajawal'] font-bold text-3xl flex-shrink-0">
              {customer.full_name.charAt(0)}
            </div>
            <div>
              <h2 className="font-['Tajawal'] font-bold text-2xl text-[#1B1A17] mb-1">{customer.full_name}</h2>
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-6">
          {renderSectionTitle('بيانات التواصل')}
          {renderRow('البريد الإلكتروني', customer.email || '-', true)}
          {renderRow('رقم الهاتف', customer.phone || '-', true)}
        </div>

        <a href="/my-account" className="block w-full text-center py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal'] font-medium hover:bg-[#AD8A4E] transition mb-4">
          تعديل المعلومات
        </a>

        <div className="text-center">
          <a href="/change-password" className="font-['Tajawal'] text-sm text-[#AD8A4E] hover:underline">تغيير كلمة المرور</a>
        </div>

        <DeleteAccount />
      </div>

      <Footer variant="customer" />
    </div>
  )
}