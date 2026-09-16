'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'

export default function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const supabase = createClient()
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')

    if (newPassword.length < 6) {
      setMessage('يجب أن تتكون كلمة المرور من 6 أحرف على الأقل')
      return
    }

    if (newPassword !== confirmPassword) {
      setMessage('كلمتا المرور غير متطابقتين')
      return
    }

    setLoading(true)

    const result = await supabase.auth.updateUser({ password: newPassword })

    setLoading(false)

    if (result.error) {
      setMessage('حدث خطأ، قد يكون رابط إعادة التعيين منتهي الصلاحية. حاول طلب رابط جديد.')
      return
    }

    setDone(true)
    setTimeout(function () {
      router.push('/login')
    }, 2000)
  }

  return (
    <div dir="rtl" className="min-h-screen flex flex-col md:flex-row">
      <div className="relative md:w-1/2 bg-[#1B1A17] text-[#F3EEE4] flex flex-col justify-center px-10 py-16 overflow-hidden">
        <img
          src="/scale.png"
          alt=""
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] opacity-[0.07] pointer-events-none object-contain"
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
          {!done ? (
            <div>
              <h2 className="font-['Tajawal'] font-bold text-2xl text-[#1B1A17] mb-1">تعيين كلمة مرور جديدة</h2>
              <p className="font-['Tajawal'] text-sm text-[#4A473F] mb-8">أدخل كلمة المرور الجديدة مرتين للتأكيد</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block font-['Tajawal'] text-sm text-[#4A473F] mb-1.5">كلمة المرور الجديدة</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={function (e) { setNewPassword(e.target.value) }}
                    required
                    className="w-full px-4 py-3 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-[#1B1A17] focus:outline-none focus:ring-2 focus:ring-[#AD8A4E] focus:border-transparent transition"
                  />
                </div>

                <div>
                  <label className="block font-['Tajawal'] text-sm text-[#4A473F] mb-1.5">تأكيد كلمة المرور</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={function (e) { setConfirmPassword(e.target.value) }}
                    required
                    className="w-full px-4 py-3 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-[#1B1A17] focus:outline-none focus:ring-2 focus:ring-[#AD8A4E] focus:border-transparent transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-[#1B1A17] text-[#F3EEE4] font-['Tajawal'] font-bold text-lg rounded-md hover:bg-[#AD8A4E] transition disabled:opacity-60"
                >
                  {loading ? 'جاري التحديث...' : 'تعيين كلمة المرور'}
                </button>
              </form>

              {message && (
                <p className="mt-5 text-sm font-['Tajawal'] text-[#7A2E2E]">{message}</p>
              )}
            </div>
          ) : (
            <div className="text-center">
              <h2 className="font-['Tajawal'] font-bold text-2xl text-[#2F4538] mb-2">تم بنجاح!</h2>
              <p className="font-['Tajawal'] text-sm text-[#4A473F]">تم تعيين كلمة المرور الجديدة، جاري تحويلك لصفحة تسجيل الدخول...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}