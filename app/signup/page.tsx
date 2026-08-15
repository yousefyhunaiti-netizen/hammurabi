'use client'

import { useState } from 'react'
import { createClient } from '../lib/supabase'

export default function SignupPage() {
  const [userType, setUserType] = useState<'customer' | 'lawyer'>('customer')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const supabase = createClient()

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    setLoading(true)

    const { data, error } = await supabase.auth.signUp({ email, password })

    if (error) {
      setLoading(false)
      setMessage('خطأ: ' + error.message)
      return
    }

    const userId = data.user?.id

    if (userType === 'customer') {
      await supabase.from('customers').insert({
        user_id: userId,
        full_name: fullName,
        email: email,
        phone: phone,
      })
    } else {
      await supabase.from('lawyers').insert({
        user_id: userId,
        full_name: fullName,
        email: email,
        phone: phone,
        is_approved: false,
        is_active: false,
      })
    }

    setLoading(false)
    setMessage('تم إنشاء الحساب بنجاح! تفقد بريدك الإلكتروني للتأكيد.')
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
            انضم إلى منصة حمورابي، سواء كنت تبحث عن استشارة قانونية موثوقة أو محامياً يوسّع نطاق عمله.
          </p>
        </div>
      </div>

      <div className="md:w-1/2 bg-[#F3EEE4] flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <h2 className="font-['Tajawal'] font-bold text-2xl text-[#1B1A17] mb-1">إنشاء حساب</h2>
          <p className="font-['Tajawal'] text-sm text-[#4A473F] mb-6">اختر نوع حسابك وابدأ</p>

          <div className="flex bg-white border border-[#D8D2C4] rounded-md p-1 mb-6">
            <button
              type="button"
              onClick={() => setUserType('customer')}
              className={`flex-1 py-2 rounded font-['Tajawal'] text-sm font-medium transition ${
                userType === 'customer' ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'text-[#4A473F]'
              }`}
            >
              عميل
            </button>
            <button
              type="button"
              onClick={() => setUserType('lawyer')}
              className={`flex-1 py-2 rounded font-['Tajawal'] text-sm font-medium transition ${
                userType === 'lawyer' ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'text-[#4A473F]'
              }`}
            >
              محامي
            </button>
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block font-['Tajawal'] text-sm text-[#4A473F] mb-1.5">الاسم الكامل</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full px-4 py-3 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-[#1B1A17] focus:outline-none focus:ring-2 focus:ring-[#AD8A4E] focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block font-['Tajawal'] text-sm text-[#4A473F] mb-1.5">البريد الإلكتروني</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-[#1B1A17] focus:outline-none focus:ring-2 focus:ring-[#AD8A4E] focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block font-['Tajawal'] text-sm text-[#4A473F] mb-1.5">رقم الهاتف</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="w-full px-4 py-3 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-[#1B1A17] focus:outline-none focus:ring-2 focus:ring-[#AD8A4E] focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block font-['Tajawal'] text-sm text-[#4A473F] mb-1.5">كلمة المرور</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-[#1B1A17] focus:outline-none focus:ring-2 focus:ring-[#AD8A4E] focus:border-transparent transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#1B1A17] text-[#F3EEE4] font-['Tajawal'] font-medium rounded-md hover:bg-[#AD8A4E] transition disabled:opacity-60"
            >
              {loading ? 'جاري الإنشاء...' : 'إنشاء حساب'}
            </button>
          </form>

          {message && (
            <p className={`mt-5 text-sm font-['Tajawal'] ${message.startsWith('خطأ') ? 'text-[#7A2E2E]' : 'text-[#2F4538]'}`}>
              {message}
            </p>
          )}

          <p className="mt-8 text-sm font-['Tajawal'] text-[#4A473F]">
            لديك حساب بالفعل؟ <a href="/login" className="text-[#AD8A4E] font-medium hover:underline">تسجيل الدخول</a>
          </p>
        </div>
      </div>
    </div>
  )
}