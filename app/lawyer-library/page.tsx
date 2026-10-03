'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'
import { authHeaders, uploadOwnFile, openPrivateFile } from '../lib/files'
import { safeLink } from '../lib/safeLink'
import { getLawyerBadgeCount, getFirmBadgeCount } from '../lib/badges'
import Footer from '../components/Footer'
import HeaderLines from '../components/HeaderLines'
import Loader from '../components/Loader'
import { isInternational } from '../lib/international'

type LibraryItem = {
  id: number
  lawyer_id: number | null
  firm_id: number | null
  title: string
  content: string | null
  link: string | null
  specialty_id: number | null
  is_pinned: boolean | null
  file_url: string | null
  summary: string | null
  item_type: string | null
  tags: string[] | null
  law_reference: string | null
  case_id: number | null
  created_at: string
  updated_at: string | null
}

type LegalCase = {
  id: number
  case_number: string
  client_name: string
}

const typeOptions = [
  { key: 'law', label: 'قانون', icon: '📜', color: '#AD8A4E' },
  { key: 'ruling', label: 'قرار', icon: '⚖️', color: '#2F4538' },
]

// Items saved before the library was limited to laws and rulings
const otherType = { key: 'other', label: 'أخرى', icon: '🗂️', color: '#4A473F' }

function getTypeInfo(key: string | null) {
  const found = typeOptions.find(function (t) { return t.key === key })
  return found ? found : otherType
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear()
}

function parseTags(text: string) {
  const parts = text.split(/[,،]/).map(function (t) { return t.trim() }).filter(function (t) { return t !== '' })
  const unique: string[] = []
  parts.forEach(function (t) {
    if (unique.indexOf(t) === -1) unique.push(t)
  })
  return unique.slice(0, 8)
}

export default function LawyerLibraryPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  // قرارك is the Jordanian bar's platform: not shown to lawyers abroad
  const [abroad, setAbroad] = useState(false)
  const [accountType, setAccountType] = useState<'lawyer' | 'firm'>('lawyer')
  const [accountId, setAccountId] = useState<number | null>(null)
  const [notAllowed, setNotAllowed] = useState(false)
  const [notSubscribed, setNotSubscribed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [totalUnread, setTotalUnread] = useState(0)
  const [pendingConsultations, setPendingConsultations] = useState(0)
  const [items, setItems] = useState<LibraryItem[]>([])
  const [cases, setCases] = useState<LegalCase[]>([])

  const [search, setSearch] = useState('')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [sortBy, setSortBy] = useState('updated')
  const [viewMode, setViewMode] = useState('cards')

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [itemType, setItemType] = useState('law')
  const [title, setTitle] = useState('')
  const [lawReference, setLawReference] = useState('')
  const [content, setContent] = useState('')
  const [link, setLink] = useState('')
  const [caseId, setCaseId] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [existingFileUrl, setExistingFileUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [summarizing, setSummarizing] = useState(false)
  const [draftSummary, setDraftSummary] = useState('')
  const [formError, setFormError] = useState('')

  const [openItem, setOpenItem] = useState<LibraryItem | null>(null)
  const [copiedId, setCopiedId] = useState<number | null>(null)

  const supabase = createClient()
  const menuRef = useRef<HTMLDivElement>(null)
  const ownerColumn = accountType === 'firm' ? 'firm_id' : 'lawyer_id'

  useEffect(function () {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return function () {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  function countConversations(rows: any[]) {
    const senders = new Set(rows.map(function (m) {
      return m.sender_lawyer_id ? 'lawyer-' + m.sender_lawyer_id : 'firm-' + m.sender_firm_id
    }))
    return senders.size
  }

  async function loadItems(type: 'lawyer' | 'firm', id: number) {
    const column = type === 'firm' ? 'firm_id' : 'lawyer_id'
    const result = await supabase.from('library_items').select('*').eq(column, id).order('created_at', { ascending: false })
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

      const userId = userResult.data.user.id

      const lawyerResult = await supabase.from('lawyers').select('id, is_active, is_comped, country').eq('user_id', userId).maybeSingle()
      if (lawyerResult.data) setAbroad(isInternational(lawyerResult.data.country))

      if (lawyerResult.data) {
        if (!lawyerResult.data.is_active && !lawyerResult.data.is_comped) {
          setNotSubscribed(true)
          setLoading(false)
          return
        }

        setAccountType('lawyer')
        setAccountId(lawyerResult.data.id)

        const unreadResult = await supabase.from('lawyer_messages').select('sender_lawyer_id, sender_firm_id').eq('recipient_lawyer_id', lawyerResult.data.id).eq('is_read', false)
        setTotalUnread(countConversations(unreadResult.data || []))

        setPendingConsultations(await getLawyerBadgeCount(supabase, lawyerResult.data.id))

        const casesResult = await supabase.from('legal_cases').select('id, case_number, client_name').eq('lawyer_id', lawyerResult.data.id).order('id', { ascending: false })
        setCases(casesResult.data || [])

        await loadItems('lawyer', lawyerResult.data.id)
        setLoading(false)
        return
      }

      const firmResult = await supabase.from('firms').select('*').eq('user_id', userId).maybeSingle()
      if (firmResult.data) setAbroad(isInternational(firmResult.data.country))

      if (!firmResult.data) {
        setNotAllowed(true)
        setLoading(false)
        return
      }

      const firmRow: any = firmResult.data

      if (!firmRow.is_active && !firmRow.is_comped) {
        setNotSubscribed(true)
        setLoading(false)
        return
      }

      setAccountType('firm')
      setAccountId(firmRow.id)

      const firmUnreadResult = await supabase.from('lawyer_messages').select('sender_lawyer_id, sender_firm_id').eq('recipient_firm_id', firmRow.id).eq('is_read', false)
      setTotalUnread(countConversations(firmUnreadResult.data || []))

      setPendingConsultations(await getFirmBadgeCount(supabase, firmRow.id))

      await loadItems('firm', firmRow.id)
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

  function resetForm() {
    setEditingId(null)
    setItemType('law')
    setTitle('')
    setLawReference('')
    setContent('')
    setLink('')
    setCaseId('')
    setTagsInput('')
    setFile(null)
    setExistingFileUrl('')
    setDraftSummary('')
    setFormError('')
  }

  function toggleForm() {
    resetForm()
    setShowForm(!showForm)
  }

  function startEdit(item: LibraryItem) {
    setEditingId(item.id)
    setItemType(item.item_type === 'ruling' ? 'ruling' : 'law')
    setTitle(item.title)
    setLawReference(item.law_reference || '')
    setContent(item.content || '')
    setLink(item.link || '')
    setCaseId(item.case_id ? String(item.case_id) : '')
    setTagsInput((item.tags || []).join('، '))
    setFile(null)
    setExistingFileUrl(item.file_url || '')
    setDraftSummary(item.summary || '')
    setFormError('')
    setOpenItem(null)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSummarize() {
    if (!content.trim()) return
    setSummarizing(true)
    setFormError('')

    try {
      const response = await fetch('/api/summarize', {
        method: 'POST',
        headers: await authHeaders(supabase),
        body: JSON.stringify({ text: content }),
      })
      const data = await response.json()
      if (!response.ok || !data.summary) {
        setFormError(data.error || 'تعذر تلخيص النص، حاول مرة أخرى')
      } else {
        setDraftSummary(data.summary)
      }
    } catch (err) {
      setFormError('تعذر تلخيص النص، حاول مرة أخرى')
    }

    setSummarizing(false)
  }

  async function handleSaveItem() {
    if (!accountId) return
    if (!title.trim()) {
      setFormError('يرجى كتابة العنوان')
      return
    }

    setSaving(true)
    setFormError('')

    let uploadedFileUrl = ''
    if (file) {
      const storedPath = await uploadOwnFile(supabase, 'library-files', file)
      if (!storedPath) {
        setFormError('تعذر رفع الملف، حاول مرة أخرى')
        setSaving(false)
        return
      }
      uploadedFileUrl = storedPath
    }

    const payload: any = {
      title: title.trim(),
      content: content,
      link: link,
      item_type: itemType,
      law_reference: lawReference.trim() || null,
      tags: parseTags(tagsInput),
      summary: draftSummary || null,
    }

    if (uploadedFileUrl) {
      payload.file_url = uploadedFileUrl
    }

    if (accountType === 'lawyer') {
      payload.case_id = caseId ? Number(caseId) : null
    }

    if (editingId) {
      payload.updated_at = new Date().toISOString()
      const updateResult = await supabase.from('library_items').update(payload).eq('id', editingId).eq(ownerColumn, accountId).select('id')
      if (updateResult.error || !updateResult.data || updateResult.data.length === 0) {
        setFormError('تعذر حفظ التعديلات، حاول مرة أخرى')
        setSaving(false)
        return
      }
    } else {
      payload[ownerColumn] = accountId
      const insertResult = await supabase.from('library_items').insert(payload)
      if (insertResult.error) {
        setFormError('تعذر الحفظ، حاول مرة أخرى')
        setSaving(false)
        return
      }
    }

    resetForm()
    setShowForm(false)
    await loadItems(accountType, accountId)
    setSaving(false)
  }

  async function handleDeleteItem(itemId: number) {
    if (!accountId) return
    if (!window.confirm('هل أنت متأكد من حذف هذا العنصر؟')) return
    await supabase.from('library_items').delete().eq('id', itemId)
    setOpenItem(null)
    await loadItems(accountType, accountId)
  }

  async function handleTogglePin(item: LibraryItem) {
    if (!accountId) return
    await supabase.from('library_items').update({ is_pinned: !item.is_pinned }).eq('id', item.id)
    if (openItem && openItem.id === item.id) {
      setOpenItem({ ...openItem, is_pinned: !item.is_pinned })
    }
    await loadItems(accountType, accountId)
  }

  function handleCopy(item: LibraryItem) {
    const parts = [item.title || '']
    if (item.law_reference) parts.push(item.law_reference)
    if (item.content) parts.push(item.content)
    if (item.link) parts.push(item.link)
    navigator.clipboard.writeText(parts.join('\n\n'))
    setCopiedId(item.id)
    setTimeout(function () { setCopiedId(null) }, 1500)
  }

  function getCaseLabel(id: number | null) {
    if (!id) return ''
    const found = cases.find(function (c) { return c.id === id })
    return found ? 'قضية ' + found.case_number : ''
  }

  const lowerSearch = search.trim().toLowerCase()

  const filteredItems = items
    .filter(function (item) {
      if (favoritesOnly && !item.is_pinned) return false
      if (!lowerSearch) return true
      const haystack = [item.title, item.content || '', item.summary || '', item.law_reference || '', (item.tags || []).join(' ')].join(' ').toLowerCase()
      return haystack.indexOf(lowerSearch) !== -1
    })
    .sort(function (a, b) {
      const aPinned = a.is_pinned ? 1 : 0
      const bPinned = b.is_pinned ? 1 : 0
      if (aPinned !== bPinned) return bPinned - aPinned
      if (sortBy === 'title') return a.title.localeCompare(b.title, 'ar')
      if (sortBy === 'created') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
    })

  const favoritesCount = items.filter(function (item) { return item.is_pinned }).length

  function renderItem(item: LibraryItem) {
    const typeInfo = getTypeInfo(item.item_type)
    const itemTags = item.tags || []

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

    if (viewMode === 'list') {
      return (
        <div key={item.id} onClick={cardClick} style={{ borderRightColor: typeInfo.color }} className="cursor-pointer flex items-center gap-3 bg-white border border-[#D8D2C4] border-r-4 rounded-md px-4 py-3 mb-2 hover:border-[#AD8A4E] transition">
          <span className="text-lg flex-shrink-0">{typeInfo.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="font-['Tajawal'] font-bold text-sm text-[#1B1A17] truncate">{item.title}</p>
            <p className="font-['Tajawal'] text-xs text-[#4A473F] truncate">{typeInfo.label}{item.law_reference ? ' — ' + item.law_reference : ''}</p>
          </div>
          <p className="font-['Tajawal'] text-xs text-[#4A473F] flex-shrink-0 hidden sm:block">{formatDate(item.updated_at || item.created_at)}</p>
          <button onClick={pinClick} className="cursor-pointer text-lg flex-shrink-0 text-[#AD8A4E]">{item.is_pinned ? '⭐' : '☆'}</button>
        </div>
      )
    }

    return (
      <div key={item.id} onClick={cardClick} style={{ borderRightColor: typeInfo.color }} className="cursor-pointer bg-white border border-[#D8D2C4] border-r-4 rounded-lg p-5 mb-3 hover:border-[#AD8A4E] transition">
        <div className="flex justify-between items-start gap-3 mb-2">
          <div className="flex flex-wrap items-center gap-2">
            <span style={{ backgroundColor: typeInfo.color }} className="px-2 py-0.5 rounded-full text-xs text-white font-['Tajawal']">{typeInfo.icon} {typeInfo.label}</span>
            {item.case_id && getCaseLabel(item.case_id) && (
              <span className="px-2 py-0.5 bg-[#F3EEE4] text-[#AD8A4E] text-xs font-['Tajawal'] rounded-full">⚖️ {getCaseLabel(item.case_id)}</span>
            )}
            {item.file_url && <span className="text-xs text-[#4A473F] font-['Tajawal']">📎 ملف</span>}
          </div>
          <button onClick={pinClick} className="cursor-pointer text-lg flex-shrink-0 text-[#AD8A4E]">{item.is_pinned ? '⭐' : '☆'}</button>
        </div>

        <h3 className="font-['Tajawal'] font-bold text-[#1B1A17] mb-1">{item.title}</h3>
        {item.law_reference && <p className="font-['Tajawal'] text-xs text-[#AD8A4E] mb-2">{item.law_reference}</p>}
        {item.summary && <p className="font-['Tajawal'] text-xs text-[#4A473F] bg-[#F3EEE4] rounded-md p-2 mb-2 line-clamp-2">📝 {item.summary}</p>}
        {item.content && <p className="font-['Tajawal'] text-sm text-[#4A473F] line-clamp-2 mb-2">{item.content}</p>}

        {itemTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {itemTags.map(function (tag) {
              function tagClick(e: React.MouseEvent) {
                e.stopPropagation()
                setSearch(tag)
              }
              return (
                <button key={tag} onClick={tagClick} className="cursor-pointer px-2 py-0.5 bg-white border border-[#D8D2C4] text-[#4A473F] hover:border-[#AD8A4E] text-xs font-['Tajawal'] rounded-full transition">#{tag}</button>
              )
            })}
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-[#F3EEE4]">
          <p className="font-['Tajawal'] text-xs text-[#4A473F]">آخر تحديث: {formatDate(item.updated_at || item.created_at)}</p>
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
    const typeInfo = getTypeInfo(item.item_type)
    const itemTags = item.tags || []

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

    function editClick() {
      startEdit(item)
    }

    function pinClick() {
      handleTogglePin(item)
    }

    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4" onClick={closeModal}>
        <div className="bg-white rounded-lg max-w-lg w-full max-h-[85vh] overflow-y-auto p-6" onClick={stopPropagation}>
          <div className="flex justify-between items-start mb-3">
            <div className="flex flex-wrap items-center gap-2">
              <span style={{ backgroundColor: typeInfo.color }} className="px-2 py-0.5 rounded-full text-xs text-white font-['Tajawal']">{typeInfo.icon} {typeInfo.label}</span>
              {item.case_id && getCaseLabel(item.case_id) && (
                <span className="px-2 py-0.5 bg-[#F3EEE4] text-[#AD8A4E] text-xs font-['Tajawal'] rounded-full">⚖️ {getCaseLabel(item.case_id)}</span>
              )}
            </div>
            <button onClick={closeModal} className="cursor-pointer text-[#4A473F] text-2xl leading-none">×</button>
          </div>

          <h2 className="font-['Tajawal'] font-bold text-xl text-[#1B1A17] mb-1">{item.title}</h2>
          {item.law_reference && <p className="font-['Tajawal'] text-sm text-[#AD8A4E] mb-3">{item.law_reference}</p>}

          {item.summary && (
            <div className="bg-[#F3EEE4] rounded-md p-3 mb-3">
              <p className="font-['Tajawal'] text-xs font-bold text-[#AD8A4E] mb-1">الملخص</p>
              <p className="font-['Tajawal'] text-sm text-[#1B1A17]">{item.summary}</p>
            </div>
          )}

          {item.content && <p className="font-['Tajawal'] text-sm text-[#4A473F] leading-relaxed whitespace-pre-wrap mb-3">{item.content}</p>}

          {itemTags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {itemTags.map(function (tag) {
                return <span key={tag} className="px-2 py-0.5 bg-[#F3EEE4] text-[#4A473F] text-xs font-['Tajawal'] rounded-full">#{tag}</span>
              })}
            </div>
          )}

          {item.link && (
            <a href={safeLink(item.link)} target="_blank" rel="noopener noreferrer" className="block font-['Tajawal'] text-sm text-[#AD8A4E] underline mb-2">
              فتح الرابط
            </a>
          )}

          {item.file_url && (
            <button type="button" onClick={function () { openPrivateFile(supabase, 'library-files', item.file_url as string) }} className="block font-['Tajawal'] text-sm text-[#AD8A4E] underline mb-3">عرض الملف المرفق</button>
          )}

          <p className="font-['Tajawal'] text-xs text-[#4A473F] mb-1">أضيف في: {formatDate(item.created_at)}</p>
          <p className="font-['Tajawal'] text-xs text-[#4A473F] mb-4">آخر تحديث: {formatDate(item.updated_at || item.created_at)}</p>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={editClick} className="cursor-pointer py-2 bg-[#1B1A17] text-[#F3EEE4] hover:bg-[#AD8A4E] transition rounded-md font-['Tajawal'] text-sm">✏️ تعديل</button>
            <button onClick={pinClick} className="cursor-pointer py-2 bg-[#F3EEE4] text-[#4A473F] rounded-md font-['Tajawal'] text-sm">{item.is_pinned ? '⭐ إزالة من المفضلة' : '☆ إضافة إلى المفضلة'}</button>
            <button onClick={copyClick} className="cursor-pointer py-2 bg-[#F3EEE4] text-[#4A473F] rounded-md font-['Tajawal'] text-sm">
              {copiedId === item.id ? '✓ تم النسخ' : '📋 نسخ النص'}
            </button>
            <button onClick={deleteClick} className="cursor-pointer py-2 bg-[#7A2E2E] text-white rounded-md font-['Tajawal'] text-sm">🗑️ حذف</button>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div dir="rtl" className="min-h-screen pattern-bg flex items-center justify-center">
        <Loader />
      </div>
    )
  }

  if (notAllowed) {
    return (
      <div dir="rtl" className="min-h-screen pattern-bg flex items-center justify-center px-6">
        <div className="text-center">
          <p className="font-['Tajawal'] text-[#4A473F] mb-4">هذه الصفحة مخصصة لحسابات المحامين والمكاتب فقط</p>
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
            <h1 className="font-['Tajawal'] font-bold text-2xl text-[#1B1A17] mb-3">يلزم الاشتراك للوصول إلى المكتبة</h1>
            <a href="/subscription" className="inline-block mt-4 px-6 py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal']">عرض خطط الاشتراك</a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div dir="rtl" className="min-h-screen pattern-bg flex flex-col">
      <div className="hm-header bg-[#1B1A17] text-[#F3EEE4] py-12 px-6">
        <HeaderLines />
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-8 font-['Tajawal'] text-sm">
            <a href="/"><img src="/logo.png" alt="حمورابي" className="h-12 w-auto" /></a>
            <div className="flex gap-5 items-center">
              {accountType === 'firm' && (
                <a href="/firm-dashboard" className="hover:text-[#AD8A4E] transition">لوحة التحكم</a>
              )}
              <a href="/lawyer-tools" className="hover:text-[#AD8A4E] transition">أدواتي</a>
              <a href="/ai-assistant" className="hover:text-[#AD8A4E] transition">مساعد ذكي</a>
              <a href="/community" className="hover:text-[#AD8A4E] transition">المجتمع</a>
              <a href="/lawyer-messages" className="relative hover:text-[#AD8A4E] transition">
                <svg className="w-5 h-5 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
                {totalUnread > 0 && (
                  <span className="absolute -top-2 -left-2 bg-[#7A2E2E] text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{totalUnread}</span>
                )}
              </a>
              <div className="relative" ref={menuRef}>
                <button onClick={toggleMenu} className="relative w-8 h-8 rounded-full bg-[#AD8A4E] flex items-center justify-center hover:bg-[#c49b58] transition">
                  <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.5c-3.3 0-9.8 1.6-9.8 4.9v2.4h19.6v-2.4c0-3.3-6.5-4.9-9.8-4.9z" /></svg>
                  {pendingConsultations > 0 && (
                    <span className="absolute -top-1 -left-1 bg-[#7A2E2E] text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{pendingConsultations}</span>
                  )}
                </button>
                {menuOpen && (
                  <div className="absolute left-0 top-full mt-2 w-52 bg-white border border-[#D8D2C4] rounded-md shadow-lg overflow-hidden z-20">
                    <a href="/subscription" className="block px-4 py-3 font-['Tajawal'] text-sm text-[#1B1A17] hover:bg-[#F3EEE4] transition">ترقية الاشتراك</a>
                    <a href={accountType === 'firm' ? '/firm-info' : '/lawyer-info'} className="block px-4 py-3 font-['Tajawal'] text-sm text-[#1B1A17] hover:bg-[#F3EEE4] transition border-t border-[#D8D2C4]">معلوماتي الشخصية</a>
                    <a href="/lawyer-history" className="relative block px-4 py-3 font-['Tajawal'] text-sm text-[#1B1A17] hover:bg-[#F3EEE4] transition border-t border-[#D8D2C4]">
                      المواعيد والاستشارات
                      {pendingConsultations > 0 && (
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 bg-[#7A2E2E] text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{pendingConsultations}</span>
                      )}
                    </a>
                    <button onClick={handleLogout} className="w-full text-right px-4 py-3 font-['Tajawal'] text-sm text-[#7A2E2E] hover:bg-[#F3EEE4] transition border-t border-[#D8D2C4]">تسجيل الخروج</button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <h1 className="font-['Tajawal'] font-bold text-4xl mb-2">مكتبتي القانونية ({items.length})</h1>
          <p className="font-['Tajawal'] text-sm text-[#D8D2C4]">احفظ القوانين والقرارات التي تعتمد عليها، واربطها بقضاياك، ولخّصها بالذكاء الاصطناعي</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10 flex-1 w-full">
        {!abroad && (
        <div className="bg-white border border-[#D8D2C4] rounded-lg p-4 mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="font-['Tajawal'] font-bold text-sm text-[#1B1A17] mb-1">⚖️ قرارك</p>
            <p className="font-['Tajawal'] text-xs text-[#4A473F] leading-relaxed">منصة نقابة المحامين الأردنيين للقرارات والتشريعات. سجّل الدخول برقمك النقابي، ثم احفظ هنا ما تعتمد عليه مع رابطه.</p>
          </div>
          <a href="https://www.qarark.com" target="_blank" rel="noopener noreferrer" className="flex-shrink-0 px-4 py-2 bg-[#1B1A17] text-[#F3EEE4] hover:bg-[#AD8A4E] transition rounded-md font-['Tajawal'] text-xs">فتح قرارك</a>
        </div>
        )}

        <button onClick={toggleForm} className="px-5 py-2 bg-[#AD8A4E] text-white rounded-md font-['Tajawal'] text-sm mb-6">
          {showForm ? 'إلغاء' : '+ إضافة بند/قرار'}
        </button>

        {showForm && (
          <div className="bg-white border-2 border-[#AD8A4E] rounded-lg p-6 mb-6">
            <h2 className="font-['Tajawal'] font-bold text-[#1B1A17] mb-3">{editingId ? 'تعديل البند/القرار' : 'إضافة بند/قرار'}</h2>

            <div className="flex flex-wrap gap-2 mb-4">
              {typeOptions.map(function (t) {
                const isSelected = itemType === t.key
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={function () { setItemType(t.key) }}
                    style={isSelected ? { backgroundColor: t.color } : undefined}
                    className={"px-3 py-2 rounded-md font-['Tajawal'] text-xs transition " + (isSelected ? 'text-white' : 'bg-[#F3EEE4] text-[#4A473F] hover:bg-[#D8D2C4]')}
                  >
                    {t.icon} {t.label}
                  </button>
                )
              })}
            </div>

            <div className="space-y-3">
              <input type="text" value={title} onChange={function (e) { setTitle(e.target.value) }} placeholder="العنوان" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />

              <input type="text" value={lawReference} onChange={function (e) { setLawReference(e.target.value) }} placeholder={itemType === 'law' ? 'اسم القانون ورقمه، مثال: قانون العمل رقم 8 لسنة 1996' : 'رقم القرار والمحكمة، مثال: تمييز حقوق رقم 1234/2023'} className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />

              {accountType === 'lawyer' && (
                <select value={caseId} onChange={function (e) { setCaseId(e.target.value) }} className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]">
                  <option value="">ربط بقضية (اختياري)</option>
                  {cases.map(function (c) { return <option key={c.id} value={c.id}>قضية {c.case_number} — {c.client_name}</option> })}
                </select>
              )}

              <textarea value={content} onChange={function (e) { setContent(e.target.value) }} rows={5} placeholder="نص البند أو القرار، أو ملاحظاتك عليه" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />

              <button type="button" onClick={handleSummarize} disabled={summarizing || !content.trim()} className="w-full py-2 bg-[#2F4538] text-white rounded-md font-['Tajawal'] text-sm disabled:opacity-50">
                {summarizing ? 'جاري التلخيص...' : '✨ تلخيص بالذكاء الاصطناعي'}
              </button>

              {draftSummary && (
                <div className="bg-[#F3EEE4] rounded-md p-3">
                  <p className="font-['Tajawal'] text-xs text-[#AD8A4E] mb-1">الملخص:</p>
                  <p className="font-['Tajawal'] text-sm text-[#1B1A17]">{draftSummary}</p>
                </div>
              )}

              <input type="text" value={link} onChange={function (e) { setLink(e.target.value) }} placeholder={abroad ? 'رابط (اختياري)' : 'رابط (اختياري)، مثلاً من قرارك'} className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />

              <input type="text" value={tagsInput} onChange={function (e) { setTagsInput(e.target.value) }} placeholder="وسوم للبحث السريع، افصل بينها بفاصلة (مثال: عمال، فصل تعسفي)" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />

              <div>
                <label className="cursor-pointer inline-block px-4 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-xs text-[#4A473F] hover:bg-[#D8D2C4] transition">
                  📎 {file ? file.name : (existingFileUrl ? 'استبدال الملف المرفق' : 'إرفاق ملف (اختياري)')}
                  <input type="file" onChange={function (e) { setFile(e.target.files ? e.target.files[0] : null) }} className="hidden" />
                </label>
                {existingFileUrl && !file && (
                  <p className="font-['Tajawal'] text-xs text-[#4A473F] mt-1">يوجد ملف مرفق حالياً، سيبقى كما هو إن لم تختر ملفاً جديداً.</p>
                )}
              </div>

              {formError && <p className="font-['Tajawal'] text-sm text-[#7A2E2E]">{formError}</p>}

              <button onClick={handleSaveItem} disabled={saving} className="w-full py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal'] font-medium hover:bg-[#AD8A4E] transition disabled:opacity-60">
                {saving ? 'جاري الحفظ...' : (editingId ? 'حفظ التعديلات' : 'حفظ')}
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-2 mb-4">
          <button
            onClick={function () { setFavoritesOnly(false) }}
            className={"px-4 py-2 rounded-full font-['Tajawal'] text-xs transition " + (!favoritesOnly ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'bg-white border border-[#D8D2C4] text-[#4A473F]')}
          >
            الكل ({items.length})
          </button>
          <button
            onClick={function () { setFavoritesOnly(true) }}
            className={"px-4 py-2 rounded-full font-['Tajawal'] text-xs transition " + (favoritesOnly ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'bg-white border border-[#D8D2C4] text-[#4A473F]')}
          >
            ⭐ المفضلة ({favoritesCount})
          </button>
        </div>

        <input type="text" value={search} onChange={function (e) { setSearch(e.target.value) }} placeholder="ابحث في العنوان والنص والملخص والوسوم..." className="w-full px-3 py-2 mb-3 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />

        <div className="flex gap-2 items-center mb-4">
          <select value={sortBy} onChange={function (e) { setSortBy(e.target.value) }} className="flex-1 px-3 py-2 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]">
            <option value="updated">آخر تحديث</option>
            <option value="created">الأحدث إضافة</option>
            <option value="title">أبجدياً</option>
          </select>
          <div className="flex bg-white border border-[#D8D2C4] rounded-md p-1">
            <button onClick={function () { setViewMode('cards') }} className={"px-3 py-1 rounded text-sm transition " + (viewMode === 'cards' ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'text-[#4A473F]')}>▦</button>
            <button onClick={function () { setViewMode('list') }} className={"px-3 py-1 rounded text-sm transition " + (viewMode === 'list' ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'text-[#4A473F]')}>☰</button>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <p className="font-['Tajawal'] text-xs text-[#4A473F]">عرض {filteredItems.length} من {items.length}</p>
          {lowerSearch && (
            <button onClick={function () { setSearch('') }} className="cursor-pointer font-['Tajawal'] text-xs text-[#AD8A4E] underline">مسح البحث</button>
          )}
        </div>

        {items.length === 0 && (
          <div className="bg-white border border-[#D8D2C4] rounded-lg p-8 text-center">
            <p className="font-['Tajawal'] text-[#1B1A17] font-bold mb-1">مكتبتك فارغة</p>
            <p className="font-['Tajawal'] text-sm text-[#4A473F]">ابدأ بإضافة أول قانون أو قرار تحتاج الرجوع إليه.</p>
          </div>
        )}

        {items.length > 0 && filteredItems.length === 0 && (
          <p className="font-['Tajawal'] text-center text-[#4A473F]">لا توجد عناصر مطابقة</p>
        )}

        {filteredItems.map(renderItem)}
      </div>

      {renderModal()}

      <Footer variant={accountType === 'firm' ? 'firm' : 'lawyer'} />
    </div>
  )
}