'use client'

import { useState } from 'react'
import { createClient } from '../lib/supabase'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    setLoading(true)

    const result = await supabase.auth.updateUser({ password: password })

    setLoading(false)

    if (result.error) {
      setMessage('حدث خطأ، حاول مرة أخرى')
      return
    }

    setDone(true)
  }

  return (
    <div dir="rtl" className="min-h-screen pattern-bg flex items-center justify-center px-6">
      <div className="w-full max-w-sm bg-white border border-[#D8D2C4] rounded-lg p-8">
        <h1 className="font-['Tajawal'] font-bold text-2xl text-[#1B1A17] mb-2">إعادة تعيين كلمة المرور</h1>

        {!done && (
          <div>
            <p className="font-['Tajawal'] text-sm text-[#4A473F] mb-6">أدخل كلمة المرور الجديدة</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="password"
                value={password}
                onChange={function (e) { setPassword(e.target.value) }}
                required
                className="w-full px-4 py-3 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-[#1B1A17] focus:outline-none focus:ring-2 focus:ring-[#AD8A4E]"
                placeholder="كلمة المرور الجديدة"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[#1B1A17] text-[#F3EEE4] font-['Tajawal'] font-medium rounded-md hover:bg-[#AD8A4E] transition disabled:opacity-60"
              >
                {loading ? 'جاري الحفظ...' : 'حفظ كلمة المرور'}
              </button>
            </form>
            {message && (
              <p className="mt-4 text-sm font-['Tajawal'] text-[#7A2E2E]">{message}</p>
            )}
          </div>
        )}

        {done && (
          <div>
            <p className="font-['Tajawal'] text-sm text-[#2F4538] mb-4">تم تغيير كلمة المرور بنجاح</p>
            <a href="/login" className="inline-block px-6 py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal'] text-sm">تسجيل الدخول</a>
          </div>
        )}
      </div>
    </div>
  )
}