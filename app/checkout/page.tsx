'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'
import Footer from '../components/Footer'

function CheckoutContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const supabase = createClient()

  const type = searchParams.get('type') || ''
  const tier = searchParams.get('tier') || ''
  const amount = Number(searchParams.get('amount') || '0')
  const accountType = searchParams.get('accountType') || ''
  const accountId = Number(searchParams.get('accountId') || '0')

  const [isLawyerAccount, setIsLawyerAccount] = useState(false)
  const [isFirmAccount, setIsFirmAccount] = useState(false)

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
        const lawyerResult = await supabase.from('lawyers').select('id').eq('user_id', user.id).maybeSingle()
        if (lawyerResult.data) {
          setIsLawyerAccount(true)
        } else {
          const firmResult = await supabase.from('firms').select('id').eq('user_id', user.id).maybeSingle()
          if (firmResult.data) {
            setIsFirmAccount(true)
          }
        }
      }
    }

    checkAccount()
  }, [])

  function getFooterVariant(): 'customer' | 'lawyer' | 'firm' {
    if (isLawyerAccount) return 'lawyer'
    if (isFirmAccount) return 'firm'
    return 'customer'
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
      // PLACEHOLDER until PayTabs / Arab Bank: the database activates the
      // logged-in account's own plan and sets the price itself, so the
      // browser can't choose a price or activate someone else's account.
      const activateResult = await supabase.rpc('checkout_activate_subscription', { p_tier: tier })

      if (activateResult.error) {
        setProcessing(false)
        setError('تعذر تفعيل الاشتراك، حاول مرة أخرى')
        return
      }
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
      <div className="bg-[#1B1A17] text-[#F3EEE4] py-12 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-8 font-['Tajawal'] text-sm">
            <a href="/">
              <img src="/logo.png" alt="حمورابي" className="h-12 w-auto" />
            </a>
            <a href="/subscription" className="px-4 py-2 bg-white/10 border border-white/20 rounded-md hover:bg-white/20 transition">
              ← العودة للاشتراك
            </a>
          </div>
          <h1 className="font-['Tajawal'] font-bold text-4xl">{title}</h1>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div dir="rtl" className="min-h-screen pattern-bg flex flex-col">
        {renderNavAndHeader('تم الدفع بنجاح')}
        <div className="flex-1 flex items-center justify-center px-6 py-16">
          <div className="text-center max-w-md">
            <div className="bg-white border-2 border-[#2F4538] rounded-lg p-8">
              <h1 className="font-['Tajawal'] font-bold text-2xl text-[#1B1A17] mb-3">تم الدفع بنجاح</h1>
              <p className="font-['Tajawal'] text-sm text-[#4A473F] mb-6">تم تفعيل {getOrderLabel()} على حسابك</p>
              <a href="/subscription" className="inline-block px-6 py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal']">
                العودة إلى الاشتراك
              </a>
            </div>
          </div>
        </div>
        <Footer variant={getFooterVariant()} />
      </div>
    )
  }

  return (
    <div dir="rtl" className="min-h-screen pattern-bg flex flex-col">
      {renderNavAndHeader('إتمام الدفع')}

      <div className="flex-1 flex items-center justify-center px-6 py-12">
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

      <Footer variant={getFooterVariant()} />
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