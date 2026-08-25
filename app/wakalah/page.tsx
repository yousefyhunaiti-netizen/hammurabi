'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase'

type WakalahDoc = {
  id: number
  lawyer_id: number
  customer_id: string
  lawyer_file_url: string | null
  customer_file_url: string | null
  status: string
  created_at: string
}

type CustomerOption = {
  customer_id: string
  name: string
}

export default function WakalahPage() {
  const [loading, setLoading] = useState(true)
  const [userType, setUserType] = useState('')
  const [lawyerId, setLawyerId] = useState<number | null>(null)
  const [customerUserId, setCustomerUserId] = useState<string | null>(null)
  const [docs, setDocs] = useState<WakalahDoc[]>([])
  const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState('')
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')

  const supabase = createClient()

  async function loadLawyerDocs(id: number) {
    const result = await supabase.from('wakalah_documents').select('*').eq('lawyer_id', id).order('created_at', { ascending: false })
    setDocs(result.data || [])
  }

  async function loadCustomerDocs(uid: string) {
    const result = await supabase.from('wakalah_documents').select('*').eq('customer_id', uid).order('created_at', { ascending: false })
    setDocs(result.data || [])
  }

  useEffect(function () {
    async function loadData() {
      const userResult = await supabase.auth.getUser()

      if (!userResult.data.user) {
        setLoading(false)
        return
      }

      const user = userResult.data.user

      const lawyerResult = await supabase.from('lawyers').select('id').eq('user_id', user.id).maybeSingle()

      if (lawyerResult.data) {
        setUserType('lawyer')
        setLawyerId(lawyerResult.data.id)

        const consultResult = await supabase
          .from('consultations')
          .select('customer_id')
          .eq('lawyer_id', lawyerResult.data.id)

        const uniqueIds = Array.from(new Set((consultResult.data || []).map(function (c) { return c.customer_id })))

        const options: CustomerOption[] = []
        for (let i = 0; i < uniqueIds.length; i++) {
          const custResult = await supabase.from('customers').select('full_name').eq('user_id', uniqueIds[i]).maybeSingle()
          options.push({ customer_id: uniqueIds[i], name: custResult.data ? custResult.data.full_name : uniqueIds[i] })
        }
        setCustomerOptions(options)

        await loadLawyerDocs(lawyerResult.data.id)
        setLoading(false)
        return
      }

      const customerResult = await supabase.from('customers').select('id').eq('user_id', user.id).maybeSingle()

      if (customerResult.data) {
        setUserType('customer')
        setCustomerUserId(user.id)
        await loadCustomerDocs(user.id)
        setLoading(false)
        return
      }

      setLoading(false)
    }

    loadData()
  }, [])

  async function handleLawyerUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files || !e.target.files[0] || !lawyerId || !selectedCustomer) return
    setUploading(true)
    setMessage('')

    const file = e.target.files[0]
    const filePath = 'lawyer-' + lawyerId + '-' + Date.now() + '-' + file.name

    const uploadResult = await supabase.storage.from('wakalah-files').upload(filePath, file)

    if (uploadResult.error) {
      setUploading(false)
      setMessage('حدث خطأ أثناء الرفع')
      return
    }

    const urlResult = supabase.storage.from('wakalah-files').getPublicUrl(filePath)

    await supabase.from('wakalah_documents').insert({
      lawyer_id: lawyerId,
      customer_id: selectedCustomer,
      lawyer_file_url: urlResult.data.publicUrl,
      status: 'pending_customer',
    })

    setUploading(false)
    setMessage('تم رفع الوكالة بنجاح')
    await loadLawyerDocs(lawyerId)
  }

  async function handleCustomerUpload(e: React.ChangeEvent<HTMLInputElement>, docId: number) {
    if (!e.target.files || !e.target.files[0] || !customerUserId) return
    setUploading(true)
    setMessage('')

    const file = e.target.files[0]
    const filePath = 'customer-' + docId + '-' + Date.now() + '-' + file.name

    const uploadResult = await supabase.storage.from('wakalah-files').upload(filePath, file)

    if (uploadResult.error) {
      setUploading(false)
      setMessage('حدث خطأ أثناء الرفع')
      return
    }

    const urlResult = supabase.storage.from('wakalah-files').getPublicUrl(filePath)

    await supabase
      .from('wakalah_documents')
      .update({ customer_file_url: urlResult.data.publicUrl, status: 'completed' })
      .eq('id', docId)

    setUploading(false)
    setMessage('تم رفع النسخة الموقعة بنجاح')
    await loadCustomerDocs(customerUserId)
  }

  function renderLawyerDoc(doc: WakalahDoc) {
    return (
      <div key={doc.id} className="bg-white border border-[#D8D2C4] rounded-lg p-4 mb-3">
        <p className="font-['Tajawal'] text-sm text-[#1B1A17] mb-2">الحالة: {doc.status === 'completed' ? 'مكتملة - تم توقيعها' : 'بانتظار توقيع العميل'}</p>
        {doc.lawyer_file_url && (
          <a href={doc.lawyer_file_url} target="_blank" rel="noopener noreferrer" className="font-['Tajawal'] text-xs text-[#AD8A4E] underline block mb-1">عرض الملف المرفوع</a>
        )}
        {doc.customer_file_url && (
          <a href={doc.customer_file_url} target="_blank" rel="noopener noreferrer" className="font-['Tajawal'] text-xs text-[#2F4538] underline block">عرض النسخة الموقعة من العميل</a>
        )}
      </div>
    )
  }

  function renderCustomerDoc(doc: WakalahDoc) {
    function fileChange(e: React.ChangeEvent<HTMLInputElement>) {
      handleCustomerUpload(e, doc.id)
    }

    return (
      <div key={doc.id} className="bg-white border border-[#D8D2C4] rounded-lg p-4 mb-3">
        <p className="font-['Tajawal'] text-sm text-[#1B1A17] mb-2">الحالة: {doc.status === 'completed' ? 'مكتملة' : 'بانتظار توقيعك'}</p>
        {doc.lawyer_file_url && (
          <a href={doc.lawyer_file_url} target="_blank" rel="noopener noreferrer" className="font-['Tajawal'] text-xs text-[#AD8A4E] underline block mb-3">تحميل نموذج الوكالة</a>
        )}
        {doc.status !== 'completed' && (
          <div>
            <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-1">ارفع النسخة الموقعة</label>
            <input type="file" onChange={fileChange} disabled={uploading} className="font-['Tajawal'] text-xs" />
          </div>
        )}
        {doc.customer_file_url && (
          <a href={doc.customer_file_url} target="_blank" rel="noopener noreferrer" className="font-['Tajawal'] text-xs text-[#2F4538] underline block mt-2">عرض نسختك الموقعة</a>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div dir="rtl" className="min-h-screen pattern-bg flex items-center justify-center">
        <p className="font-['Tajawal'] text-[#4A473F]">جاري التحميل...</p>
      </div>
    )
  }

  if (!userType) {
    return (
      <div dir="rtl" className="min-h-screen pattern-bg flex items-center justify-center px-6">
        <div className="text-center">
          <p className="font-['Tajawal'] text-[#4A473F] mb-4">يرجى تسجيل الدخول</p>
          <a href="/login" className="inline-block px-6 py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal']">تسجيل الدخول</a>
        </div>
      </div>
    )
  }

  return (
    <div dir="rtl" className="min-h-screen pattern-bg">
      <div className="bg-[#1B1A17] text-[#F3EEE4] py-12 px-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="font-['Amiri'] text-4xl mb-2">الوكالات</h1>
          <div className="w-16 h-[2px] bg-[#AD8A4E]"></div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10">
        {userType === 'lawyer' && (
          <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-6">
            <h2 className="font-['Tajawal'] font-bold text-[#1B1A17] mb-3">رفع وكالة جديدة</h2>
            <select
              value={selectedCustomer}
              onChange={function (e) { setSelectedCustomer(e.target.value) }}
              className="w-full px-3 py-2 mb-3 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
            >
              <option value="">اختر العميل</option>
              {customerOptions.map(function (c) {
                return <option key={c.customer_id} value={c.customer_id}>{c.name}</option>
              })}
            </select>
            <input type="file" onChange={handleLawyerUpload} disabled={uploading || !selectedCustomer} className="font-['Tajawal'] text-sm" />
          </div>
        )}

        {message && (
          <p className="font-['Tajawal'] text-sm text-[#2F4538] mb-4">{message}</p>
        )}

        {docs.length === 0 && (
          <p className="font-['Tajawal'] text-center text-[#4A473F]">لا توجد وكالات بعد</p>
        )}

        {userType === 'lawyer' && docs.map(renderLawyerDoc)}
        {userType === 'customer' && docs.map(renderCustomerDoc)}
      </div>
    </div>
  )
}