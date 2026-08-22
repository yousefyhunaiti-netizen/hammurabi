'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const supabase = createClient()
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    setLoading(true)

    const result = await supabase.auth.signInWithPassword({ email: email, password: password })
    setLoading(false)

    if (result.error) {
      setMessage('خطأ: البريد الإلكتروني أو كلمة المرور غير صحيحة')
      return
    }

    setMessage('تم تسجيل الدخول بنجاح')
    router.push('/')
  }

  return (
    <div dir="rtl" className="min-h-screen flex flex-col md:flex-row">
      <div className="relative md:w-1/2 bg-[#1B1A17] text-[#F3EEE4] flex flex-col justify-center px-10 py-16 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{ backgroundImage: 'repeating-linear-gradient(180deg, transparent, transparent 38px, #AD8A4E 39px)' }}
        />
        <div className="relative z-10 max-w-md mx-auto md:mx-0">
          <h1 className="font-['Amiri'] text-6xl md:text-7xl leading-none mb-4">حمورابي</h1>
          <div className="w-16 h-[2px] bg-[#AD8A4E] mb-6"></div>
          <p className="font-['Tajawal'] text-lg text-[#D8D2C4] leading-relaxed">
            منصتك للوصول إلى محامين موثوقين في الأردن، بثقة ووضوح، كما رست القوانين الأولى على الحجر.
          </p>
        </div>
      </div>

      <div className="md:w-1/2 pattern-bg flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <h2 className="font-['Tajawal'] font-bold text-2xl text-[#1B1A17] mb-1">تسجيل الدخول</h2>
          <p className="font-['Tajawal'] text-sm text-[#4A473F] mb-8">أدخل بياناتك للوصول إلى حسابك</p>

          <form onSubmit={handleLogin} className="space-y-4">
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
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block font-['Tajawal'] text-sm text-[#4A473F]">كلمة المرور</label>
                <a href="/forgot-password" className="font-['Tajawal'] text-xs text-[#AD8A4E] hover:underline">نسيت كلمة المرور؟</a>
              </div>
              <input
                type="password"
                value={password}
                onChange={function (e) { setPassword(e.target.value) }}
                required
                className="w-full px-4 py-3 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-[#1B1A17] focus:outline-none focus:ring-2 focus:ring-[#AD8A4E] focus:border-transparent transition"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#1B1A17] text-[#F3EEE4] font-['Tajawal'] font-medium rounded-md hover:bg-[#AD8A4E] transition disabled:opacity-60"
            >
              {loading ? 'جاري الدخول...' : 'دخول'}
            </button>
          </form>

          {message && (
            <p className={"mt-5 text-sm font-['Tajawal'] " + (message.indexOf('خطأ') === 0 ? 'text-[#7A2E2E]' : 'text-[#2F4538]')}>
              {message}
            </p>
          )}

          <p className="mt-8 text-sm font-['Tajawal'] text-[#4A473F]">
            ليس لديك حساب؟ <a href="/signup" className="text-[#AD8A4E] font-medium hover:underline">إنشاء حساب جديد</a>
          </p>
        </div>
      </div>
    </div>
  )
}