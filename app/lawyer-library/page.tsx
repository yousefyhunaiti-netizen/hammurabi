'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase'

type LibraryItem = {
  id: number
  title: string
  content: string | null
  link: string | null
  specialty_id: number | null
  is_pinned: boolean | null
  file_url: string | null
  summary: string | null
  created_at: string
}

type Specialty = {
  id: number
  name_ar: string
}

export default function LawyerLibraryPage() {
  const [loading, setLoading] = useState(true)
  const [lawyerId, setLawyerId] = useState<number | null>(null)
  const [notAllowed, setNotAllowed] = useState(false)
  const [notSubscribed, setNotSubscribed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [items, setItems] = useState<LibraryItem[]>([])
  const [specialties, setSpecialties] = useState<Specialty[]>([])
  const [search, setSearch] = useState('')
  const [specialtyFilter, setSpecialtyFilter] = useState('')

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [link, setLink] = useState('')
  const [specialtyId, setSpecialtyId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [summarizing, setSummarizing] = useState(false)
  const [draftSummary, setDraftSummary] = useState('')

  const [openItem, setOpenItem] = useState<LibraryItem | null>(null)
  const [copiedId, setCopiedId] = useState<number | null>(null)

  const supabase = createClient()

  async function loadItems(id: number) {
    const result = await supabase.from('library_items').select('*').eq('lawyer_id', id).order('created_at', { ascending: false })
    setItems(result.data || [])
  }

  useEffect(function () {
    async function loadData() {
      const userResult = await supabase.auth.getUser()

      if (!userResult.data.user) {
        setNotAllowed(true)
        setLoading(false)
        return
      }

      const lawyerResult = await supabase.from('lawyers').select('id, is_active, is_comped').eq('user_id', userResult.data.user.id).maybeSingle()

      if (!lawyerResult.data) {
        setNotAllowed(true)
        setLoading(false)
        return
      }

      if (!lawyerResult.data.is_active && !lawyerResult.data.is_comped) {
        setNotSubscribed(true)
        setLoading(false)
        return
      }

      setLawyerId(lawyerResult.data.id)

      const specialtiesResult = await supabase.from('specialties').select('*')
      setSpecialties(specialtiesResult.data || [])

      await loadItems(lawyerResult.data.id)
      setLoading(false)
    }

    loadData()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    setMenuOpen(false)
  }

  function toggleMenu() {
    setMenuOpen(!menuOpen)
  }

  async function handleSummarize() {
    if (!content.trim()) return
    setSummarizing(true)

    const response = await fetch('/api/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: content }),
    })

    const data = await response.json()
    setDraftSummary(data.summary)
    setSummarizing(false)
  }

  async function handleAddItem() {
    if (!title.trim() || !lawyerId) return
    setSaving(true)

    let uploadedFileUrl = ''
    if (file) {
      const filePath = 'lib-' + lawyerId + '-' + Date.now() + '-' + file.name
      const uploadResult = await supabase.storage.from('library-files').upload(filePath, file)
      if (!uploadResult.error) {
        const urlResult = supabase.storage.from('library-files').getPublicUrl(filePath)
        uploadedFileUrl = urlResult.data.publicUrl
      }
    }

    await supabase.from('library_items').insert({
      lawyer_id: lawyerId,
      title: title,
      content: content,
      link: link,
      specialty_id: specialtyId ? Number(specialtyId) : null,
      file_url: uploadedFileUrl || null,
      summary: draftSummary || null,
    })

    setTitle('')
    setContent('')
    setLink('')
    setSpecialtyId('')
    setFile(null)
    setDraftSummary('')
    await loadItems(lawyerId)
    setSaving(false)
  }

  async function handleDeleteItem(itemId: number) {
    if (!lawyerId) return
    await supabase.from('library_items').delete().eq('id', itemId)
    setOpenItem(null)
    await loadItems(lawyerId)
  }

  async function handleTogglePin(item: LibraryItem) {
    if (!lawyerId) return
    await supabase.from('library_items').update({ is_pinned: !item.is_pinned }).eq('id', item.id)
    await loadItems(lawyerId)
  }

  function handleCopy(item: LibraryItem) {
    const textToCopy = (item.title || '') + '\n\n' + (item.content || '')
    navigator.clipboard.writeText(textToCopy)
    setCopiedId(item.id)
    setTimeout(function () { setCopiedId(null) }, 1500)
  }

  function getSpecialtyName(id: number | null) {
    if (!id) return ''
    const found = specialties.find(function (s) { return s.id === id })
    return found ? found.name_ar : ''
  }

  const filteredItems = items
    .filter(function (item) {
      const specialtyMatch = specialtyFilter ? item.specialty_id === Number(specialtyFilter) : true
      if (!specialtyMatch) return false
      if (!search.trim()) return true
      const lower = search.toLowerCase()
      return item.title.toLowerCase().indexOf(lower) !== -1 || (item.content || '').toLowerCase().indexOf(lower) !== -1
    })
    .sort(function (a, b) {
      const aPinned = a.is_pinned ? 1 : 0
      const bPinned = b.is_pinned ? 1 : 0
      if (aPinned !== bPinned) return bPinned - aPinned
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

  function renderItem(item: LibraryItem) {
    function cardClick() {
      setOpenItem(item)
    }

    function pinClick(e: React.MouseEvent) {
      e.stopPropagation()
      handleTogglePin(item)
    }

    function copyClick(e: React.MouseEvent) {
      e.stopPropagation()
      handleCopy(item)
    }

    return (
      <div key={item.id} onClick={cardClick} className="cursor-pointer bg-white border border-[#D8D2C4] rounded-lg p-5 mb-3 hover:border-[#AD8A4E] transition">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-['Tajawal'] font-bold text-[#1B1A17]">{item.title}</h3>
          <button onClick={pinClick} className="cursor-pointer text-lg">{item.is_pinned ? '⭐' : '☆'}</button>
        </div>
        {item.specialty_id && (
          <span className="inline-block px-2 py-0.5 bg-[#F3EEE4] text-[#AD8A4E] text-xs font-['Tajawal'] rounded-full mb-2">{getSpecialtyName(item.specialty_id)}</span>
        )}
        {item.summary && <p className="font-['Tajawal'] text-xs text-[#AD8A4E] mb-2">📝 {item.summary}</p>}
        {item.content && <p className="font-['Tajawal'] text-sm text-[#4A473F] line-clamp-2 mb-2">{item.content}</p>}
        <div className="flex items-center justify-between">
          <p className="font-['Tajawal'] text-xs text-[#4A473F]">آخر تحديث: {new Date(item.created_at).toLocaleDateString('en-GB')}</p>
          <button onClick={copyClick} className="cursor-pointer font-['Tajawal'] text-xs text-[#4A473F] hover:text-[#AD8A4E]">
            {copiedId === item.id ? '✓ تم النسخ' : '📋 نسخ'}
          </button>
        </div>
      </div>
    )
  }

  function renderModal() {
    if (!openItem) return null
    const item = openItem

    function closeModal() {
      setOpenItem(null)
    }

    function stopPropagation(e: React.MouseEvent) {
      e.stopPropagation()
    }

    function deleteClick() {
      handleDeleteItem(item.id)
    }

    function copyClick() {
      handleCopy(item)
    }

    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4" onClick={closeModal}>
        <div className="bg-white rounded-lg max-w-lg w-full max-h-[85vh] overflow-y-auto p-6" onClick={stopPropagation}>
          <div className="flex justify-between items-start mb-3">
            <h2 className="font-['Tajawal'] font-bold text-xl text-[#1B1A17]">{item.title}</h2>
            <button onClick={closeModal} className="cursor-pointer text-[#4A473F] text-2xl leading-none">×</button>
          </div>

          {item.specialty_id && (
            <span className="inline-block px-2 py-0.5 bg-[#F3EEE4] text-[#AD8A4E] text-xs font-['Tajawal'] rounded-full mb-3">{getSpecialtyName(item.specialty_id)}</span>
          )}

          {item.summary && (
            <div className="bg-[#F3EEE4] rounded-md p-3 mb-3">
              <p className="font-['Tajawal'] text-xs font-bold text-[#AD8A4E] mb-1">الملخص</p>
              <p className="font-['Tajawal'] text-sm text-[#1B1A17]">{item.summary}</p>
            </div>
          )}

          {item.content && <p className="font-['Tajawal'] text-sm text-[#4A473F] whitespace-pre-wrap mb-3">{item.content}</p>}

          {item.link && (
            <a href={item.link} target="_blank" rel="noopener noreferrer" className="block font-['Tajawal'] text-sm text-[#AD8A4E] underline mb-2">فتح الرابط</a>
          )}

          {item.file_url && (
            <a href={item.file_url} target="_blank" rel="noopener noreferrer" className="block font-['Tajawal'] text-sm text-[#AD8A4E] underline mb-3">عرض الملف المرفق</a>
          )}

          <p className="font-['Tajawal'] text-xs text-[#4A473F] mb-4">آخر تحديث: {new Date(item.created_at).toLocaleDateString('en-GB')}</p>

          <div className="flex gap-2">
            <button onClick={copyClick} className="cursor-pointer flex-1 py-2 bg-[#F3EEE4] text-[#4A473F] rounded-md font-['Tajawal'] text-sm">
              {copiedId === item.id ? '✓ تم النسخ' : '📋 نسخ النص'}
            </button>
            <button onClick={deleteClick} className="cursor-pointer flex-1 py-2 bg-[#7A2E2E] text-white rounded-md font-['Tajawal'] text-sm">حذف</button>
          </div>
        </div>
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

  if (notSubscribed) {
    return (
      <div dir="rtl" className="min-h-screen pattern-bg flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="bg-white border-2 border-[#AD8A4E] rounded-lg p-8">
            <h1 className="font-['Amiri'] text-2xl text-[#1B1A17] mb-3">يلزم الاشتراك للوصول إلى المكتبة</h1>
            <a href="/subscription" className="inline-block mt-4 px-6 py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal']">عرض خطط الاشتراك</a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div dir="rtl" className="min-h-screen pattern-bg">
      <div className="bg-[#1B1A17] text-[#F3EEE4] py-12 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-8 font-['Tajawal'] text-sm">
            <a href="/"><img src="/logo.png" alt="حمورابي" className="h-12 w-auto" /></a>
            <div className="flex gap-5 items-center">
              <a href="/my-appointments" className="hover:text-[#AD8A4E] transition">مواعيدي</a>
              <a href="/my-consultations" className="hover:text-[#AD8A4E] transition">استشاراتي</a>
              <a href="/ai-assistant" className="hover:text-[#AD8A4E] transition">مساعد ذكي</a>
              <a href="/lawyer-tools" className="hover:text-[#AD8A4E] transition">أدواتي</a>
              <a href="/community" className="hover:text-[#AD8A4E] transition">المجتمع</a>
              <a href="/lawyer-messages" className="relative hover:text-[#AD8A4E] transition">
                <svg className="w-5 h-5 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
              </a>
              <div className="relative">
                <button onClick={toggleMenu} className="w-8 h-8 rounded-full bg-[#AD8A4E] flex items-center justify-center hover:bg-[#c49b58] transition">
                  <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.5c-3.3 0-9.8 1.6-9.8 4.9v2.4h19.6v-2.4c0-3.3-6.5-4.9-9.8-4.9z" /></svg>
                </button>
                {menuOpen && (
                  <div className="absolute left-0 top-full mt-2 w-52 bg-white border border-[#D8D2C4] rounded-md shadow-lg overflow-hidden z-20">
                    <a href="/lawyer-info" className="block px-4 py-3 font-['Tajawal'] text-sm text-[#1B1A17] hover:bg-[#F3EEE4] transition">معلوماتي الشخصية</a>
                    <button onClick={handleLogout} className="w-full text-right px-4 py-3 font-['Tajawal'] text-sm text-[#7A2E2E] hover:bg-[#F3EEE4] transition border-t border-[#D8D2C4]">تسجيل الخروج</button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <h1 className="font-['Tajawal'] font-bold text-4xl mb-2">مكتبتي القانونية ({items.length})</h1>
          <p className="font-['Tajawal'] text-sm text-[#D8D2C4]">احفظ القوانين والملاحظات والملفات المهمة، ولخّصها بالذكاء الاصطناعي</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="bg-white border-2 border-[#AD8A4E] rounded-lg p-6 mb-6">
          <h2 className="font-['Tajawal'] font-bold text-[#1B1A17] mb-3">إضافة عنصر جديد</h2>
          <div className="space-y-3">
            <input type="text" value={title} onChange={function (e) { setTitle(e.target.value) }} placeholder="العنوان" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />

            <select value={specialtyId} onChange={function (e) { setSpecialtyId(e.target.value) }} className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]">
              <option value="">اختر التخصص (اختياري)</option>
              {specialties.map(function (s) { return <option key={s.id} value={s.id}>{s.name_ar}</option> })}
            </select>

            <textarea value={content} onChange={function (e) { setContent(e.target.value) }} rows={4} placeholder="ملاحظات أو نص القانون" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />

            <button onClick={handleSummarize} disabled={summarizing || !content.trim()} className="w-full py-2 bg-[#2F4538] text-white rounded-md font-['Tajawal'] text-sm disabled:opacity-50">
              {summarizing ? 'جاري التلخيص...' : '✨ تلخيص بالذكاء الاصطناعي'}
            </button>

            {draftSummary && (
              <div className="bg-[#F3EEE4] rounded-md p-3">
                <p className="font-['Tajawal'] text-xs text-[#AD8A4E] mb-1">الملخص المقترح:</p>
                <p className="font-['Tajawal'] text-sm text-[#1B1A17]">{draftSummary}</p>
              </div>
            )}

            <input type="text" value={link} onChange={function (e) { setLink(e.target.value) }} placeholder="رابط (اختياري)" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />

            <label className="cursor-pointer inline-block px-4 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-xs text-[#4A473F] hover:bg-[#D8D2C4] transition">
              📎 {file ? file.name : 'إرفاق ملف (اختياري)'}
              <input type="file" onChange={function (e) { setFile(e.target.files ? e.target.files[0] : null) }} className="hidden" />
            </label>

            <button onClick={handleAddItem} disabled={saving} className="w-full py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal'] font-medium hover:bg-[#AD8A4E] transition disabled:opacity-60">
              {saving ? 'جاري الحفظ...' : 'حفظ'}
            </button>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <input type="text" value={search} onChange={function (e) { setSearch(e.target.value) }} placeholder="ابحث في مكتبتك..." className="flex-1 px-3 py-2 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
          <select value={specialtyFilter} onChange={function (e) { setSpecialtyFilter(e.target.value) }} className="px-3 py-2 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]">
            <option value="">كل التخصصات</option>
            {specialties.map(function (s) { return <option key={s.id} value={s.id}>{s.name_ar}</option> })}
          </select>
        </div>

        {filteredItems.length === 0 && (
          <p className="font-['Tajawal'] text-center text-[#4A473F]">لا توجد عناصر مطابقة</p>
        )}

        {filteredItems.map(renderItem)}
      </div>

      {renderModal()}
    </div>
  )
}