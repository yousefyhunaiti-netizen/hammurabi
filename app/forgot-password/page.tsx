'use client'

import { useState } from 'react'
import { createClient } from '../lib/supabase'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    setLoading(true)

    const redirectUrl = window.location.origin + '/reset-password'

    const result = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl })

    setLoading(false)

    if (result.error) {
      setMessage('حدث خطأ، حاول مرة أخرى')
      return
    }

    setMessage('تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني')
  }

  return (
    <div dir="rtl" className="min-h-screen pattern-bg flex items-center justify-center px-6">
      <div className="w-full max-w-sm bg-white border border-[#D8D2C4] rounded-lg p-8">
        <h1 className="font-['Tajawal'] font-bold text-2xl text-[#1B1A17] mb-2">نسيت كلمة المرور؟</h1>
        <p className="font-['Tajawal'] text-sm text-[#4A473F] mb-6">أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة تعيين كلمة المرور</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={function (e) { setEmail(e.target.value) }}
            required
            className="w-full px-4 py-3 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-[#1B1A17] focus:outline-none focus:ring-2 focus:ring-[#AD8A4E]"
            placeholder="you@example.com"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#1B1A17] text-[#F3EEE4] font-['Tajawal'] font-medium rounded-md hover:bg-[#AD8A4E] transition disabled:opacity-60"
          >
            {loading ? 'جاري الإرسال...' : 'إرسال رابط إعادة التعيين'}
          </button>
        </form>

        {message && (
          <p className="mt-4 text-sm font-['Tajawal'] text-[#2F4538]">{message}</p>
        )}

        <p className="mt-6 text-sm font-['Tajawal'] text-[#4A473F]">
          <a href="/login" className="text-[#AD8A4E] hover:underline">العودة لتسجيل الدخول</a>
        </p>
      </div>
    </div>
  )
}