'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from './lib/supabase'

export default function HomePage() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [infoLink, setInfoLink] = useState('')
  const [isLawyerAccount, setIsLawyerAccount] = useState(false)
  const [isFirmAccount, setIsFirmAccount] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [lawyerCount, setLawyerCount] = useState(0)
  const [specialtyCount, setSpecialtyCount] = useState(0)
  const [cityCount, setCityCount] = useState(0)

  const supabase = createClient()
  const router = useRouter()

  useEffect(function () {
    async function loadData() {
      const userResult = await supabase.auth.getUser()
      const user = userResult.data.user

      if (user) {
        setLoggedIn(true)

        const customerResult = await supabase.from('customers').select('id').eq('user_id', user.id).maybeSingle()
        if (customerResult.data) {
          setInfoLink('/my-info')
        } else {
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
      }

      setCheckingAuth(false)

      const lawyersCountResult = await supabase.from('lawyers').select('id, city', { count: 'exact' }).eq('is_approved', true).eq('is_active', true)
      const specialtiesCountResult = await supabase.from('specialties').select('id', { count: 'exact', head: true })

      setLawyerCount(lawyersCountResult.count || 0)
      setSpecialtyCount(specialtiesCountResult.count || 0)

      const uniqueCities = new Set((lawyersCountResult.data || []).map(function (l) { return l.city }).filter(Boolean))
      setCityCount(uniqueCities.size)
    }

    loadData()
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

  const navLinkClass = "font-['Tajawal'] text-sm hover:text-[#AD8A4E] transition whitespace-nowrap"
  const navLoginClass = "px-5 py-2 font-['Tajawal'] text-sm border border-[#F3EEE4] rounded-md hover:bg-[#F3EEE4] hover:text-[#1B1A17] transition"
  const navSignupClass = "px-5 py-2 font-['Tajawal'] text-sm bg-[#AD8A4E] rounded-md hover:bg-[#c49b58] transition"
  const heroCtaClass = "inline-block px-8 py-4 bg-[#AD8A4E] text-white font-['Tajawal'] font-medium rounded-md hover:bg-[#c49b58] transition"
  const heroCtaOutlineClass = "inline-block px-8 py-4 border border-[#F3EEE4] text-[#F3EEE4] font-['Tajawal'] font-medium rounded-md hover:bg-[#F3EEE4] hover:text-[#1B1A17] transition"

  return (
    <div dir="rtl" className="min-h-screen pattern-bg">
      <div className="bg-[#1B1A17] text-[#F3EEE4]">
        <div className="max-w-6xl mx-auto px-6 py-5 flex justify-between items-center">
          <a href="/" className="font-['Amiri'] text-2xl">حمورابي</a>

          <div className="hidden lg:flex gap-6 items-center">
            <a href="/lawyers" className={navLinkClass}>دليل المحامين</a>
            <a href="/legal-articles" className={navLinkClass}>مقالات قانونية</a>
            <a href="/ai-assistant" className={navLinkClass}>مساعد ذكي</a>
            {loggedIn && !isLawyerAccount && !isFirmAccount && (
              <a href="/my-appointments" className={navLinkClass}>مواعيدي</a>
            )}
            {loggedIn && !isLawyerAccount && !isFirmAccount && (
              <a href="/my-consultations" className={navLinkClass}>استشاراتي</a>
            )}
            {isLawyerAccount && (
              <a href="/lawyer-tools" className={navLinkClass}>أدواتي</a>
            )}
            {isLawyerAccount && (
              <a href="/lawyer-history" className={navLinkClass}>السجل</a>
            )}
          </div>

          {!checkingAuth && !loggedIn && (
            <div className="flex gap-3">
              <a href="/login" className={navLoginClass}>تسجيل الدخول</a>
              <a href="/signup" className={navSignupClass}>إنشاء حساب</a>
            </div>
          )}

          {!checkingAuth && loggedIn && (
            <div className="relative">
              <button
                onClick={toggleMenu}
                className="w-10 h-10 rounded-full bg-[#AD8A4E] flex items-center justify-center hover:bg-[#c49b58] transition"
              >
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.5c-3.3 0-9.8 1.6-9.8 4.9v2.4h19.6v-2.4c0-3.3-6.5-4.9-9.8-4.9z" />
                </svg>
              </button>

              {menuOpen && (
                <div className="absolute left-0 top-full mt-2 w-56 bg-white border border-[#D8D2C4] rounded-md shadow-lg overflow-hidden z-20">
                  {infoLink && (
                    <a href={infoLink} className="block px-4 py-3 font-['Tajawal'] text-sm text-[#1B1A17] hover:bg-[#F3EEE4] transition">
                      معلوماتي الشخصية
                    </a>
                  )}
                  {(isLawyerAccount || isFirmAccount) && (
                    <a href="/subscription" className="block px-4 py-3 font-['Tajawal'] text-sm text-[#1B1A17] hover:bg-[#F3EEE4] transition border-t border-[#D8D2C4]">
                      الاشتراك والإعلانات
                    </a>
                  )}
                  <button
                    onClick={handleLogout}
                    className="w-full text-right px-4 py-3 font-['Tajawal'] text-sm text-[#7A2E2E] hover:bg-[#F3EEE4] transition border-t border-[#D8D2C4]"
                  >
                    تسجيل الخروج
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="relative max-w-6xl mx-auto px-6 py-16 md:py-24 overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            <div>
              <h2 className="font-['Amiri'] text-4xl md:text-5xl leading-tight mb-6">
                محاموك الموثوق، بضغطة واحدة
              </h2>
              <div className="w-20 h-[2px] shimmer-line mb-6"></div>
              <p className="font-['Tajawal'] text-lg text-[#D8D2C4] mb-10 leading-relaxed">
                منصة حمورابي تربطك بمحامين موثوقين في الأردن، حسب التخصص والمدينة، مع إمكانية حجز موعد أو طلب استشارة سريعة مباشرة من هاتفك.
              </p>
              <div className="flex flex-wrap gap-4">
                <a href="/lawyers" className={heroCtaClass}>تصفح المحامين</a>
                <a href="/ai-assistant" className={heroCtaOutlineClass}>اسأل المساعد الذكي</a>
              </div>
            </div>

            <div className="flex justify-center">
              <svg viewBox="0 0 320 320" className="w-64 h-64 md:w-80 md:h-80 opacity-90">
                <g stroke="#AD8A4E" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="160" y1="40" x2="160" y2="220" />
                  <line x1="70" y1="80" x2="250" y2="80" />
                  <circle cx="70" cy="80" r="3" fill="#AD8A4E" />
                  <circle cx="250" cy="80" r="3" fill="#AD8A4E" />
                  <path d="M40 100 Q70 150 100 100" />
                  <path d="M220 100 Q250 150 280 100" />
                  <line x1="120" y1="220" x2="200" y2="220" />
                  <line x1="160" y1="220" x2="160" y2="240" />
                  <rect x="90" y="250" width="140" height="14" rx="2" />
                  <rect x="110" y="264" width="100" height="10" rx="2" />
                </g>
              </svg>
            </div>
          </div>
        </div>

        <div className="border-t border-[#3A382F]">
          <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-3 gap-6 text-center">
            <div>
              <p className="font-['Amiri'] text-3xl text-[#AD8A4E]">{lawyerCount}+</p>
              <p className="font-['Tajawal'] text-xs text-[#D8D2C4] mt-1">محامٍ موثوق</p>
            </div>
            <div>
              <p className="font-['Amiri'] text-3xl text-[#AD8A4E]">{specialtyCount}+</p>
              <p className="font-['Tajawal'] text-xs text-[#D8D2C4] mt-1">تخصص قانوني</p>
            </div>
            <div>
              <p className="font-['Amiri'] text-3xl text-[#AD8A4E]">{cityCount}+</p>
              <p className="font-['Tajawal'] text-xs text-[#D8D2C4] mt-1">مدينة أردنية</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#1B1A17] flex items-center justify-center">
              <svg className="w-6 h-6 text-[#AD8A4E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            </div>
            <h3 className="font-['Tajawal'] font-bold text-[#1B1A17] mb-2">احجز في دقائق</h3>
            <p className="font-['Tajawal'] text-sm text-[#4A473F]">اختر الوقت المناسب لك، حضورياً أو عبر الفيديو</p>
          </div>
          <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#1B1A17] flex items-center justify-center">
              <svg className="w-6 h-6 text-[#AD8A4E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </div>
            <h3 className="font-['Tajawal'] font-bold text-[#1B1A17] mb-2">محامون موثقون</h3>
            <p className="font-['Tajawal'] text-sm text-[#4A473F]">كل محامٍ يخضع للمراجعة قبل الظهور على المنصة</p>
          </div>
          <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#1B1A17] flex items-center justify-center">
              <svg className="w-6 h-6 text-[#AD8A4E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-6l-4 4v-4z" />
              </svg>
            </div>
            <h3 className="font-['Tajawal'] font-bold text-[#1B1A17] mb-2">استشارة سريعة</h3>
            <p className="font-['Tajawal'] text-sm text-[#4A473F]">اسأل سؤالك واحصل على إجابة موثقة من محامٍ مختص</p>
          </div>
        </div>
      </div>

      <div className="bg-[#1B1A17] text-[#D8D2C4] py-8 text-center">
        <p className="font-['Tajawal'] text-sm">© حمورابي 2026 — جميع الحقوق محفوظة</p>
      </div>
    </div>
  )
}