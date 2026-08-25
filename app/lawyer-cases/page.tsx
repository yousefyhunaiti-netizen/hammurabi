'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase'

type CaseFile = {
  id: number
  client_name: string
  file_name: string
  file_url: string
  uploaded_at: string
}

export default function LawyerCasesPage() {
  const [loading, setLoading] = useState(true)
  const [lawyerId, setLawyerId] = useState<number | null>(null)
  const [notAllowed, setNotAllowed] = useState(false)
  const [files, setFiles] = useState<CaseFile[]>([])
  const [clientNameInput, setClientNameInput] = useState('')
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [expandedClient, setExpandedClient] = useState('')

  const supabase = createClient()

  async function loadFiles(id: number) {
    const result = await supabase.from('case_files').select('*').eq('lawyer_id', id).order('uploaded_at', { ascending: false })
    setFiles(result.data || [])
  }

  useEffect(function () {
    async function loadData() {
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

      setLawyerId(lawyerResult.data.id)
      await loadFiles(lawyerResult.data.id)
      setLoading(false)
    }

    loadData()
  }, [])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files || !e.target.files[0] || !lawyerId || !clientNameInput.trim()) {
      setMessage('يرجى إدخال اسم العميل أولاً')
      return
    }

    setUploading(true)
    setMessage('')

    const file = e.target.files[0]
    const filePath = 'case-' + lawyerId + '-' + Date.now() + '-' + file.name

    const uploadResult = await supabase.storage.from('case-files').upload(filePath, file)

    if (uploadResult.error) {
      setUploading(false)
      setMessage('حدث خطأ أثناء الرفع')
      return
    }

    const urlResult = supabase.storage.from('case-files').getPublicUrl(filePath)

    await supabase.from('case_files').insert({
      lawyer_id: lawyerId,
      client_name: clientNameInput,
      file_name: file.name,
      file_url: urlResult.data.publicUrl,
    })

    setUploading(false)
    setMessage('تم رفع الملف بنجاح')
    await loadFiles(lawyerId)
  }

  async function handleDeleteFile(fileId: number) {
    if (!lawyerId) return
    await supabase.from('case_files').delete().eq('id', fileId)
    await loadFiles(lawyerId)
  }

  const clientNames = Array.from(new Set(files.map(function (f) { return f.client_name })))

  function toggleClient(clientName: string) {
    if (expandedClient === clientName) {
      setExpandedClient('')
    } else {
      setExpandedClient(clientName)
    }
  }

  function renderClientGroup(clientName: string) {
    const clientFiles = files.filter(function (f) { return f.client_name === clientName })
    const isExpanded = expandedClient === clientName

    function headerClick() {
      toggleClient(clientName)
    }

    return (
      <div key={clientName} className="bg-white border border-[#D8D2C4] rounded-lg mb-3 overflow-hidden">
        <button onClick={headerClick} className="w-full text-right px-5 py-4 flex justify-between items-center">
          <span className="font-['Tajawal'] font-bold text-[#1B1A17]">{clientName}</span>
          <span className="font-['Tajawal'] text-xs text-[#4A473F]">{clientFiles.length} ملف</span>
        </button>
        {isExpanded && (
          <div className="px-5 pb-4">
            {clientFiles.map(function (f) {
              function deleteClick() {
                handleDeleteFile(f.id)
              }
              return (
                <div key={f.id} className="flex justify-between items-center bg-[#F3EEE4] rounded-md p-3 mb-2">
                  <a href={f.file_url} target="_blank" rel="noopener noreferrer" className="font-['Tajawal'] text-sm text-[#AD8A4E] underline">{f.file_name}</a>
                  <button onClick={deleteClick} className="font-['Tajawal'] text-xs text-[#7A2E2E]">حذف</button>
                </div>
              )
            })}
          </div>
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
        <div className="max-w-2xl mx-auto">
          <h1 className="font-['Amiri'] text-4xl mb-2">ملفات القضايا</h1>
          <div className="w-16 h-[2px] bg-[#AD8A4E]"></div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-6">
          <h2 className="font-['Tajawal'] font-bold text-[#1B1A17] mb-3">رفع ملف جديد</h2>
          <input
            type="text"
            value={clientNameInput}
            onChange={function (e) { setClientNameInput(e.target.value) }}
            placeholder="اسم العميل / القضية"
            className="w-full px-3 py-2 mb-3 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
          />
          <input type="file" onChange={handleUpload} disabled={uploading} className="font-['Tajawal'] text-sm" />
          {message && (
            <p className="mt-3 font-['Tajawal'] text-sm text-[#2F4538]">{message}</p>
          )}
        </div>

        {clientNames.length === 0 && (
          <p className="font-['Tajawal'] text-center text-[#4A473F]">لا توجد ملفات بعد</p>
        )}

        {clientNames.map(renderClientGroup)}
      </div>
    </div>
  )
}