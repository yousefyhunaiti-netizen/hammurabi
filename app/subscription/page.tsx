'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'
import Footer from '../components/Footer'

type AccountInfo = {
  id: number
  is_approved: boolean | null
  is_comped: boolean | null
  is_active: boolean | null
  subscription_tier: string | null
}

const tierLabels: { [key: string]: string } = {
  monthly: 'شهري',
  yearly: 'سنوي',
  '5year': '5 سنوات',
}

export default function SubscriptionPage() {
  const [loading, setLoading] = useState(true)
  const [accountType, setAccountType] = useState('')
  const [account, setAccount] = useState<AccountInfo | null>(null)
  const [notAllowed, setNotAllowed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [totalUnread, setTotalUnread] = useState(0)
  const [pendingConsultations, setPendingConsultations] = useState(0)

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

  function countConversations(rows: any[]) {
    const senders = new Set(rows.map(function (m) {
      return m.sender_lawyer_id ? 'lawyer-' + m.sender_lawyer_id : 'firm-' + m.sender_firm_id
    }))
    return senders.size
  }

  useEffect(function () {
    async function loadData() {
      const userResult = await supabase.auth.getUser()

      if (!userResult.data.user) {
        setLoading(false)
        setNotAllowed(true)
        return
      }

      const userId = userResult.data.user.id

      const lawyerResult = await supabase.from('lawyers').select('id, is_approved, is_comped, is_active, subscription_tier').eq('user_id', userId).maybeSingle()

      if (lawyerResult.data) {
        setAccountType('lawyer')
        setAccount(lawyerResult.data)

        const unreadResult = await supabase.from('lawyer_messages').select('sender_lawyer_id, sender_firm_id').eq('recipient_lawyer_id', lawyerResult.data.id).eq('is_read', false)
        setTotalUnread(countConversations(unreadResult.data || []))

        const pendingResult = await supabase.from('consultations').select('id', { count: 'exact', head: true }).eq('lawyer_id', lawyerResult.data.id).eq('status', 'pending')
        setPendingConsultations(pendingResult.count || 0)

        setLoading(false)
        return
      }

      const firmResult = await supabase.from('firms').select('id, is_approved, is_comped, is_active, subscription_tier').eq('user_id', userId).maybeSingle()

      if (firmResult.data) {
        setAccountType('firm')
        setAccount(firmResult.data)

        const firmUnreadResult = await supabase.from('lawyer_messages').select('sender_lawyer_id, sender_firm_id').eq('recipient_firm_id', firmResult.data.id).eq('is_read', false)
        setTotalUnread(countConversations(firmUnreadResult.data || []))

        const rosterResult = await supabase.from('lawyers').select('id').eq('firm_id', firmResult.data.id)
        const rosterIds = (rosterResult.data || []).map(function (l) { return l.id })
        let pendingFilter = 'firm_id.eq.' + firmResult.data.id
        if (rosterIds.length > 0) {
          pendingFilter = pendingFilter + ',lawyer_id.in.(' + rosterIds.join(',') + ')'
        }
        const firmPendingResult = await supabase.from('consultations').select('id', { count: 'exact', head: true }).eq('status', 'pending').or(pendingFilter)
        setPendingConsultations(firmPendingResult.count || 0)

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
        { key: 'monthly', label: 'شهري', price: 50, per: 'شهرياً' },
        { key: 'yearly', label: 'سنوي', price: 450, per: 'سنوياً', note: 'وفّر ما يعادل شهرين ونصف' },
        { key: '5year', label: '5 سنوات', price: 750, per: 'لمرة واحدة', note: 'الأفضل قيمة على المدى الطويل' },
      ]
    : [
        { key: 'monthly', label: 'شهري', price: 20, per: 'شهرياً' },
        { key: 'yearly', label: 'سنوي', price: 180, per: 'سنوياً', note: 'وفّر ما يعادل شهرين' },
        { key: '5year', label: '5 سنوات', price: 300, per: 'لمرة واحدة', note: 'الأفضل قيمة على المدى الطويل' },
      ]

  const featureList = accountType === 'firm'
    ? ['إدارة كامل فريق المكتب', 'أدواتي والفواتير والمالية', 'المجتمع والمراسلة المباشرة', 'ظهور المكتب في دليل حمورابي']
    : ['الوصول لجميع أدواتك القانونية', 'الفواتير والمالية والأجندة', 'المجتمع والمراسلة المباشرة', 'ظهورك في دليل المحامين']

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
            <h1 className="font-['Tajawal'] font-bold text-2xl text-[#1B1A17] mb-3">قيد المراجعة</h1>
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
            <h1 className="font-['Tajawal'] font-bold text-2xl text-[#1B1A17] mb-3">حساب مجاني</h1>
            <p className="font-['Tajawal'] text-sm text-[#4A473F] leading-relaxed">حسابك مفعّل مجاناً من قبل فريق حمورابي، ولا حاجة للاشتراك.</p>
          </div>
        </div>
      </div>
    )
  }

  const currentTierLabel = account && account.subscription_tier ? (tierLabels[account.subscription_tier] || account.subscription_tier) : null

  return (
    <div dir="rtl" className="min-h-screen pattern-bg flex flex-col">
      <div className="bg-[#1B1A17] text-[#F3EEE4] py-12 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-8 font-['Tajawal'] text-sm">
            <a href="/"><img src="/logo.png" alt="حمورابي" className="h-12 w-auto" /></a>
            <div className="flex gap-5 items-center">
              {accountType === 'firm' && (
                <a href="/firm-dashboard" className="hover:text-[#AD8A4E] transition">لوحة التحكم</a>
              )}
              <a href="/lawyer-tools" className="hover:text-[#AD8A4E] transition">أدواتي</a>
              <a href="/ai-assistant" className="hover:text-[#AD8A4E] transition">مساعد ذكي</a>
              <a href="/community" className="hover:text-[#AD8A4E] transition">المجتمع</a>
              <a href="/lawyer-messages" className="relative hover:text-[#AD8A4E] transition">
                <svg className="w-5 h-5 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
                {totalUnread > 0 && (
                  <span className="absolute -top-2 -left-2 bg-[#7A2E2E] text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{totalUnread}</span>
                )}
              </a>
              <div className="relative" ref={menuRef}>
                <button onClick={toggleMenu} className="relative w-8 h-8 rounded-full bg-[#AD8A4E] flex items-center justify-center hover:bg-[#c49b58] transition">
                  <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.5c-3.3 0-9.8 1.6-9.8 4.9v2.4h19.6v-2.4c0-3.3-6.5-4.9-9.8-4.9z" /></svg>
                  {pendingConsultations > 0 && (
                    <span className="absolute -top-1 -left-1 bg-[#7A2E2E] text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{pendingConsultations}</span>
                  )}
                </button>
                {menuOpen && (
                  <div className="absolute left-0 top-full mt-2 w-52 bg-white border border-[#D8D2C4] rounded-md shadow-lg overflow-hidden z-20">
                    <a href="/subscription" className="text-[#AD8A4E] block px-4 py-3 font-['Tajawal'] text-sm hover:bg-[#F3EEE4] transition">ترقية الاشتراك</a>
                    <a href={accountType === 'firm' ? '/firm-info' : '/lawyer-info'} className="block px-4 py-3 font-['Tajawal'] text-sm text-[#1B1A17] hover:bg-[#F3EEE4] transition border-t border-[#D8D2C4]">معلوماتي الشخصية</a>
                    <a href="/lawyer-history" className="relative block px-4 py-3 font-['Tajawal'] text-sm text-[#1B1A17] hover:bg-[#F3EEE4] transition border-t border-[#D8D2C4]">
                      المواعيد والاستشارات
                      {pendingConsultations > 0 && (
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 bg-[#7A2E2E] text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{pendingConsultations}</span>
                      )}
                    </a>
                    <button onClick={handleLogout} className="w-full text-right px-4 py-3 font-['Tajawal'] text-sm text-[#7A2E2E] hover:bg-[#F3EEE4] transition border-t border-[#D8D2C4]">تسجيل الخروج</button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <h1 className="font-['Tajawal'] font-bold text-4xl mb-2">الاشتراك</h1>
          <p className="font-['Tajawal'] text-sm text-[#D8D2C4]">
            {currentTierLabel ? 'باقتك الحالية: ' + currentTierLabel : 'اختر الباقة المناسبة لك للوصول إلى جميع أدوات حمورابي'}
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12 flex-1 w-full">
        <div className="bg-white border border-[#D8D2C4] rounded-lg p-5 mb-8">
          <p className="font-['Tajawal'] font-bold text-sm text-[#1B1A17] mb-3">كل باقة تشمل:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            {featureList.map(function (feature) {
              return (
                <div key={feature} className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-[#2F4538] flex items-center justify-center flex-shrink-0">
                    <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  <p className="font-['Tajawal'] text-sm text-[#4A473F]">{feature}</p>
                </div>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
                    {tiers.map(function (tier) {
            const isRecommended = tier.key === 'yearly'
            const isCurrent = account && account.subscription_tier === tier.key

            function selectClick() {
              handleSelectTier(tier.key, tier.price)
            }

            return (
              <div
                key={tier.key}
                className={"relative bg-white rounded-2xl p-6 text-center flex flex-col h-full " + (isRecommended ? 'border-2 border-[#AD8A4E] shadow-lg md:-translate-y-2' : 'border border-[#D8D2C4]')}
              >
                {isRecommended && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#AD8A4E] text-white text-xs font-['Tajawal'] rounded-full whitespace-nowrap">
                    الأكثر اختياراً
                  </span>
                )}

                <h3 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mt-2 mb-1">{tier.label}</h3>

                <div className="mb-1">
                  <span className="font-['Tajawal'] font-bold text-4xl text-[#1B1A17]">{tier.price}</span>
                  <span className="font-['Tajawal'] text-sm text-[#4A473F]"> د.أ</span>
                </div>
                <p className="font-['Tajawal'] text-xs text-[#4A473F] mb-4">{tier.per}</p>

                <div className="h-10 flex items-center justify-center mb-4">
                  {tier.note && (
                    <p className="font-['Tajawal'] text-xs text-[#AD8A4E] bg-[#F3EEE4] rounded-full px-3 py-1 inline-block">{tier.note}</p>
                  )}
                </div>

                <div className="mt-auto pt-2">
                  {isCurrent ? (
                    <span className="block w-full py-3 bg-[#F3EEE4] text-[#4A473F] rounded-md font-['Tajawal'] font-medium">باقتك الحالية</span>
                  ) : (
                    <button
                      onClick={selectClick}
                      className={"w-full py-3 rounded-md font-['Tajawal'] font-medium transition " + (isRecommended ? 'bg-[#AD8A4E] text-white hover:bg-[#c49b58]' : 'bg-[#1B1A17] text-white hover:bg-[#AD8A4E]')}
                    >
                      اشترك الآن
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

      </div>

      <Footer variant={accountType === 'firm' ? 'firm' : 'lawyer'} />
    </div>
  )
}