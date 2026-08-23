'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'

type Firm = {
  id: number
  firm_name: string
  bio: string | null
  city: string | null
  address: string | null
  phone: string | null
  email: string | null
  google_maps_link: string | null
  website_url: string | null
  show_lawyer_names: boolean | null
}

export default function FirmInfoPage() {
  const [loading, setLoading] = useState(true)
  const [firm, setFirm] = useState<Firm | null>(null)
  const [notFirm, setNotFirm] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const supabase = createClient()
  const router = useRouter()

  useEffect(function () {
    async function loadData() {
      const userResult = await supabase.auth.getUser()

      if (!userResult.data.user) {
        setNotFirm(true)
        setLoading(false)
        return
      }

      const firmResult = await supabase
        .from('firms')
        .select('*')
        .eq('user_id', userResult.data.user.id)
        .single()

      if (!firmResult.data) {
        setNotFirm(true)
        setLoading(false)
        return
      }

      setFirm(firmResult.data)
      setLoading(false)
    }

    loadData()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    setMenuOpen(false)
    router.push('/')
  }

  function toggleMenu() {
    setMenuOpen(!menuOpen)
  }

  if (loading) {
    return (
      <div dir="rtl" className="min-h-screen pattern-bg flex items-center justify-center">
        <p className="font-['Tajawal'] text-[#4A473F]">جاري التحميل...</p>
      </div>
    )
  }

  if (notFirm || !firm) {
    return (
      <div dir="rtl" className="min-h-screen pattern-bg flex items-center justify-center px-6">
        <div className="text-center">
          <p className="font-['Tajawal'] text-[#4A473F] mb-4">يرجى تسجيل الدخول لعرض معلومات المكتب</p>
          <a href="/login" className="inline-block px-6 py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal']">تسجيل الدخول</a>
        </div>
      </div>
    )
  }

  return (
    <div dir="rtl" className="min-h-screen pattern-bg">
      <div className="bg-[#1B1A17] text-[#F3EEE4] py-12 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-8 font-['Tajawal'] text-sm">
            <a href="/" className="font-['Amiri'] text-xl">حمورابي</a>
            <div className="flex gap-5 items-center">
              <a href="/lawyers" className="hover:text-[#AD8A4E] transition">دليل المحامين</a>
              <a href="/my-appointments" className="hover:text-[#AD8A4E] transition">مواعيدي</a>
              <a href="/my-consultations" className="hover:text-[#AD8A4E] transition">استشاراتي</a>
              <div className="relative">
                <button onClick={toggleMenu} className="w-8 h-8 rounded-full bg-[#AD8A4E] flex items-center justify-center hover:bg-[#c49b58] transition">
                  <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.5c-3.3 0-9.8 1.6-9.8 4.9v2.4h19.6v-2.4c0-3.3-6.5-4.9-9.8-4.9z" />
                  </svg>
                </button>
                {menuOpen && (
                  <div className="absolute left-0 top-full mt-2 w-52 bg-white border border-[#D8D2C4] rounded-md shadow-lg overflow-hidden z-20">
                    <a href="/firm-info" className="block px-4 py-3 font-['Tajawal'] text-sm text-[#1B1A17] hover:bg-[#F3EEE4] transition">
                      معلوماتي الشخصية
                    </a>
                    <button onClick={handleLogout} className="w-full text-right px-4 py-3 font-['Tajawal'] text-sm text-[#7A2E2E] hover:bg-[#F3EEE4] transition border-t border-[#D8D2C4]">
                      تسجيل الخروج
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <h1 className="font-['Amiri'] text-4xl mb-2">معلومات المكتب</h1>
          <div className="w-16 h-[2px] bg-[#AD8A4E]"></div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-6">
          <div className="grid grid-cols-2 gap-4 font-['Tajawal'] text-sm">
            <div>
              <p className="text-[#4A473F] mb-1">اسم المكتب</p>
              <p className="text-[#1B1A17] font-medium">{firm.firm_name}</p>
            </div>
            <div>
              <p className="text-[#4A473F] mb-1">البريد الإلكتروني</p>
              <p className="text-[#1B1A17] font-medium">{firm.email || '-'}</p>
            </div>
            <div>
              <p className="text-[#4A473F] mb-1">رقم الهاتف</p>
              <p className="text-[#1B1A17] font-medium">{firm.phone || '-'}</p>
            </div>
            <div>
              <p className="text-[#4A473F] mb-1">المدينة</p>
              <p className="text-[#1B1A17] font-medium">{firm.city || '-'}</p>
            </div>
            <div className="col-span-2">
              <p className="text-[#4A473F] mb-1">العنوان</p>
              <p className="text-[#1B1A17] font-medium">{firm.address || '-'}</p>
            </div>
            <div className="col-span-2">
              <p className="text-[#4A473F] mb-1">نبذة</p>
              <p className="text-[#1B1A17] font-medium">{firm.bio || '-'}</p>
            </div>
            <div>
              <p className="text-[#4A473F] mb-1">عرض أسماء المحامين</p>
              <p className="text-[#1B1A17] font-medium">{firm.show_lawyer_names ? 'مفعّل' : 'غير مفعّل'}</p>
            </div>
          </div>
        </div>

        <a href="/firm-dashboard" className="block w-full text-center py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal'] font-medium hover:bg-[#AD8A4E] transition mb-4">
          تعديل المعلومات
        </a>

        <div className="text-center">
          <a href="/change-password" className="font-['Tajawal'] text-sm text-[#AD8A4E] hover:underline">تغيير كلمة المرور</a>
        </div>
      </div>
    </div>
  )
}