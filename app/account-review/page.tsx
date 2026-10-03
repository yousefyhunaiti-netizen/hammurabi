'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'
import { lawyerStage, firmStage, stagePath, AccountStage } from '../lib/accountStage'
import OnboardingSteps from '../components/OnboardingSteps'
import HeaderLines from '../components/HeaderLines'
import Loader from '../components/Loader'
import Footer from '../components/Footer'

// Step ٢ for new lawyers and firms: their details are with the Hammurabi team.
export default function AccountReviewPage() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [accountType, setAccountType] = useState<'lawyer' | 'firm'>('lawyer')

  useEffect(function () {
    async function load() {
      const userResult = await supabase.auth.getUser()
      if (!userResult.data.user) {
        router.replace('/login')
        return
      }
      const userId = userResult.data.user.id

      let stage: AccountStage = 'ready'
      let type: 'lawyer' | 'firm' = 'lawyer'

      const lawyerResult = await supabase.from('lawyers').select('needs_onboarding, bar_certificate_number, specialty_id, city, is_approved, is_active, is_comped, country, license_file_url').eq('user_id', userId).maybeSingle()
      if (lawyerResult.data) {
        stage = lawyerStage(lawyerResult.data)
      } else {
        const firmResult = await supabase.from('firms').select('needs_onboarding, city, address, phone, is_approved, is_active, is_comped').eq('user_id', userId).maybeSingle()
        if (!firmResult.data) {
          router.replace('/')
          return
        }
        type = 'firm'
        stage = firmStage(firmResult.data)
      }

      if (stage !== 'review') {
        router.replace(stagePath(type, stage))
        return
      }

      setAccountType(type)
      setLoading(false)
    }
    load()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div dir="rtl" className="min-h-screen pattern-bg flex items-center justify-center">
        <Loader />
      </div>
    )
  }

  return (
    <div dir="rtl" className="min-h-screen pattern-bg flex flex-col">
      <div className="hm-header bg-[#1B1A17] text-[#F3EEE4] py-12 px-6">
        <HeaderLines />
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-8 font-['Tajawal'] text-sm">
            <a href="/"><img src="/logo.png" alt="حمورابي" className="h-12 w-auto" /></a>
            <button onClick={handleLogout} className="text-[#D8D2C4] hover:text-[#AD8A4E] transition">تسجيل الخروج</button>
          </div>
          <h1 className="font-['Tajawal'] font-bold text-4xl mb-2">حسابك قيد المراجعة</h1>
          <div className="w-16 h-[2px] bg-[#AD8A4E]"></div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-12 flex-1 w-full">
        <OnboardingSteps current={2} />

        <div className="bg-white border border-[#D8D2C4] rounded-2xl p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-[#1B1A17] flex items-center justify-center">
            <svg className="w-8 h-8 text-[#AD8A4E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
          </div>
          <p className="font-['Tajawal'] font-bold text-xl text-[#1B1A17] mb-3 leading-relaxed">
            حسابك قيد المراجعة، سنعود إليك خلال 48 ساعة عبر البريد الإلكتروني
          </p>
          <p className="font-['Tajawal'] text-sm text-[#4A473F] leading-relaxed mb-6">
            يراجع فريق حمورابي {accountType === 'firm' ? 'معلومات المكتب' : 'معلوماتك والرقم النقابي'}. عند تأكيد حسابك تصلك رسالة «تم تأكيد حسابك» برابط لاختيار باقة الاشتراك.
          </p>
          <a href={accountType === 'firm' ? '/firm-dashboard' : '/lawyer-dashboard'} className="inline-block px-6 py-3 bg-[#F3EEE4] text-[#1B1A17] rounded-md font-['Tajawal'] text-sm hover:bg-[#EDE6D8] transition">
            تعديل معلوماتي
          </a>
        </div>
      </div>

      <Footer variant={accountType} />
    </div>
  )
}
