'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase'

type AccountInfo = {
  id: number
  type: string
  isApproved: boolean
  currentTier: string | null
  isFeatured: boolean
  featuredUntil: string | null
  specialtyId: number | null
  isComped: boolean
}

const individualTiers = [
  { id: 'monthly', label: 'شهري', price: 20, totalLabel: '20 د.أ / شهرياً' },
  { id: 'yearly', label: 'سنوي', price: 180, totalLabel: '180 د.أ / سنوياً (15 د.أ شهرياً)' },
  { id: '5year', label: '5 سنوات', price: 300, totalLabel: '300 د.أ لمدة 5 سنوات (5 د.أ شهرياً)' },
]

const firmTiers = [
  { id: 'monthly', label: 'شهري', price: 50, totalLabel: '50 د.أ / شهرياً' },
  { id: 'yearly', label: 'سنوي', price: 450, totalLabel: '450 د.أ / سنوياً (37.5 د.أ شهرياً)' },
  { id: '5year', label: '5 سنوات', price: 750, totalLabel: '750 د.أ لمدة 5 سنوات (12.5 د.أ شهرياً)' },
]

export default function SubscriptionPage() {
  const [loading, setLoading] = useState(true)
  const [account, setAccount] = useState<AccountInfo | null>(null)
  const [notEligible, setNotEligible] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [message, setMessage] = useState('')
  const [featuredLoading, setFeaturedLoading] = useState(false)
  const [featuredMessage, setFeaturedMessage] = useState('')

  const supabase = createClient()

  useEffect(function () {
    async function loadData() {
      const userResult = await supabase.auth.getUser()

      if (!userResult.data.user) {
        setNotEligible(true)
        setLoading(false)
        return
      }

      const user = userResult.data.user

      const lawyerResult = await supabase
        .from('lawyers')
        .select('id, is_approved, subscription_tier, firm_id, is_featured, featured_until, specialty_id, is_comped')
        .eq('user_id', user.id)
        .maybeSingle()

      if (lawyerResult.data && !lawyerResult.data.firm_id) {
        setAccount({
          id: lawyerResult.data.id,
          type: 'lawyer',
          isApproved: lawyerResult.data.is_approved === true,
          currentTier: lawyerResult.data.subscription_tier,
          isFeatured: lawyerResult.data.is_featured === true,
          featuredUntil: lawyerResult.data.featured_until,
          specialtyId: lawyerResult.data.specialty_id,
          isComped: lawyerResult.data.is_comped === true,
        })
        setLoading(false)
        return
      }

      const firmResult = await supabase
        .from('firms')
        .select('id, is_approved, subscription_tier, is_featured, featured_until, is_comped')
        .eq('user_id', user.id)
        .maybeSingle()

      if (firmResult.data) {
        setAccount({
          id: firmResult.data.id,
          type: 'firm',
          isApproved: firmResult.data.is_approved === true,
          currentTier: firmResult.data.subscription_tier,
          isFeatured: firmResult.data.is_featured === true,
          featuredUntil: firmResult.data.featured_until,
          specialtyId: null,
          isComped: firmResult.data.is_comped === true,
        })
        setLoading(false)
        return
      }

      setNotEligible(true)
      setLoading(false)
    }

    loadData()
  }, [])

  async function handleSelectTier(tierId: string, price: number) {
    if (!account) return
    setSelecting(true)
    setMessage('')

    const today = new Date()
    let nextBillingDate = new Date(today)

    if (tierId === 'monthly') {
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1)
    } else if (tierId === 'yearly') {
      nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1)
    } else {
      nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 5)
    }

    const startedAtStr = today.toISOString().split('T')[0]
    const nextBillingStr = nextBillingDate.toISOString().split('T')[0]

    await supabase.from('subscriptions').insert({
      account_type: account.type,
      account_id: account.id,
      tier: tierId,
      status: 'active',
      started_at: startedAtStr,
      next_billing_date: nextBillingStr,
      price: price,
    })

    await supabase.from('payments').insert({
      payment_type: 'subscription',
      amount: price,
      related_id: account.id,
      status: 'completed',
    })

    const tableName = account.type === 'lawyer' ? 'lawyers' : 'firms'

    await supabase
      .from(tableName)
      .update({ subscription_tier: tierId, is_active: true })
      .eq('id', account.id)

    setSelecting(false)
    setMessage('تم تفعيل الاشتراك بنجاح!')
    setAccount(Object.assign({}, account, { currentTier: tierId }))
  }

  async function handleFeaturePurchase() {
    if (!account) return
    setFeaturedLoading(true)
    setFeaturedMessage('')

    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]

    if (account.type === 'lawyer') {
      const specId = account.specialtyId

      const featuredResult = await supabase
        .from('lawyers')
        .select('id')
        .eq('is_featured', true)
        .eq('specialty_id', specId)
        .gte('featured_until', todayStr)

      const currentCount = featuredResult.data ? featuredResult.data.length : 0

      if (currentCount >= 5) {
        setFeaturedLoading(false)
        setFeaturedMessage('عذراً، امتلأت جميع الأماكن المميزة لهذا التخصص حالياً')
        return
      }
    } else {
      const featuredFirmsResult = await supabase
        .from('firms')
        .select('id')
        .eq('is_featured', true)
        .gte('featured_until', todayStr)

      const currentCount = featuredFirmsResult.data ? featuredFirmsResult.data.length : 0

      if (currentCount >= 5) {
        setFeaturedLoading(false)
        setFeaturedMessage('عذراً، امتلأت جميع الأماكن المميزة حالياً')
        return
      }
    }

    const featuredUntilDate = new Date(today)
    featuredUntilDate.setMonth(featuredUntilDate.getMonth() + 1)
    const featuredUntilStr = featuredUntilDate.toISOString().split('T')[0]
    const price = account.type === 'lawyer' ? 50 : 120
    const tableName = account.type === 'lawyer' ? 'lawyers' : 'firms'

    await supabase
      .from(tableName)
      .update({ is_featured: true, featured_until: featuredUntilStr })
      .eq('id', account.id)

    await supabase.from('payments').insert({
      payment_type: 'featured_listing',
      amount: price,
      related_id: account.id,
      status: 'completed',
    })

    setFeaturedLoading(false)
    setFeaturedMessage('تم تفعيل الإعلان المميز بنجاح، ساري حتى ' + featuredUntilStr)
    setAccount(Object.assign({}, account, { isFeatured: true, featuredUntil: featuredUntilStr }))
  }

  function renderTierCard(tier: { id: string; label: string; price: number; totalLabel: string }) {
    const isCurrent = account && account.currentTier === tier.id

    function selectClick() {
      handleSelectTier(tier.id, tier.price)
    }

    return (
      <div key={tier.id} className="bg-white border border-[#D8D2C4] rounded-lg p-6 text-center">
        <h3 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mb-2">{tier.label}</h3>
        <p className="font-['Tajawal'] text-sm text-[#4A473F] mb-6">{tier.totalLabel}</p>
        <button
          onClick={selectClick}
          disabled={selecting || Boolean(isCurrent)}
          className={
            "w-full py-3 rounded-md font-['Tajawal'] font-medium transition disabled:opacity-60 " +
            (isCurrent ? 'bg-[#2F4538] text-white' : 'bg-[#1B1A17] text-[#F3EEE4] hover:bg-[#AD8A4E]')
          }
        >
          {isCurrent ? 'الخطة الحالية' : selecting ? 'جاري التفعيل...' : 'اختر هذه الخطة'}
        </button>
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

  if (notEligible || !account) {
    return (
      <div dir="rtl" className="min-h-screen pattern-bg flex items-center justify-center px-6">
        <div className="text-center">
          <p className="font-['Tajawal'] text-[#4A473F] mb-4">هذه الصفحة مخصصة لحسابات المحامين والمكاتب فقط</p>
          <a href="/login" className="inline-block px-6 py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal']">تسجيل الدخول</a>
        </div>
      </div>
    )
  }

  if (account.isComped) {
    return (
      <div dir="rtl" className="min-h-screen pattern-bg flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="bg-white border-2 border-[#AD8A4E] rounded-lg p-8">
            <h1 className="font-['Amiri'] text-2xl text-[#1B1A17] mb-3">حساب مجاني</h1>
            <p className="font-['Tajawal'] text-sm text-[#4A473F] leading-relaxed">
              تم منحك حساباً مجانياً من إدارة حمورابي، ملفك ظاهر ونشط على المنصة بدون رسوم اشتراك.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!account.isApproved) {
    return (
      <div dir="rtl" className="min-h-screen pattern-bg flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="bg-white border border-[#D8D2C4] rounded-lg p-8">
            <h1 className="font-['Amiri'] text-2xl text-[#1B1A17] mb-3">قيد المراجعة</h1>
            <p className="font-['Tajawal'] text-sm text-[#4A473F] leading-relaxed">
              شكراً لتسجيلك في حمورابي. حسابك قيد المراجعة حالياً من فريقنا للتأكد من صحة بيانات الترخيص، وسيتم إعلامك عند اكتمال المراجعة خلال 24 ساعة. بعد الموافقة يمكنك اختيار خطة الاشتراك والظهور على المنصة.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const tiers = account.type === 'firm' ? firmTiers : individualTiers
  const featuredPrice = account.type === 'lawyer' ? 50 : 120

  return (
    <div dir="rtl" className="min-h-screen pattern-bg">
      <div className="bg-[#1B1A17] text-[#F3EEE4] py-12 px-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="font-['Amiri'] text-4xl mb-2">خطط الاشتراك</h1>
          <div className="w-16 h-[2px] bg-[#AD8A4E]"></div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {tiers.map(renderTierCard)}
        </div>

        {message && (
          <p className="text-center font-['Tajawal'] text-sm text-[#2F4538] mb-10">{message}</p>
        )}

        <div className="bg-white border-2 border-[#AD8A4E] rounded-lg p-6">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17]">إعلان مميز</h2>
            <span className="px-3 py-1 bg-[#AD8A4E] text-white text-xs font-['Tajawal'] rounded-full">إعلان</span>
          </div>
          <p className="font-['Tajawal'] text-sm text-[#4A473F] mb-4">
            اجعل ملفك من ضمن أول 5 نتائج مميزة في تخصصك لمدة شهر كامل مقابل {featuredPrice} د.أ
          </p>

          {account.isFeatured && (
            <p className="font-['Tajawal'] text-sm text-[#2F4538] mb-3">
              إعلانك المميز ساري حتى {account.featuredUntil}
            </p>
          )}

          <button
            onClick={handleFeaturePurchase}
            disabled={featuredLoading}
            className="w-full py-3 bg-[#AD8A4E] text-white rounded-md font-['Tajawal'] font-medium hover:bg-[#c49b58] transition disabled:opacity-60"
          >
            {featuredLoading ? 'جاري التفعيل...' : account.isFeatured ? 'تجديد لمدة شهر إضافي' : 'فعّل الإعلان المميز'}
          </button>

          {featuredMessage && (
            <p className="mt-3 font-['Tajawal'] text-sm text-[#2F4538]">{featuredMessage}</p>
          )}
        </div>
      </div>
    </div>
  )
}