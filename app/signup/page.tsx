'use client'

import { useEffect, useState } from 'react'
import HeaderLines from '../components/HeaderLines'

export default function SignupPage() {
  const [userType, setUserType] = useState('customer')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [isTrainee, setIsTrainee] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  // A link like /signup?type=lawyer&trainee=1 opens the lawyer form with "trainee" ticked.
  useEffect(function () {
    const params = new URLSearchParams(window.location.search)
    const type = params.get('type')
    if (type === 'lawyer' || type === 'firm' || type === 'customer') {
      setUserType(type)
    }
    if (params.get('trainee') === '1') {
      setUserType('lawyer')
      setIsTrainee(true)
    }
  }, [])

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')

    if (!agreed) {
      setMessage('خطأ: يجب الموافقة على الشروط والأحكام أولاً')
      return
    }

    setLoading(true)

    const { createClient } = await import('../lib/supabase')
    const supabase = createClient()

    const signUpResult = await supabase.auth.signUp({ email: email, password: password })

    if (signUpResult.error) {
      setLoading(false)
      setMessage('خطأ: ' + signUpResult.error.message)
      return
    }

    const userId = signUpResult.data.user ? signUpResult.data.user.id : null
    const nowStr = new Date().toISOString()

    if (userType === 'customer') {
      await supabase.from('customers').insert({
        user_id: userId,
        full_name: fullName,
        email: email,
        phone: phone,
        agreed_to_terms: true,
        agreed_at: nowStr,
      })
    } else if (userType === 'lawyer') {
      await supabase.from('lawyers').insert({
        user_id: userId,
        full_name: fullName,
        email: email,
        phone: phone,
        is_approved: false,
        is_active: false,
        is_trainee: isTrainee,
        agreed_to_terms: true,
        agreed_at: nowStr,
      })
    } else if (userType === 'firm') {
      await supabase.from('firms').insert({
        user_id: userId,
        firm_name: fullName,
        email: email,
        phone: phone,
        is_approved: false,
        is_active: false,
        agreed_to_terms: true,
        agreed_at: nowStr,
      })
    }

    setLoading(false)
    setMessage('تم إنشاء الحساب بنجاح! تفقد بريدك الإلكتروني للتأكيد.')
  }

  function nameFieldLabel() {
    if (userType === 'firm') return 'اسم المكتب'
    return 'الاسم الكامل'
  }

  return (
    <div dir="rtl" className="min-h-screen flex flex-col md:flex-row">
      <div className="relative isolate md:w-1/2 bg-[#1B1A17] text-[#F3EEE4] flex flex-col justify-center px-10 py-16 overflow-hidden">
        <HeaderLines />
        <img
          src="/scale.png"
          alt=""
          className="hidden md:block absolute left-10 bottom-10 w-48 h-48 lg:w-56 lg:h-56 opacity-25 pointer-events-none object-contain z-[1] hm-float"
        />

        <div className="relative z-10 max-w-md mx-auto md:mx-0">
          <img src="/logo.png" alt="حمورابي" className="h-24 md:h-28 w-auto mb-3" />
          <div className="w-20 h-[3px] shimmer-line mb-6"></div>
          <p className="font-['Tajawal'] text-sm md:text-base text-[#D8D2C4] leading-relaxed">
            بوابتك المتكاملة لإدارة منظومة العمل القانوني.
          </p>
        </div>
      </div>

      <div className="md:w-1/2 pattern-bg flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <h2 className="font-['Tajawal'] font-bold text-2xl text-[#1B1A17] mb-1">إنشاء حساب</h2>
          <p className="font-['Tajawal'] text-sm text-[#4A473F] mb-6">اختر نوع حسابك وابدأ</p>

          <div className="flex bg-white border border-[#D8D2C4] rounded-md p-1 mb-6">
            <button
              type="button"
              onClick={function () { setUserType('customer') }}
              className={
                "flex-1 py-2 rounded font-['Tajawal'] text-xs font-medium transition " +
                (userType === 'customer' ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'text-[#4A473F]')
              }
            >
              عميل
            </button>
            <button
              type="button"
              onClick={function () { setUserType('lawyer') }}
              className={
                "flex-1 py-2 rounded font-['Tajawal'] text-xs font-medium transition " +
                (userType === 'lawyer' ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'text-[#4A473F]')
              }
            >
              محامي
            </button>
            <button
              type="button"
              onClick={function () { setUserType('firm') }}
              className={
                "flex-1 py-2 rounded font-['Tajawal'] text-xs font-medium transition " +
                (userType === 'firm' ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'text-[#4A473F]')
              }
            >
              مكتب محاماة
            </button>
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block font-['Tajawal'] text-sm text-[#4A473F] mb-1.5">{nameFieldLabel()}</label>
              <input
                type="text"
                value={fullName}
                onChange={function (e) { setFullName(e.target.value) }}
                required
                className="w-full px-4 py-3 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-[#1B1A17] focus:outline-none focus:ring-2 focus:ring-[#AD8A4E] focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block font-['Tajawal'] text-sm text-[#4A473F] mb-1.5">البريد الإلكتروني</label>
              <input
                type="email"
                value={email}
                onChange={function (e) { setEmail(e.target.value) }}
                required
                className="w-full px-4 py-3 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-[#1B1A17] focus:outline-none focus:ring-2 focus:ring-[#AD8A4E] focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block font-['Tajawal'] text-sm text-[#4A473F] mb-1.5">رقم الهاتف</label>
              <input
                type="tel"
                value={phone}
                onChange={function (e) { setPhone(e.target.value) }}
                required
                className="w-full px-4 py-3 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-[#1B1A17] focus:outline-none focus:ring-2 focus:ring-[#AD8A4E] focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block font-['Tajawal'] text-sm text-[#4A473F] mb-1.5">كلمة المرور</label>
              <input
                type="password"
                value={password}
                onChange={function (e) { setPassword(e.target.value) }}
                required
                className="w-full px-4 py-3 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-[#1B1A17] focus:outline-none focus:ring-2 focus:ring-[#AD8A4E] focus:border-transparent transition"
              />
            </div>

            {userType === 'lawyer' && (
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  id="is-trainee"
                  checked={isTrainee}
                  onChange={function (e) { setIsTrainee(e.target.checked) }}
                  className="mt-1"
                />
                <label htmlFor="is-trainee" className="font-['Tajawal'] text-xs text-[#4A473F]">
                  أنا محامي متدرب (ستجد فرص التدريب في صفحة التوظيف والتدريب بعد تسجيل الدخول)
                </label>
              </div>
            )}

            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                id="agree-terms"
                checked={agreed}
                onChange={function (e) { setAgreed(e.target.checked) }}
                className="mt-1"
              />
              <label htmlFor="agree-terms" className="font-['Tajawal'] text-xs text-[#4A473F]">
                أقر بصحة المعلومات المقدمة، وأوافق على{' '}
                <a href="/terms" target="_blank" className="text-[#AD8A4E] underline">الشروط والأحكام</a>
                {' '}الخاصة بمنصة حمورابي
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#1B1A17] text-[#F3EEE4] font-['Tajawal'] font-bold text-lg rounded-md hover:bg-[#AD8A4E] transition disabled:opacity-60"
            >
              {loading ? 'جاري الإنشاء...' : 'إنشاء حساب'}
            </button>
          </form>

          {message && (
            <p className={"mt-5 text-sm font-['Tajawal'] " + (message.indexOf('خطأ') === 0 ? 'text-[#7A2E2E]' : 'text-[#2F4538]')}>
              {message}
            </p>
          )}

          <p className="mt-8 text-sm font-['Tajawal'] text-[#4A473F]">
            لديك حساب بالفعل؟ <a href="/login" className="text-[#AD8A4E] font-bold hover:underline">تسجيل الدخول</a>
          </p>
        </div>
      </div>
    </div>
  )
}