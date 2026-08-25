'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase'

const tools = [
  { href: '/lawyer-library', label: 'مكتبتي القانونية', desc: 'احفظ القوانين والروابط المهمة' },
  { href: '/lawyer-cases', label: 'ملفات القضايا', desc: 'خزّن ملفات كل عميل بشكل منظم' },
  { href: '/lawyer-invoices', label: 'الفواتير', desc: 'أنشئ وتابع فواتير عملائك' },
  { href: '/lawyer-calendar', label: 'أجندتي', desc: 'مواعيدك التطبيقية والشخصية في مكان واحد' },
  { href: '/lawyer-notes', label: 'ملاحظاتي', desc: 'ملاحظات سريعة خاصة بك' },
  { href: '/wakalah', label: 'الوكالات', desc: 'ارفع وتابع وكالات عملائك' },
  { href: '/lawyer-history', label: 'السجل', desc: 'مواعيد واستشارات سابقة' },
  { href: '/community', label: 'مجتمع المحامين', desc: 'اسأل وأجب زملاءك المحامين' },
  { href: '/success-stories', label: 'قصص نجاح', desc: 'شارك واقرأ تجارب المحامين' },
  { href: '/lawyer-messages', label: 'الرسائل', desc: 'تواصل مباشر مع محامين آخرين' },
]

export default function LawyerToolsPage() {
  const [loading, setLoading] = useState(true)
  const [notAllowed, setNotAllowed] = useState(false)

  const supabase = createClient()

  useEffect(function () {
    async function checkAccess() {
      const userResult = await supabase.auth.getUser()

      if (!userResult.data.user) {
        setNotAllowed(true)
        setLoading(false)
        return
      }

      const lawyerResult = await supabase.from('lawyers').select('id').eq('user_id', userResult.data.user.id).maybeSingle()

      if (!lawyerResult.data) {
        setNotAllowed(true)
        setLoading(false)
        return
      }

      setLoading(false)
    }

    checkAccess()
  }, [])

  function renderTool(tool: { href: string; label: string; desc: string }) {
    return (
      <a key={tool.href} href={tool.href} className="block bg-white border border-[#D8D2C4] rounded-lg p-5 hover:shadow-lg hover:border-[#AD8A4E] transition">
        <h3 className="font-['Tajawal'] font-bold text-[#1B1A17] mb-1">{tool.label}</h3>
        <p className="font-['Tajawal'] text-sm text-[#4A473F]">{tool.desc}</p>
      </a>
    )
  }

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
          <p className="font-['Tajawal'] text-[#4A473F] mb-4">هذه الصفحة مخصصة لحسابات المحامين فقط</p>
          <a href="/login" className="inline-block px-6 py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal']">تسجيل الدخول</a>
        </div>
      </div>
    )
  }

  return (
    <div dir="rtl" className="min-h-screen pattern-bg">
      <div className="bg-[#1B1A17] text-[#F3EEE4] py-12 px-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="font-['Amiri'] text-4xl mb-2">أدواتي</h1>
          <div className="w-16 h-[2px] bg-[#AD8A4E]"></div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10 grid grid-cols-1 md:grid-cols-2 gap-4">
        {tools.map(renderTool)}
      </div>
    </div>
  )
}