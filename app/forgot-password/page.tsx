'use client'

import { useState } from 'react'
import { createClient } from '../lib/supabase'
import HeaderLines from '../components/HeaderLines'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    setLoading(true)

    const result = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/reset-password',
    })

    setLoading(false)

    if (result.error) {
      setMessage('خطأ: ' + result.error.message)
      return
    }

    setMessage('تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني')
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
          <h2 className="font-['Tajawal'] font-bold text-2xl text-[#1B1A17] mb-1">نسيت كلمة المرور؟</h2>
          <p className="font-['Tajawal'] text-sm text-[#4A473F] mb-8">أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة تعيين كلمة المرور</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-['Tajawal'] text-sm text-[#4A473F] mb-1.5">البريد الإلكتروني</label>
              <input
                type="email"
                value={email}
                onChange={function (e) { setEmail(e.target.value) }}
                required
                className="w-full px-4 py-3 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-[#1B1A17] focus:outline-none focus:ring-2 focus:ring-[#AD8A4E] focus:border-transparent transition"
                placeholder="you@example.com"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#1B1A17] text-[#F3EEE4] font-['Tajawal'] font-bold text-lg rounded-md hover:bg-[#AD8A4E] transition disabled:opacity-60"
            >
              {loading ? 'جاري الإرسال...' : 'إرسال رابط إعادة التعيين'}
            </button>
          </form>

          {message && (
            <p className={"mt-5 text-sm font-['Tajawal'] " + (message.indexOf('خطأ') === 0 ? 'text-[#7A2E2E]' : 'text-[#2F4538]')}>
              {message}
            </p>
          )}

          <p className="mt-8 text-sm font-['Tajawal'] text-[#4A473F]">
            تذكرت كلمة المرور؟ <a href="/login" className="text-[#AD8A4E] font-bold hover:underline">تسجيل الدخول</a>
          </p>
        </div>
      </div>
    </div>
  )
}