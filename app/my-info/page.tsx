'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'

type AccountInfo = {
  id: number
  is_approved: boolean | null
  is_comped: boolean | null
  is_active: boolean | null
  subscription_tier: string | null
}

export default function SubscriptionPage() {
  const [loading, setLoading] = useState(true)
  const [accountType, setAccountType] = useState('')
  const [account, setAccount] = useState<AccountInfo | null>(null)
  const [notAllowed, setNotAllowed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [debugError, setDebugError] = useState('')

  const supabase = createClient()
  const router = useRouter()

  useEffect(function () {
    async function loadData() {
      const userResult = await supabase.auth.getUser()

      if (!userResult.data.user) {
        setNotAllowed(true)
        setLoading(false)
        return
      }

      setDebugError('Session UID: ' + userResult.data.user.id)

      const lawyerResult = await supabase.from('lawyers').select('id, is_approved, is_comped, is_active, subscription_tier').eq('user_id', userResult.data.user.id).maybeSingle()

      if (lawyerResult.error) {
        setDebugError('Lawyer query error: ' + lawyerResult.error.message)
      }

      if (lawyerResult.data) {
        setAccountType('lawyer')
        setAccount(lawyerResult.data)
        setLoading(false)
        return
      }

      const firmResult = await supabase.from('firms').select('id, is_approved, is_comped, is_active, subscription_tier').eq('user_id', userResult.data.user.id).maybeSingle()

      if (firmResult.error) {
        setDebugError('Firm query error: ' + firmResult.error.message)
      }

      if (firmResult.data) {
        setAccountType('firm')
        setAccount(firmResult.data)
        setLoading(false)
        return
      }

      setNotAllowed(true)
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

  function handleSelectTier(tier: string, amount: number) {
    if (!account) return
    router.push('/checkout?type=subscription&tier=' + tier + '&amount=' + amount + '&accountType=' + accountType + '&accountId=' + account.id)
  }

  const tiers = accountType === 'firm'
    ? [
        { key: 'monthly', label: 'شهري', price: 50 },
        { key: 'yearly', label: 'سنوي', price: 450 },
        { key: '5year', label: '5 سنوات', price: 750 },
      ]
    : [
        { key: 'monthly', label: 'شهري', price: 20 },
        { key: 'yearly', label: 'سنوي', price: 180 },
        { key: '5year', label: '5 سنوات', price: 300 },
      ]

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
          {debugError && <p className="font-['Tajawal'] text-xs text-[#7A2E2E] mb-4">{debugError}</p>}
          <a href="/login" className="inline-block px-6 py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal']">تسجيل الدخول</a>
        </div>
      </div>
    )
  }

  if (account && !account.is_approved) {
    return (
      <div dir="rtl" className="min-h-screen pattern-bg flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="bg-white border-2 border-[#AD8A4E] rounded-lg p-8">
            <h1 className="font-['Amiri'] text-2xl text-[#1B1A17] mb-3">قيد المراجعة</h1>
            <p className="font-['Tajawal'] text-sm text-[#4A473F] leading-relaxed">حسابك قيد المراجعة حالياً. يمكنك الاشتراك بعد اعتماد حسابك من قبل فريقنا.</p>
          </div>
        </div>
      </div>
    )
  }

  if (account && account.is_comped) {
    return (
      <div dir="rtl" className="min-h-screen pattern-bg flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="bg-white border-2 border-[#2F4538] rounded-lg p-8">
            <h1 className="font-['Amiri'] text-2xl text-[#1B1A17] mb-3">حساب مجاني</h1>
            <p className="font-['Tajawal'] text-sm text-[#4A473F] leading-relaxed">حسابك مفعّل مجاناً من قبل فريق حمورابي، ولا حاجة للاشتراك.</p>
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
              {accountType === 'lawyer' && <a href="/lawyer-tools" className="hover:text-[#AD8A4E] transition">أدواتي</a>}
              {accountType === 'firm' && <a href="/firm-dashboard" className="hover:text-[#AD8A4E] transition">أدواتي</a>}
              <a href="/community" className="hover:text-[#AD8A4E] transition">المجتمع</a>
              <a href="/lawyer-messages" className="hover:text-[#AD8A4E] transition">الرسائل</a>
              <div className="relative">
                <button onClick={toggleMenu} className="w-8 h-8 rounded-full bg-[#AD8A4E] flex items-center justify-center hover:bg-[#c49b58] transition">
                  <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.5c-3.3 0-9.8 1.6-9.8 4.9v2.4h19.6v-2.4c0-3.3-6.5-4.9-9.8-4.9z" /></svg>
                </button>
                {menuOpen && (
                  <div className="absolute left-0 top-full mt-2 w-52 bg-white border border-[#D8D2C4] rounded-md shadow-lg overflow-hidden z-20">
                    <a href={accountType === 'firm' ? '/firm-info' : '/lawyer-info'} className="block px-4 py-3 font-['Tajawal'] text-sm text-[#1B1A17] hover:bg-[#F3EEE4] transition">معلوماتي الشخصية</a>
                    <button onClick={handleLogout} className="w-full text-right px-4 py-3 font-['Tajawal'] text-sm text-[#7A2E2E] hover:bg-[#F3EEE4] transition border-t border-[#D8D2C4]">تسجيل الخروج</button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <h1 className="font-['Tajawal'] font-bold text-4xl mb-2">الاشتراك</h1>
          <p className="font-['Tajawal'] text-sm text-[#D8D2C4]">
            {account && account.subscription_tier ? 'باقتك الحالية: ' + account.subscription_tier : 'اختر الباقة المناسبة لك للوصول إلى جميع أدوات حمورابي'}
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10 grid grid-cols-1 md:grid-cols-3 gap-4">
        {tiers.map(function (tier) {
          function selectClick() {
            handleSelectTier(tier.key, tier.price)
          }

          return (
            <div key={tier.key} className="bg-white border border-[#D8D2C4] rounded-lg p-6 text-center">
              <h3 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mb-2">{tier.label}</h3>
              <p className="font-['Tajawal'] font-bold text-3xl text-[#AD8A4E] mb-4">{tier.price} د.أ</p>
              <button onClick={selectClick} className="w-full py-3 bg-[#1B1A17] text-white rounded-md font-['Tajawal'] font-medium hover:bg-[#AD8A4E] transition">
                اشترك الآن
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}