'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'
import { uploadOwnFile, openPrivateFile } from '../lib/files'
import { getLawyerBadgeCount, getFirmBadgeCount } from '../lib/badges'
import Footer from './Footer'
import WorkspaceSwitch from './WorkspaceSwitch'
import HeaderLines from './HeaderLines'
import Loader from './Loader'
import DateFields from './DateFields'

// One page design for two tools under «إدارة الأعمال»:
//  'mit' — معاملات وزارة الصناعة والتجارة (companies, trade names, records...)
//  'gov' — معاملات الجهات الحكومية (open list: the entity and the transaction are typed freely)
// Both are tied to a client, follow the private workspace, and firms see
// their lawyers' shared ones read-only.

export type ToolKind = 'mit' | 'gov'

type FileRef = { name: string; path: string }

type Transaction = {
  id: number
  lawyer_id: number
  tool: ToolKind
  category: string
  company_type: string | null
  transaction_type: string | null
  client_name: string
  client_phone: string | null
  case_id: number | null
  reference_no: string | null
  submitted_date: string | null
  followup_date: string | null
  completed_date: string | null
  status: string
  notes: string | null
  files: FileRef[] | null
}

type CaseOption = { id: number; case_number: string; client_name: string }
type RosterLawyer = { id: number; full_name: string }

const STATUSES = ['قيد الإنجاز', 'بانتظار مستندات', 'منجزة', 'مرفوضة']
const DONE = ['منجزة', 'مرفوضة']

const MIT_CATEGORIES = [
  'تأسيس شركة',
  'تأسيس مؤسسة فردية',
  'تسجيل وكالات تجارية',
  'تسجيل علامات وأسماء تجارية',
  'تعديل عقود تأسيس الشركات',
  'إدخال شريك',
  'انسحاب شريك',
  'سندات تنازل',
  'إضافة غايات (تعديل عقد التأسيس)',
  'إصدار سجلات تجارية',
  'تسجيل براءات اختراع',
  'رفع رأس مال الشركة',
]

const COMPANY_TYPES = ['ذات مسؤولية محدودة', 'تضامن', 'مساهمة عامة', 'مساهمة خاصة', 'توصية بسيطة']

const GOV_ENTITIES = [
  'وزارة العمل',
  'وزارة الاستثمار',
  'أمانة عمان الكبرى',
  'دائرة ضريبة الدخل والمبيعات',
  'دائرة الجمارك',
]

// Suggestions only: the field stays free text, because the options are endless.
const GOV_SUGGESTIONS: { [entity: string]: string[] } = {
  'وزارة العمل': ['إنشاء نظام داخلي', 'إصدار تصاريح عمل'],
  'أمانة عمان الكبرى': ['إصدار رخصة مهن', 'تجديد رخصة مهن'],
}

const OTHER = 'أخرى'

const CONFIG = {
  mit: {
    title: 'وزارة الصناعة والتجارة',
    subtitle: 'معاملات الشركات والمؤسسات والسجلات والعلامات التجارية لموكليك',
    categoryLabel: 'نوع المعاملة',
    categories: MIT_CATEGORIES,
    detailLabel: 'تفاصيل إضافية (اختياري)',
    addLabel: '+ معاملة جديدة',
  },
  gov: {
    title: 'الجهات الحكومية',
    subtitle: 'تابع معاملات موكليك لدى الوزارات والدوائر الحكومية',
    categoryLabel: 'الجهة',
    categories: GOV_ENTITIES,
    detailLabel: 'المعاملة',
    addLabel: '+ معاملة جديدة',
  },
}

const labelClass = "block font-['Tajawal'] text-xs text-[#4A473F] mb-1"
const fieldClass = "w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"

function todayString() {
  const now = new Date()
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0')
}

function formatDateDisplay(dateStr: string | null) {
  if (!dateStr) return '-'
  const parts = dateStr.split('-')
  if (parts.length !== 3) return dateStr
  return parts[2] + '/' + parts[1] + '/' + parts[0]
}

function statusClass(status: string) {
  if (status === 'منجزة') return 'bg-[#D9E5DC] text-[#2F4538]'
  if (status === 'مرفوضة') return 'bg-[#7A2E2E] text-white'
  if (status === 'بانتظار مستندات') return 'bg-white text-[#AD8A4E] border border-[#AD8A4E]'
  return 'bg-[#F3EEE4] text-[#AD8A4E]'
}

type FormState = {
  category: string
  categoryOther: string
  company_type: string
  transaction_type: string
  client_name: string
  client_phone: string
  case_id: string
  reference_no: string
  submitted_date: string
  followup_date: string
  completed_date: string
  status: string
  notes: string
}

const EMPTY_FORM: FormState = {
  category: '',
  categoryOther: '',
  company_type: '',
  transaction_type: '',
  client_name: '',
  client_phone: '',
  case_id: '',
  reference_no: '',
  submitted_date: '',
  followup_date: '',
  completed_date: '',
  status: STATUSES[0],
  notes: '',
}

export default function TransactionsTool(props: { tool: ToolKind }) {
  const tool = props.tool
  const config = CONFIG[tool]
  const supabase = createClient()
  const router = useRouter()
  const menuRef = useRef<HTMLDivElement>(null)

  const [loading, setLoading] = useState(true)
  const [notAllowed, setNotAllowed] = useState(false)
  const [notSubscribed, setNotSubscribed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [totalUnread, setTotalUnread] = useState(0)
  const [pendingConsultations, setPendingConsultations] = useState(0)

  const [accountType, setAccountType] = useState<'lawyer' | 'firm'>('lawyer')
  const isFirm = accountType === 'firm'
  const [lawyerId, setLawyerId] = useState<number | null>(null)
  const [roster, setRoster] = useState<RosterLawyer[]>([])
  const [lawyerFilter, setLawyerFilter] = useState('all')

  const [items, setItems] = useState<Transaction[]>([])
  const [cases, setCases] = useState<CaseOption[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('open')
  const [categoryFilter, setCategoryFilter] = useState('')

  // form: add (editingId = null) or edit an existing one
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [openId, setOpenId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  useEffect(function () {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return function () { document.removeEventListener('mousedown', handleClickOutside) }
  }, [])

  function countConversations(rows: any[]) {
    const senders = new Set(rows.map(function (m) {
      return m.sender_lawyer_id ? 'lawyer-' + m.sender_lawyer_id : 'firm-' + m.sender_firm_id
    }))
    return senders.size
  }

  async function loadItems(lawyerIds: number[]) {
    if (lawyerIds.length === 0) {
      setItems([])
      return
    }
    const result = await supabase
      .from('business_transactions')
      .select('*')
      .eq('tool', tool)
      .in('lawyer_id', lawyerIds)
      .order('id', { ascending: false })
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

      const lawyerResult = await supabase.from('lawyers').select('id, is_active, is_comped').eq('user_id', userId).maybeSingle()
      if (lawyerResult.data) {
        if (!lawyerResult.data.is_active && !lawyerResult.data.is_comped) {
          setNotSubscribed(true)
          setLoading(false)
          return
        }
        const id = lawyerResult.data.id
        setAccountType('lawyer')
        setLawyerId(id)

        const unreadResult = await supabase.from('lawyer_messages').select('sender_lawyer_id, sender_firm_id').eq('recipient_lawyer_id', id).eq('is_read', false)
        setTotalUnread(countConversations(unreadResult.data || []))
        setPendingConsultations(await getLawyerBadgeCount(supabase, id))

        const casesResult = await supabase.from('legal_cases').select('id, case_number, client_name').eq('lawyer_id', id).order('id', { ascending: false })
        setCases(casesResult.data || [])

        await loadItems([id])
        setLoading(false)
        return
      }

      const firmResult = await supabase.from('firms').select('id, is_active, is_comped').eq('user_id', userId).maybeSingle()
      if (!firmResult.data) {
        setNotAllowed(true)
        setLoading(false)
        return
      }
      if (!firmResult.data.is_active && !firmResult.data.is_comped) {
        setNotSubscribed(true)
        setLoading(false)
        return
      }

      setAccountType('firm')
      const firmUnreadResult = await supabase.from('lawyer_messages').select('sender_lawyer_id, sender_firm_id').eq('recipient_firm_id', firmResult.data.id).eq('is_read', false)
      setTotalUnread(countConversations(firmUnreadResult.data || []))
      setPendingConsultations(await getFirmBadgeCount(supabase, firmResult.data.id))

      const rosterResult = await supabase.from('lawyers').select('id, full_name').eq('firm_id', firmResult.data.id)
      const rosterRows: RosterLawyer[] = rosterResult.data || []
      setRoster(rosterRows)
      const ids = rosterRows.map(function (l) { return l.id })
      if (ids.length > 0) {
        const firmCases = await supabase.from('legal_cases').select('id, case_number, client_name').in('lawyer_id', ids)
        setCases(firmCases.data || [])
      }
      await loadItems(ids)
      setLoading(false)
    }

    loadData()

    // switching between firm work and private work reloads in place
    function onWorkspaceChange() { loadData() }
    window.addEventListener('hm:workspace', onWorkspaceChange)
    return function () { window.removeEventListener('hm:workspace', onWorkspaceChange) }
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    setMenuOpen(false)
    router.push('/')
  }

  function setField(name: keyof FormState, value: string) {
    setForm(function (prev) { return Object.assign({}, prev, { [name]: value }) })
  }

  function openAdd() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setNewFiles([])
    setFormError('')
    setShowForm(!showForm || editingId !== null)
  }

  function openEdit(t: Transaction) {
    const known = config.categories.indexOf(t.category) !== -1
    setEditingId(t.id)
    setForm({
      category: known ? t.category : OTHER,
      categoryOther: known ? '' : t.category,
      company_type: t.company_type || '',
      transaction_type: t.transaction_type || '',
      client_name: t.client_name,
      client_phone: t.client_phone || '',
      case_id: t.case_id ? String(t.case_id) : '',
      reference_no: t.reference_no || '',
      submitted_date: t.submitted_date || '',
      followup_date: t.followup_date || '',
      completed_date: t.completed_date || '',
      status: t.status,
      notes: t.notes || '',
    })
    setNewFiles([])
    setFormError('')
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function pickCase(value: string) {
    setForm(function (prev) {
      const next = Object.assign({}, prev, { case_id: value })
      const found = cases.find(function (c) { return String(c.id) === value })
      // linking a case fills in the client when it's still empty
      if (found && !prev.client_name.trim()) next.client_name = found.client_name
      return next
    })
  }

  async function handleSave() {
    if (!lawyerId) return
    const category = form.category === OTHER ? form.categoryOther.trim() : form.category
    if (!category) {
      setFormError(tool === 'gov' ? 'يرجى اختيار الجهة' : 'يرجى اختيار نوع المعاملة')
      return
    }
    if (!form.client_name.trim()) {
      setFormError('يرجى كتابة اسم الموكل')
      return
    }

    setSaving(true)
    setFormError('')

    // keep the files already attached, add the new ones
    const existing = editingId ? items.find(function (t) { return t.id === editingId }) : null
    const files: FileRef[] = existing && existing.files ? existing.files.slice() : []
    for (const f of newFiles) {
      const path = await uploadOwnFile(supabase, 'case-files', f)
      if (!path) {
        setSaving(false)
        setFormError('تعذر رفع الملف «' + f.name + '»، حاول مرة أخرى')
        return
      }
      files.push({ name: f.name, path: path })
    }

    const row = {
      tool: tool,
      category: category,
      company_type: tool === 'mit' && category === 'تأسيس شركة' ? (form.company_type || null) : null,
      transaction_type: form.transaction_type.trim() || null,
      client_name: form.client_name.trim(),
      client_phone: form.client_phone.trim() || null,
      case_id: form.case_id ? Number(form.case_id) : null,
      reference_no: form.reference_no.trim() || null,
      submitted_date: form.submitted_date || null,
      followup_date: form.followup_date || null,
      completed_date: DONE.indexOf(form.status) !== -1 ? (form.completed_date || null) : null,
      status: form.status,
      notes: form.notes.trim() || null,
      files: files,
    }

    const result = editingId
      ? await supabase.from('business_transactions').update(row).eq('id', editingId)
      : await supabase.from('business_transactions').insert(Object.assign({ lawyer_id: lawyerId }, row))

    if (result.error) {
      setSaving(false)
      setFormError('تعذر الحفظ، حاول مرة أخرى')
      return
    }

    // a new follow-up date goes into the calendar
    const followupChanged = !!row.followup_date && (!existing || existing.followup_date !== row.followup_date)
    if (followupChanged && DONE.indexOf(row.status) === -1 && (row.followup_date as string) >= todayString()) {
      await supabase.from('personal_calendar').insert({
        lawyer_id: lawyerId,
        title: 'متابعة معاملة: ' + category + ' — ' + row.client_name,
        event_date: row.followup_date,
        time_slot: '',
        notes: (config.title + (row.reference_no ? ' — رقم المرجع ' + row.reference_no : '')),
      })
    }

    setSaving(false)
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
    setNewFiles([])
    await loadItems([lawyerId])
  }

  async function handleDelete(id: number) {
    if (!lawyerId) return
    await supabase.from('business_transactions').delete().eq('id', id)
    setDeletingId(null)
    setOpenId(null)
    await loadItems([lawyerId])
  }

  async function handleRemoveFile(t: Transaction, path: string) {
    if (!lawyerId) return
    const files = (t.files || []).filter(function (f) { return f.path !== path })
    await supabase.from('business_transactions').update({ files: files }).eq('id', t.id)
    await supabase.storage.from('case-files').remove([path])
    await loadItems([lawyerId])
  }

  function getRosterName(id: number) {
    const found = roster.find(function (l) { return l.id === id })
    return found ? found.full_name : ''
  }

  function getCaseLabel(id: number | null) {
    if (!id) return ''
    const found = cases.find(function (c) { return c.id === id })
    return found ? 'قضية رقم ' + found.case_number : ''
  }

  const today = todayString()
  const q = search.trim()
  const visible = items.filter(function (t) {
    if (isFirm && lawyerFilter !== 'all' && t.lawyer_id !== Number(lawyerFilter)) return false
    if (statusFilter === 'open' && DONE.indexOf(t.status) !== -1) return false
    if (statusFilter === 'done' && DONE.indexOf(t.status) === -1) return false
    if (categoryFilter && t.category !== categoryFilter) return false
    if (q) {
      const hay = [t.client_name, t.category, t.transaction_type, t.reference_no, t.company_type, t.notes].join(' ')
      if (hay.indexOf(q) === -1) return false
    }
    return true
  })

  const categoriesInUse = Array.from(new Set(items.map(function (t) { return t.category })))
  const overdueCount = items.filter(function (t) { return DONE.indexOf(t.status) === -1 && t.followup_date && t.followup_date < today }).length

  function field(label: string, input: React.ReactNode, className?: string) {
    return (
      <div className={className}>
        <label className={labelClass}>{label}</label>
        {input}
      </div>
    )
  }

  function renderForm() {
    const isCompany = tool === 'mit' && form.category === 'تأسيس شركة'
    const entity = form.category === OTHER ? form.categoryOther : form.category
    const suggestions = tool === 'gov' ? (GOV_SUGGESTIONS[entity] || []) : []
    const done = DONE.indexOf(form.status) !== -1

    return (
      <div className="bg-white border-2 border-[#AD8A4E] rounded-lg p-6 mb-6 space-y-4">
        <h2 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17]">{editingId ? 'تعديل المعاملة' : 'معاملة جديدة'}</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {field(config.categoryLabel, (
            <select value={form.category} onChange={function (e) { setField('category', e.target.value) }} className={fieldClass}>
              <option value="">اختر</option>
              {config.categories.map(function (c) { return <option key={c} value={c}>{c}</option> })}
              <option value={OTHER}>{tool === 'gov' ? 'جهة أخرى' : 'معاملة أخرى'}</option>
            </select>
          ))}
          {form.category === OTHER && field(tool === 'gov' ? 'اسم الجهة' : 'اسم المعاملة', (
            <input type="text" value={form.categoryOther} onChange={function (e) { setField('categoryOther', e.target.value) }} className={fieldClass} />
          ))}
          {isCompany && field('نوع الشركة', (
            <select value={form.company_type} onChange={function (e) { setField('company_type', e.target.value) }} className={fieldClass}>
              <option value="">اختر</option>
              {COMPANY_TYPES.map(function (c) { return <option key={c} value={c}>{c}</option> })}
            </select>
          ))}
        </div>

        {field(config.detailLabel, (
          <>
            <input type="text" list={'tx-suggest-' + tool} value={form.transaction_type} onChange={function (e) { setField('transaction_type', e.target.value) }} className={fieldClass} />
            <datalist id={'tx-suggest-' + tool}>
              {suggestions.map(function (s) { return <option key={s} value={s} /> })}
            </datalist>
          </>
        ))}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-[#D8D2C4] pt-4">
          {field('اسم الموكل', <input type="text" value={form.client_name} onChange={function (e) { setField('client_name', e.target.value) }} className={fieldClass} />)}
          {field('هاتف الموكل', <input type="tel" value={form.client_phone} onChange={function (e) { setField('client_phone', e.target.value) }} className={fieldClass} />)}
          {field('ربط بقضية (اختياري)', (
            <select value={form.case_id} onChange={function (e) { pickCase(e.target.value) }} className={fieldClass}>
              <option value="">بدون قضية</option>
              {cases.map(function (c) { return <option key={c.id} value={c.id}>قضية {c.case_number} — {c.client_name}</option> })}
            </select>
          ))}
          {field('رقم المعاملة / المرجع', <input type="text" value={form.reference_no} onChange={function (e) { setField('reference_no', e.target.value) }} className={fieldClass} />)}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-[#D8D2C4] pt-4">
          {field('الحالة', (
            <div className="grid grid-cols-2 gap-2">
              {STATUSES.map(function (st) {
                return (
                  <button key={st} type="button" onClick={function () { setField('status', st) }} className={"py-2 rounded-md font-['Tajawal'] text-xs " + (form.status === st ? 'bg-[#1B1A17] text-white' : 'bg-[#F3EEE4] text-[#4A473F] border border-[#D8D2C4]')}>
                    {st}
                  </button>
                )
              })}
            </div>
          ), 'sm:col-span-2')}
          {field('تاريخ التقديم', <DateFields value={form.submitted_date} onChange={function (v) { setField('submitted_date', v) }} tone="paper" />)}
          {!done && field('موعد المتابعة القادم (يُضاف للأجندة)', <DateFields value={form.followup_date} onChange={function (v) { setField('followup_date', v) }} tone="paper" />)}
          {done && field(form.status === 'منجزة' ? 'تاريخ الإنجاز' : 'تاريخ الرفض', <DateFields value={form.completed_date} onChange={function (v) { setField('completed_date', v) }} tone="paper" />)}
        </div>

        {field('ملاحظات', <textarea value={form.notes} onChange={function (e) { setField('notes', e.target.value) }} rows={2} className={fieldClass} />)}

        <div>
          <label className={labelClass}>المرفقات</label>
          <label className="cursor-pointer inline-block px-4 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-xs text-[#4A473F] hover:bg-[#D8D2C4] transition">
            📎 إضافة ملفات
            <input type="file" multiple className="hidden" onChange={function (e) {
              const picked: File[] = e.target.files ? Array.from(e.target.files as FileList) : []
              setNewFiles(function (prev) { return prev.concat(picked) })
              e.target.value = ''
            }} />
          </label>
          {newFiles.length > 0 && (
            <div className="mt-2 space-y-1">
              {newFiles.map(function (f, i) {
                return (
                  <p key={i} className="font-['Tajawal'] text-xs text-[#4A473F]">
                    {f.name}{' '}
                    <button type="button" onClick={function () { setNewFiles(newFiles.filter(function (_, j) { return j !== i })) }} className="text-[#7A2E2E]">✕</button>
                  </p>
                )
              })}
            </div>
          )}
        </div>

        {formError && <p className="font-['Tajawal'] text-sm text-[#7A2E2E]">{formError}</p>}

        <div className="flex gap-2">
          <button onClick={function () { setShowForm(false); setEditingId(null) }} className="flex-1 py-3 bg-[#F3EEE4] text-[#4A473F] rounded-md font-['Tajawal'] text-sm">إلغاء</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal'] text-sm hover:bg-[#AD8A4E] transition disabled:opacity-60">
            {saving ? 'جاري الحفظ...' : 'حفظ المعاملة'}
          </button>
        </div>
      </div>
    )
  }

  function renderItem(t: Transaction) {
    const open = openId === t.id
    const overdue = DONE.indexOf(t.status) === -1 && !!t.followup_date && t.followup_date < today
    const title = t.category + (t.company_type ? ' — ' + t.company_type : '')

    return (
      <div key={t.id} className={"bg-white border rounded-lg p-4 mb-3 transition " + (overdue ? 'border-[#7A2E2E]/50' : 'border-[#D8D2C4] hover:border-[#AD8A4E]')}>
        <button type="button" onClick={function () { setOpenId(open ? null : t.id) }} className="w-full text-right">
          <div className="flex justify-between items-start gap-3 mb-1">
            <p className="font-['Tajawal'] font-bold text-[#1B1A17]">{title}</p>
            <span className={"px-2 py-0.5 rounded-full font-['Tajawal'] text-[11px] whitespace-nowrap " + statusClass(t.status)}>{t.status}</span>
          </div>
          {t.transaction_type && <p className="font-['Tajawal'] text-sm text-[#4A473F] mb-1">{t.transaction_type}</p>}
          {isFirm && <p className="font-['Tajawal'] text-xs text-[#1B1A17] font-bold mb-1">المحامي: {getRosterName(t.lawyer_id)}</p>}
          <p className="font-['Tajawal'] text-sm text-[#4A473F]">الموكل: {t.client_name}{t.case_id ? ' — ' + getCaseLabel(t.case_id) : ''}</p>
          {t.followup_date && DONE.indexOf(t.status) === -1 && (
            <p className={"font-['Tajawal'] text-xs font-bold mt-1 " + (overdue ? 'text-[#7A2E2E]' : 'text-[#2F4538]')}>
              {overdue ? 'فات موعد المتابعة: ' : 'المتابعة القادمة: '}{formatDateDisplay(t.followup_date)}
            </p>
          )}
        </button>

        {open && (
          <div className="mt-3 pt-3 border-t border-[#D8D2C4]">
            <div className="grid grid-cols-2 gap-3 font-['Tajawal'] text-sm mb-3">
              <div><p className="text-xs text-[#4A473F]">رقم المعاملة / المرجع</p><p className="text-[#1B1A17]">{t.reference_no || '-'}</p></div>
              <div><p className="text-xs text-[#4A473F]">هاتف الموكل</p><p className="text-[#1B1A17]">{t.client_phone || '-'}</p></div>
              <div><p className="text-xs text-[#4A473F]">تاريخ التقديم</p><p className="text-[#1B1A17]">{formatDateDisplay(t.submitted_date)}</p></div>
              {DONE.indexOf(t.status) !== -1 && <div><p className="text-xs text-[#4A473F]">{t.status === 'منجزة' ? 'تاريخ الإنجاز' : 'تاريخ الرفض'}</p><p className="text-[#1B1A17]">{formatDateDisplay(t.completed_date)}</p></div>}
              {t.notes && <div className="col-span-2"><p className="text-xs text-[#4A473F]">ملاحظات</p><p className="text-[#1B1A17] whitespace-pre-line">{t.notes}</p></div>}
            </div>

            {(t.files || []).length > 0 && (
              <div className="mb-3">
                <p className="font-['Tajawal'] text-xs text-[#4A473F] mb-1">المرفقات</p>
                {(t.files || []).map(function (f) {
                  return (
                    <div key={f.path} className="flex items-center gap-2 mb-1">
                      <button type="button" onClick={function () { openPrivateFile(supabase, 'case-files', f.path) }} className="font-['Tajawal'] text-xs text-[#AD8A4E] underline">{f.name}</button>
                      {!isFirm && <button type="button" onClick={function () { handleRemoveFile(t, f.path) }} className="font-['Tajawal'] text-[11px] text-[#7A2E2E]">حذف</button>}
                    </div>
                  )
                })}
              </div>
            )}

            {!isFirm && (
              <div className="flex gap-2">
                <button onClick={function () { openEdit(t) }} className="px-4 py-2 bg-[#AD8A4E] text-white rounded-md font-['Tajawal'] text-xs">تعديل / تحديث الحالة</button>
                {deletingId === t.id ? (
                  <>
                    <button onClick={function () { handleDelete(t.id) }} className="px-4 py-2 bg-[#7A2E2E] text-white rounded-md font-['Tajawal'] text-xs">تأكيد الحذف</button>
                    <button onClick={function () { setDeletingId(null) }} className="px-4 py-2 bg-[#F3EEE4] text-[#4A473F] rounded-md font-['Tajawal'] text-xs">إلغاء</button>
                  </>
                ) : (
                  <button onClick={function () { setDeletingId(t.id) }} className="px-4 py-2 bg-[#F3EEE4] text-[#7A2E2E] rounded-md font-['Tajawal'] text-xs">حذف</button>
                )}
              </div>
            )}
          </div>
        )}
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
            <h1 className="font-['Tajawal'] font-bold text-2xl text-[#1B1A17] mb-3">يلزم الاشتراك للوصول إلى هذه الأداة</h1>
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
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-8 font-['Tajawal'] text-sm">
            <a href="/"><img src="/logo.png" alt="حمورابي" className="h-12 w-auto" /></a>
            <div className="flex gap-5 items-center">
              {isFirm && <a href="/firm-dashboard" className="hover:text-[#AD8A4E] transition">لوحة التحكم</a>}
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
                <button onClick={function () { setMenuOpen(!menuOpen) }} className="relative w-8 h-8 rounded-full bg-[#AD8A4E] flex items-center justify-center hover:bg-[#c49b58] transition">
                  <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.5c-3.3 0-9.8 1.6-9.8 4.9v2.4h19.6v-2.4c0-3.3-6.5-4.9-9.8-4.9z" /></svg>
                  {pendingConsultations > 0 && (
                    <span className="absolute -top-1 -left-1 bg-[#7A2E2E] text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{pendingConsultations}</span>
                  )}
                </button>
                {menuOpen && (
                  <div className="absolute left-0 top-full mt-2 w-52 bg-white border border-[#D8D2C4] rounded-md shadow-lg overflow-hidden z-20">
                    <a href="/subscription" className="block px-4 py-3 font-['Tajawal'] text-sm text-[#1B1A17] hover:bg-[#F3EEE4] transition">ترقية الاشتراك</a>
                    <a href={isFirm ? '/firm-info' : '/lawyer-info'} className="block px-4 py-3 font-['Tajawal'] text-sm text-[#1B1A17] hover:bg-[#F3EEE4] transition border-t border-[#D8D2C4]">معلوماتي الشخصية</a>
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
          <h1 className="font-['Tajawal'] font-bold text-4xl mb-2">{config.title} ({items.length})</h1>
          <p className="font-['Tajawal'] text-sm text-[#D8D2C4]">{isFirm ? 'معاملات محامي المكتب — للاطلاع فقط.' : config.subtitle}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10 flex-1 w-full">
        {!isFirm && <WorkspaceSwitch />}

        {overdueCount > 0 && (
          <div className="bg-white border border-[#7A2E2E]/40 rounded-lg p-3 mb-4 font-['Tajawal'] text-sm text-[#7A2E2E]">
            {overdueCount === 1 ? 'معاملة واحدة فات موعد متابعتها' : overdueCount + ' معاملات فات موعد متابعتها'}
          </div>
        )}

        {isFirm && (
          <select value={lawyerFilter} onChange={function (e) { setLawyerFilter(e.target.value) }} className="w-full px-3 py-2 mb-4 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]">
            <option value="all">جميع المحامين</option>
            {roster.map(function (l) { return <option key={l.id} value={String(l.id)}>{l.full_name}</option> })}
          </select>
        )}

        <div className="flex flex-wrap items-center gap-3 mb-6">
          <input type="search" value={search} onChange={function (e) { setSearch(e.target.value) }} placeholder="بحث باسم الموكل أو رقم المرجع" className="flex-1 min-w-[200px] px-4 py-2 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
          <select value={statusFilter} onChange={function (e) { setStatusFilter(e.target.value) }} className="px-4 py-2 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]">
            <option value="open">الجارية</option>
            <option value="done">المنجزة والمرفوضة</option>
            <option value="all">الكل</option>
          </select>
          {categoriesInUse.length > 1 && (
            <select value={categoryFilter} onChange={function (e) { setCategoryFilter(e.target.value) }} className="px-4 py-2 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]">
              <option value="">{tool === 'gov' ? 'كل الجهات' : 'كل المعاملات'}</option>
              {categoriesInUse.map(function (c) { return <option key={c} value={c}>{c}</option> })}
            </select>
          )}
          {!isFirm && (
            <button onClick={openAdd} className="px-5 py-2 bg-[#AD8A4E] text-white rounded-md font-['Tajawal'] text-sm">
              {showForm && editingId === null ? 'إلغاء' : config.addLabel}
            </button>
          )}
        </div>

        {showForm && !isFirm && renderForm()}

        {visible.length === 0 && !showForm && (
          <p className="font-['Tajawal'] text-center text-[#4A473F]">
            {items.length === 0 ? (isFirm ? 'لا توجد معاملات بعد' : 'لا توجد معاملات بعد. أضف أول معاملة.') : 'لا توجد معاملات مطابقة'}
          </p>
        )}

        {visible.map(renderItem)}
      </div>

      <Footer variant={isFirm ? 'firm' : 'lawyer'} />
    </div>
  )
}
