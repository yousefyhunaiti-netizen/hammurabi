'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'

function CheckoutContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const supabase = createClient()

  const type = searchParams.get('type') || ''
  const tier = searchParams.get('tier') || ''
  const amount = Number(searchParams.get('amount') || '0')
  const accountType = searchParams.get('accountType') || ''
  const accountId = Number(searchParams.get('accountId') || '0')

  const [checkingAuth, setCheckingAuth] = useState(true)
  const [loggedIn, setLoggedIn] = useState(false)
  const [infoLink, setInfoLink] = useState('')
  const [isLawyerAccount, setIsLawyerAccount] = useState(false)
  const [isFirmAccount, setIsFirmAccount] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const [cardName, setCardName] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvv, setCvv] = useState('')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(function () {
    async function checkAccount() {
      const userResult = await supabase.auth.getUser()
      const user = userResult.data.user

      if (user) {
        setLoggedIn(true)

        const lawyerResult = await supabase.from('lawyers').select('id').eq('user_id', user.id).maybeSingle()
        if (lawyerResult.data) {
          setInfoLink('/lawyer-info')
          setIsLawyerAccount(true)
        } else {
          const firmResult = await supabase.from('firms').select('id').eq('user_id', user.id).maybeSingle()
          if (firmResult.data) {
            setInfoLink('/firm-info')
            setIsFirmAccount(true)
          }
        }
      }

      setCheckingAuth(false)
    }

    checkAccount()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    setLoggedIn(false)
    setMenuOpen(false)
    router.push('/')
  }

  function toggleMenu() {
    setMenuOpen(!menuOpen)
  }

  function getOrderLabel() {
    if (type === 'subscription') {
      if (tier === 'monthly') return 'اشتراك شهري'
      if (tier === 'yearly') return 'اشتراك سنوي'
      if (tier === '5year') return 'اشتراك 5 سنوات'
      return 'اشتراك'
    }
    if (type === 'featured') return 'إعلان مميز - شهر واحد'
    return 'عملية دفع'
  }

  function formatCardNumber(value: string) {
    const digitsOnly = value.replace(/\D/g, '').slice(0, 16)
    const groups = []
    for (let i = 0; i < digitsOnly.length; i += 4) {
      groups.push(digitsOnly.slice(i, i + 4))
    }
    return groups.join(' ')
  }

  function handleCardNumberChange(e: React.ChangeEvent<HTMLInputElement>) {
    setCardNumber(formatCardNumber(e.target.value))
  }

  async function handlePay(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!cardName.trim() || cardNumber.replace(/\s/g, '').length < 16 || !expiry || cvv.length < 3) {
      setError('يرجى تعبئة جميع بيانات البطاقة بشكل صحيح')
      return
    }

    setProcessing(true)

    await new Promise(function (resolve) { setTimeout(resolve, 1200) })

    if (type === 'subscription') {
      const today = new Date()
      let nextBillingDate = new Date(today)

      if (tier === 'monthly') {
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1)
      } else if (tier === 'yearly') {
        nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1)
      } else {
        nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 5)
      }

      const startedAtStr = today.toISOString().split('T')[0]
      const nextBillingStr = nextBillingDate.toISOString().split('T')[0]

      await supabase.from('subscriptions').insert({
        account_type: accountType,
        account_id: accountId,
        tier: tier,
        status: 'active',
        started_at: startedAtStr,
        next_billing_date: nextBillingStr,
        price: amount,
      })

      await supabase.from('payments').insert({
        payment_type: 'subscription',
        amount: amount,
        related_id: accountId,
        status: 'completed',
      })

      const tableName = accountType === 'lawyer' ? 'lawyers' : 'firms'

      await supabase
        .from(tableName)
        .update({ subscription_tier: tier, is_active: true })
        .eq('id', accountId)
    }

    if (type === 'featured') {
      const today = new Date()
      const featuredUntilDate = new Date(today)
      featuredUntilDate.setMonth(featuredUntilDate.getMonth() + 1)
      const featuredUntilStr = featuredUntilDate.toISOString().split('T')[0]
      const tableName = accountType === 'lawyer' ? 'lawyers' : 'firms'

      await supabase
        .from(tableName)
        .update({ is_featured: true, featured_until: featuredUntilStr })
        .eq('id', accountId)

      await supabase.from('payments').insert({
        payment_type: 'featured_listing',
        amount: amount,
        related_id: accountId,
        status: 'completed',
      })
    }

    setProcessing(false)
    setSuccess(true)
  }

  function renderNavAndHeader(title: string) {
    return (
      <div className="bg-[#1B1A17] text-[#F3EEE4] py-8 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-6 font-['Tajawal'] text-sm">
            <a href="/">
              <img src="/logo.png" alt="حمورابي" className="h-10 w-auto" />
            </a>
            <div className="flex gap-4 items-center">
              <a href="/my-appointments" className="hover:text-[#AD8A4E] transition">مواعيدي</a>
              <a href="/my-consultations" className="hover:text-[#AD8A4E] transition">استشاراتي</a>
              <a href="/ai-assistant" className="hover:text-[#AD8A4E] transition">مساعد ذكي</a>
              {isLawyerAccount && (
                <a href="/lawyer-tools" className="hover:text-[#AD8A4E] transition">أدواتي</a>
              )}
              {isFirmAccount && (
                <a href="/firm-dashboard" className="hover:text-[#AD8A4E] transition">أدواتي</a>
              )}
              {(isLawyerAccount || isFirmAccount) && (
                <a href="/community" className="hover:text-[#AD8A4E] transition">المجتمع</a>
              )}
              {(isLawyerAccount || isFirmAccount) && (
                <a href="/lawyer-messages" className="hover:text-[#AD8A4E] transition">الرسائل</a>
              )}

              {!checkingAuth && loggedIn && (
                <div className="relative">
                  <button onClick={toggleMenu} className="w-7 h-7 rounded-full bg-[#AD8A4E] flex items-center justify-center hover:bg-[#c49b58] transition">
                    <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.5c-3.3 0-9.8 1.6-9.8 4.9v2.4h19.6v-2.4c0-3.3-6.5-4.9-9.8-4.9z" />
                    </svg>
                  </button>
                  {menuOpen && (
                    <div className="absolute left-0 top-full mt-2 w-52 bg-white border border-[#D8D2C4] rounded-md shadow-lg overflow-hidden z-20">
                      {infoLink && (
                        <a href={infoLink} className="block px-4 py-3 font-['Tajawal'] text-sm text-[#1B1A17] hover:bg-[#F3EEE4] transition">
                          معلوماتي الشخصية
                        </a>
                      )}
                      <button onClick={handleLogout} className="w-full text-right px-4 py-3 font-['Tajawal'] text-sm text-[#7A2E2E] hover:bg-[#F3EEE4] transition border-t border-[#D8D2C4]">
                        تسجيل الخروج
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <h1 className="font-['Tajawal'] font-bold text-3xl">{title}</h1>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div dir="rtl" className="min-h-screen pattern-bg">
        {renderNavAndHeader('تم الدفع بنجاح')}
        <div className="flex items-center justify-center px-6 py-16">
          <div className="text-center max-w-md">
            <div className="bg-white border-2 border-[#2F4538] rounded-lg p-8">
              <h1 className="font-['Amiri'] text-2xl text-[#1B1A17] mb-3">تم الدفع بنجاح</h1>
              <p className="font-['Tajawal'] text-sm text-[#4A473F] mb-6">تم تفعيل {getOrderLabel()} على حسابك</p>
              <a href="/subscription" className="inline-block px-6 py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal']">
                العودة إلى الاشتراك
              </a>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div dir="rtl" className="min-h-screen pattern-bg">
      {renderNavAndHeader('إتمام الدفع')}

      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-6">
            <p className="font-['Tajawal'] text-sm text-[#4A473F] mb-1">ملخص الطلب</p>
            <div className="flex justify-between items-center">
              <p className="font-['Tajawal'] font-bold text-[#1B1A17]">{getOrderLabel()}</p>
              <p className="font-['Tajawal'] font-bold text-xl text-[#1B1A17]">{amount} د.أ</p>
            </div>
          </div>

          <form onSubmit={handlePay} className="bg-white border border-[#D8D2C4] rounded-lg p-6">
            <h2 className="font-['Tajawal'] font-bold text-[#1B1A17] mb-4">بيانات البطاقة</h2>

            <div className="space-y-3">
              <div>
                <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-1">اسم حامل البطاقة</label>
                <input
                  type="text"
                  value={cardName}
                  onChange={function (e) { setCardName(e.target.value) }}
                  className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
                />
              </div>

              <div>
                <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-1">رقم البطاقة</label>
                <input
                  type="text"
                  value={cardNumber}
                  onChange={handleCardNumberChange}
                  placeholder="0000 0000 0000 0000"
                  className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
                  dir="ltr"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-1">تاريخ الانتهاء</label>
                  <input
                    type="text"
                    value={expiry}
                    onChange={function (e) { setExpiry(e.target.value) }}
                    placeholder="MM/YY"
                    className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-1">CVV</label>
                  <input
                    type="text"
                    value={cvv}
                    onChange={function (e) { setCvv(e.target.value.replace(/\D/g, '').slice(0, 4)) }}
                    placeholder="123"
                    className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
                    dir="ltr"
                  />
                </div>
              </div>
            </div>

            {error && (
              <p className="mt-3 font-['Tajawal'] text-sm text-[#7A2E2E]">{error}</p>
            )}

            <button
              type="submit"
              disabled={processing}
              className="w-full mt-5 py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal'] font-medium hover:bg-[#AD8A4E] transition disabled:opacity-60"
            >
              {processing ? 'جاري معالجة الدفع...' : 'ادفع ' + amount + ' د.أ'}
            </button>

            <p className="mt-3 text-center font-['Tajawal'] text-xs text-[#4A473F]">🔒 دفع آمن ومشفر</p>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div dir="rtl" className="min-h-screen pattern-bg flex items-center justify-center"><p className="font-['Tajawal'] text-[#4A473F]">جاري التحميل...</p></div>}>
      <CheckoutContent />
    </Suspense>
  )
}