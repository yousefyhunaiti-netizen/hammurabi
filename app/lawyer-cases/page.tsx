'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'
import { uploadOwnFile, openPrivateFile } from '../lib/files'
import { getLawyerBadgeCount, getFirmBadgeCount } from '../lib/badges'
import Footer from '../components/Footer'
import WorkspaceSwitch from '../components/WorkspaceSwitch'
import HeaderLines from '../components/HeaderLines'
import Loader from '../components/Loader'
import DateFields from '../components/DateFields'
import CourtPicker, { CourtValue } from '../components/CourtPicker'
import { CASE_STATUSES, OPEN_STATUSES, SUSPENSION_TYPES, courtText } from '../lib/courts'
import { isInternational, currencyOf, currencyLabel } from '../lib/international'

type LegalCase = {
  id: number
  lawyer_id: number
  case_number: string
  specialty_id: number | null
  client_name: string
  client_phone: string | null
  opposing_party: string | null
  opposing_counsel: string | null
  lawsuit_subject: string | null
  case_value: number | null
  filing_date: string | null
  court_name: string | null
  court_category: string | null
  court_instance: string | null
  court_location: string | null
  judge_name: string | null
  witnesses: string | null
  status: string
  suspension_type: string | null
  notes: string | null
}

type CaseHearing = {
  id: number
  case_id: number
  hearing_date: string
  hearing_time: string | null
  outcome: string | null
  next_procedure: string | null
  procedure_due_date: string | null
  procedure_due_time: string | null
  notes: string | null
}

type CaseFolder = {
  id: number
  case_id: number
  folder_name: string
}

type CaseFile = {
  id: number
  case_id: number | null
  folder_id: number | null
  client_name: string
  file_name: string
  file_url: string
  uploaded_at: string
}

type Invoice = {
  id: number
  case_id: number | null
  client_name: string
  amount: number
  status: string
}

type WakalahDoc = {
  id: number
  case_id: number | null
  lawyer_file_url: string | null
  customer_file_url: string | null
  status: string
  client_name: string | null
  wakalah_type: string | null
  certified_by: string | null
  certified_date: string | null
  expiry_date: string | null
  issued_abroad: boolean | null
  mofa_date: string | null
  notary_date: string | null
}

const WAKALAH_COLUMNS = 'id, case_id, lawyer_file_url, customer_file_url, status, client_name, wakalah_type, certified_by, certified_date, expiry_date, issued_abroad, mofa_date, notary_date'

type Specialty = {
  id: number
  name_ar: string
}

type RosterLawyer = {
  id: number
  full_name: string
}

const EMPTY_COURT: CourtValue = { category: '', type: '', location: '' }

// Labels sit above the boxes, so they stay visible while typing.
const labelClass = "block font-['Tajawal'] text-xs text-[#4A473F] mb-1"
const fieldClass = "w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
const smallFieldClass = "w-full px-3 py-2 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-xs text-[#1B1A17]"

// A date a few days earlier, as YYYY-MM-DD (local dates, no time zone shift).
function daysBefore(dateStr: string, days: number) {
  const parts = dateStr.split('-').map(Number)
  const d = new Date(parts[0], parts[1] - 1, parts[2] - days)
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

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

export default function LawyerCasesPage() {
  const [loading, setLoading] = useState(true)
  // outside Jordan: court stages get general names, amounts are in USD
  const [country, setCountry] = useState('JO')
  const abroad = isInternational(country)
  const cur = currencyLabel(currencyOf(country))
  // «بداية — إربد»; older cases that only have a typed court name show that
  function courtOf(c: LegalCase) {
    return courtText(c.court_instance, c.court_location) || c.court_name || ''
  }
  const [lawyerId, setLawyerId] = useState<number | null>(null)
  const [notAllowed, setNotAllowed] = useState(false)
  const [notSubscribed, setNotSubscribed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [totalUnread, setTotalUnread] = useState(0)
  const [pendingConsultations, setPendingConsultations] = useState(0)

  // Firms see their lawyers' shared cases, read-only, with a lawyer filter.
  const [accountType, setAccountType] = useState<'lawyer' | 'firm'>('lawyer')
  const [roster, setRoster] = useState<RosterLawyer[]>([])
  const [lawyerFilter, setLawyerFilter] = useState('all')
  const isFirm = accountType === 'firm'

  const [view, setView] = useState('list')
  const [cases, setCases] = useState<LegalCase[]>([])
  const [specialties, setSpecialties] = useState<Specialty[]>([])
  const [hearingsAll, setHearingsAll] = useState<CaseHearing[]>([])
  const [statusFilter, setStatusFilter] = useState('active')

  const [selectedCase, setSelectedCase] = useState<LegalCase | null>(null)
  const [caseFolders, setCaseFolders] = useState<CaseFolder[]>([])
  const [caseFiles, setCaseFiles] = useState<CaseFile[]>([])
  const [caseInvoices, setCaseInvoices] = useState<Invoice[]>([])
  const [caseWakalah, setCaseWakalah] = useState<WakalahDoc[]>([])
  const [unlinkedWakalah, setUnlinkedWakalah] = useState<WakalahDoc[]>([])
  const [editingCase, setEditingCase] = useState(false)

  const [cardMenuOpenId, setCardMenuOpenId] = useState<number | null>(null)
  const [draggedCaseId, setDraggedCaseId] = useState<number | null>(null)

  const [showAddCase, setShowAddCase] = useState(false)
  const [formCaseNumber, setFormCaseNumber] = useState('')
  const [formSpecialty, setFormSpecialty] = useState('')
  const [formClientName, setFormClientName] = useState('')
  const [formClientPhone, setFormClientPhone] = useState('')
  const [formOpposingParty, setFormOpposingParty] = useState('')
  const [formOpposingCounsel, setFormOpposingCounsel] = useState('')
  const [formLawsuitSubject, setFormLawsuitSubject] = useState('')
  const [formCaseValue, setFormCaseValue] = useState('')
  const [formFilingDate, setFormFilingDate] = useState('')
  const [formCourt, setFormCourt] = useState<CourtValue>(EMPTY_COURT)
  const [formJudgeName, setFormJudgeName] = useState('')
  const [formWitnesses, setFormWitnesses] = useState('')
  const [formNotes, setFormNotes] = useState('')
  const [savingCase, setSavingCase] = useState(false)

  const [showAddHearing, setShowAddHearing] = useState(false)
  const [hearingDate, setHearingDate] = useState('')
  const [hearingTime, setHearingTime] = useState('')
  const [savingHearing, setSavingHearing] = useState(false)

  const [editingHearingId, setEditingHearingId] = useState<number | null>(null)
  const [editOutcome, setEditOutcome] = useState('')
  const [editNextProcedure, setEditNextProcedure] = useState('')
  const [editProcedureDate, setEditProcedureDate] = useState('')
  const [editProcedureTime, setEditProcedureTime] = useState('')
  const [editReminderDays, setEditReminderDays] = useState(3)
  const [hearingError, setHearingError] = useState('')

  const [newFolderName, setNewFolderName] = useState('')

  const [newInvoiceAmount, setNewInvoiceAmount] = useState('')
  const [newInvoiceDueDate, setNewInvoiceDueDate] = useState('')
  const [savingInvoice, setSavingInvoice] = useState(false)


  const supabase = createClient()
  const router = useRouter()
  const menuRef = useRef<HTMLDivElement>(null)

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

  async function loadCases(id: number) {
    const casesResult = await supabase.from('legal_cases').select('*').eq('lawyer_id', id).order('id', { ascending: false })
    setCases(casesResult.data || [])
    await loadHearings(casesResult.data || [])
  }

  // Firm view: the database returns only its lawyers' shared (non-private) cases.
  async function loadFirmCases(rosterIds: number[]) {
    if (rosterIds.length === 0) {
      setCases([])
      setHearingsAll([])
      return
    }
    const casesResult = await supabase.from('legal_cases').select('*').in('lawyer_id', rosterIds).order('id', { ascending: false })
    setCases(casesResult.data || [])
    await loadHearings(casesResult.data || [])
  }

  async function loadHearings(caseRows: LegalCase[]) {
    const caseIds = caseRows.map(function (c) { return c.id })
    if (caseIds.length > 0) {
      const hearingsResult = await supabase.from('case_hearings').select('*').in('case_id', caseIds)
      setHearingsAll(hearingsResult.data || [])
    } else {
      setHearingsAll([])
    }
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
      if (lawyerResult.data) setCountry(lawyerResult.data.country || 'JO')

      if (lawyerResult.data) {
        if (!lawyerResult.data.is_active && !lawyerResult.data.is_comped) {
          setNotSubscribed(true)
          setLoading(false)
          return
        }

        setAccountType('lawyer')
        setLawyerId(lawyerResult.data.id)

        const unreadResult = await supabase.from('lawyer_messages').select('sender_lawyer_id, sender_firm_id').eq('recipient_lawyer_id', lawyerResult.data.id).eq('is_read', false)
        setTotalUnread(countConversations(unreadResult.data || []))
        setPendingConsultations(await getLawyerBadgeCount(supabase, lawyerResult.data.id))

        const specialtiesResult = await supabase.from('specialties').select('*')
        setSpecialties(specialtiesResult.data || [])

        await loadCases(lawyerResult.data.id)
        setLoading(false)
        return
      }

      const firmResult = await supabase.from('firms').select('id, is_active, is_comped, country').eq('user_id', userId).maybeSingle()
      if (firmResult.data) setCountry(firmResult.data.country || 'JO')

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

      const specialtiesResult = await supabase.from('specialties').select('*')
      setSpecialties(specialtiesResult.data || [])

      const rosterResult = await supabase.from('lawyers').select('id, full_name').eq('firm_id', firmResult.data.id)
      const rosterRows: RosterLawyer[] = rosterResult.data || []
      setRoster(rosterRows)

      await loadFirmCases(rosterRows.map(function (l) { return l.id }))
      setLoading(false)
    }

    loadData()

    // Switching between firm work and private work reloads this page's data in place.
    function onWorkspaceChange() { loadData() }
    window.addEventListener('hm:workspace', onWorkspaceChange)
    return function () {
      window.removeEventListener('hm:workspace', onWorkspaceChange)
    }
  }, [])

  // «/lawyer-cases?open=12» opens that case (used when coming back from the wakalah page)
  const openedFromLink = useRef(false)
  useEffect(function () {
    if (loading || openedFromLink.current || cases.length === 0) return
    const param = new URLSearchParams(window.location.search).get('open')
    if (!param) return
    openedFromLink.current = true
    const found = cases.find(function (c) { return String(c.id) === param })
    if (found) loadCaseDetail(found)
  }, [loading, cases])

  async function handleLogout() {
    await supabase.auth.signOut()
    setMenuOpen(false)
    router.push('/')
  }

  function toggleMenu() {
    setMenuOpen(!menuOpen)
  }

  function resetCaseForm() {
    setFormCaseNumber('')
    setFormSpecialty('')
    setFormClientName('')
    setFormClientPhone('')
    setFormOpposingParty('')
    setFormOpposingCounsel('')
    setFormLawsuitSubject('')
    setFormCaseValue('')
    setFormFilingDate('')
    setFormCourt(EMPTY_COURT)
    setFormJudgeName('')
    setFormWitnesses('')
    setFormNotes('')
  }

  async function handleAddCase() {
    if (!formCaseNumber.trim() || !formClientName.trim() || !lawyerId) return
    setSavingCase(true)

    await supabase.from('legal_cases').insert({
      lawyer_id: lawyerId,
      case_number: formCaseNumber,
      specialty_id: formSpecialty ? Number(formSpecialty) : null,
      client_name: formClientName,
      client_phone: formClientPhone,
      opposing_party: formOpposingParty,
      opposing_counsel: formOpposingCounsel,
      lawsuit_subject: formLawsuitSubject,
      case_value: formCaseValue ? Number(formCaseValue) : null,
      filing_date: formFilingDate || null,
      court_category: abroad ? null : (formCourt.category || null),
      court_instance: formCourt.type || null,
      court_location: formCourt.location || null,
      court_name: courtText(formCourt.type, formCourt.location) || null,
      judge_name: formJudgeName,
      witnesses: formWitnesses,
      status: 'منظورة',
      notes: formNotes,
    })

    resetCaseForm()
    setShowAddCase(false)
    if (lawyerId) await loadCases(lawyerId)
    setSavingCase(false)
  }

  async function handleDeleteCase(caseId: number) {
    await supabase.from('case_hearings').delete().eq('case_id', caseId)
    await supabase.from('legal_cases').delete().eq('id', caseId)
    setCardMenuOpenId(null)
    if (selectedCase && selectedCase.id === caseId) setSelectedCase(null)
    if (lawyerId) await loadCases(lawyerId)
  }

  async function handleUpdateCaseField(field: string, value: any) {
    if (!selectedCase) return
    const id = selectedCase.id
    await supabase.from('legal_cases').update({ [field]: value }).eq('id', id)
    if (lawyerId) await loadCases(lawyerId)
    setSelectedCase(function (prev) { return prev && prev.id === id ? Object.assign({}, prev, { [field]: value }) : prev })
  }

  async function handleSaveFullEdit() {
    if (!selectedCase || !lawyerId) return

    await supabase.from('legal_cases').update({
      case_number: formCaseNumber,
      specialty_id: formSpecialty ? Number(formSpecialty) : null,
      client_name: formClientName,
      client_phone: formClientPhone,
      opposing_party: formOpposingParty,
      opposing_counsel: formOpposingCounsel,
      lawsuit_subject: formLawsuitSubject,
      case_value: formCaseValue ? Number(formCaseValue) : null,
      filing_date: formFilingDate || null,
      court_category: abroad ? null : (formCourt.category || null),
      court_instance: formCourt.type || null,
      court_location: formCourt.location || null,
      court_name: courtText(formCourt.type, formCourt.location) || null,
      judge_name: formJudgeName,
      witnesses: formWitnesses,
      notes: formNotes,
    }).eq('id', selectedCase.id)

    await loadCases(lawyerId)
    const refreshed = cases.find(function (c) { return c.id === selectedCase.id })
    setEditingCase(false)
    await loadCaseDetail(refreshed || selectedCase)
  }

  function startFullEdit() {
    if (!selectedCase) return
    setFormCaseNumber(selectedCase.case_number)
    setFormSpecialty(selectedCase.specialty_id ? String(selectedCase.specialty_id) : '')
    setFormClientName(selectedCase.client_name)
    setFormClientPhone(selectedCase.client_phone || '')
    setFormOpposingParty(selectedCase.opposing_party || '')
    setFormOpposingCounsel(selectedCase.opposing_counsel || '')
    setFormLawsuitSubject(selectedCase.lawsuit_subject || '')
    setFormCaseValue(selectedCase.case_value ? String(selectedCase.case_value) : '')
    setFormFilingDate(selectedCase.filing_date || '')
    setFormCourt({
      category: selectedCase.court_category || '',
      type: selectedCase.court_instance || '',
      location: selectedCase.court_location || (selectedCase.court_category ? '' : (selectedCase.court_name || '')),
    })
    setFormJudgeName(selectedCase.judge_name || '')
    setFormWitnesses(selectedCase.witnesses || '')
    setFormNotes(selectedCase.notes || '')
    setEditingCase(true)
  }

  async function loadCaseDetail(c: LegalCase) {
    setSelectedCase(c)
    setEditingCase(false)

    const foldersResult = await supabase.from('case_folders').select('*').eq('case_id', c.id)
    setCaseFolders(foldersResult.data || [])

    const filesResult = await supabase.from('case_files').select('*').eq('case_id', c.id)
    setCaseFiles(filesResult.data || [])

    const invoicesResult = await supabase.from('invoices').select('*').eq('case_id', c.id)
    setCaseInvoices(invoicesResult.data || [])

    const wakalahResult = await supabase.from('wakalah_documents').select(WAKALAH_COLUMNS).eq('case_id', c.id)
    setCaseWakalah(wakalahResult.data || [])

    if (lawyerId) {
      const unlinkedResult = await supabase.from('wakalah_documents').select(WAKALAH_COLUMNS).eq('lawyer_id', lawyerId).is('case_id', null).neq('status', 'revoked')
      setUnlinkedWakalah(unlinkedResult.data || [])
    }
  }

  function backToList() {
    setSelectedCase(null)
  }

  async function syncHearingToCalendar(hearingDateStr: string, hearingTimeStr: string, caseNumber: string) {
    if (!lawyerId) return
    await supabase.from('personal_calendar').insert({
      lawyer_id: lawyerId,
      title: 'جلسة قضية رقم ' + caseNumber,
      event_date: hearingDateStr,
      time_slot: hearingTimeStr || '',
      notes: 'جلسة محكمة',
    })
  }

  // The preparation reminder a few days before the next hearing
  // (witnesses, documents...), with what has to be done.
  async function addPreparationReminder(nextDate: string, days: number, todo: string, caseNumber: string) {
    if (!lawyerId) return
    await supabase.from('personal_calendar').insert({
      lawyer_id: lawyerId,
      title: 'تحضير لجلسة قضية رقم ' + caseNumber + ' (بعد ' + days + ' أيام)',
      event_date: daysBefore(nextDate, days),
      time_slot: '',
      notes: todo ? 'المطلوب: ' + todo : 'تحضير للجلسة القادمة',
    })
  }

  async function handleAddHearing() {
    if (!hearingDate || !selectedCase) return
    setSavingHearing(true)

    await supabase.from('case_hearings').insert({
      case_id: selectedCase.id,
      hearing_date: hearingDate,
      hearing_time: hearingTime,
    })

    await syncHearingToCalendar(hearingDate, hearingTime, selectedCase.case_number)

    setHearingDate('')
    setHearingTime('')
    setShowAddHearing(false)
    await loadCaseDetail(selectedCase)
    if (lawyerId) await loadCases(lawyerId)
    setSavingHearing(false)
  }

  function startEditHearing(h: CaseHearing) {
    setEditingHearingId(h.id)
    setEditOutcome(h.outcome || '')
    setEditNextProcedure(h.next_procedure || '')
    setEditProcedureDate(h.procedure_due_date || '')
    setEditProcedureTime(h.procedure_due_time || '')
    setEditReminderDays(3)
    setHearingError('')
  }

  // Saves what happened in the hearing and what is needed next. A new
  // next-hearing date also becomes a hearing of its own, goes into the
  // calendar, and gets a preparation reminder 3 or 4 days before it.
  async function handleSaveHearingEdit(h: CaseHearing) {
    if (!selectedCase) return
    setHearingError('')

    const updateResult = await supabase.from('case_hearings').update({
      outcome: editOutcome,
      next_procedure: editNextProcedure,
      procedure_due_date: editProcedureDate || null,
      procedure_due_time: editProcedureTime || null,
    }).eq('id', h.id)

    if (updateResult.error) {
      setHearingError('تعذر الحفظ، حاول مرة أخرى')
      return
    }

    const nextDateChanged = !!editProcedureDate && editProcedureDate !== (h.procedure_due_date || '')
    if (nextDateChanged) {
      const already = hearingsAll.some(function (x) { return x.case_id === selectedCase.id && x.hearing_date === editProcedureDate })
      if (!already) {
        await supabase.from('case_hearings').insert({
          case_id: selectedCase.id,
          hearing_date: editProcedureDate,
          hearing_time: editProcedureTime || null,
        })
        await syncHearingToCalendar(editProcedureDate, editProcedureTime, selectedCase.case_number)
      }
      if (daysBefore(editProcedureDate, editReminderDays) >= todayString()) {
        await addPreparationReminder(editProcedureDate, editReminderDays, editNextProcedure.trim(), selectedCase.case_number)
      }
    }

    setEditingHearingId(null)
    await loadCaseDetail(selectedCase)
    if (lawyerId) await loadCases(lawyerId)
  }

  async function handleAddFolder() {
    if (!newFolderName.trim() || !selectedCase) return
    await supabase.from('case_folders').insert({ case_id: selectedCase.id, folder_name: newFolderName })
    setNewFolderName('')
    await loadCaseDetail(selectedCase)
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>, folderId: number | null) {
    if (!e.target.files || !e.target.files[0] || !selectedCase || !lawyerId) return

    const file = e.target.files[0]

    const storedPath = await uploadOwnFile(supabase, 'case-files', file)
    if (!storedPath) {
      alert('تعذر رفع الملف، حاول مرة أخرى')
      return
    }

    await supabase.from('case_files').insert({
      lawyer_id: lawyerId,
      client_name: selectedCase.client_name,
      file_name: file.name,
      file_url: storedPath,
      case_id: selectedCase.id,
      folder_id: folderId,
    })

    await loadCaseDetail(selectedCase)
  }

  async function handleAddInvoice() {
    if (!newInvoiceAmount || !selectedCase) return
    setSavingInvoice(true)

    await supabase.from('invoices').insert({
      lawyer_id: lawyerId,
      client_name: selectedCase.client_name,
      client_phone: selectedCase.client_phone,
      amount: Number(newInvoiceAmount),
      status: 'unpaid',
      due_date: newInvoiceDueDate || null,
      case_id: selectedCase.id,
    })

    setNewInvoiceAmount('')
    setNewInvoiceDueDate('')
    await loadCaseDetail(selectedCase)
    setSavingInvoice(false)
  }

  async function handleUpdateInvoiceAmount(invoiceId: number, newAmount: string) {
    await supabase.from('invoices').update({ amount: Number(newAmount) }).eq('id', invoiceId)
    if (selectedCase) await loadCaseDetail(selectedCase)
  }

  async function handleToggleInvoiceStatus(invoice: Invoice) {
    const newStatus = invoice.status === 'paid' ? 'unpaid' : 'paid'
    const paidAtValue = newStatus === 'paid' ? new Date().toISOString() : null
    await supabase.from('invoices').update({ status: newStatus, paid_at: paidAtValue }).eq('id', invoice.id)
    if (selectedCase) await loadCaseDetail(selectedCase)
  }

  function wakalahExpired(w: WakalahDoc) {
    if (w.status === 'revoked' || !w.expiry_date) return false
    const now = new Date()
    const today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0')
    return w.expiry_date < today
  }

  async function handleLinkWakalah(wakalahId: number) {
    if (!selectedCase) return
    await supabase.from('wakalah_documents').update({ case_id: selectedCase.id }).eq('id', wakalahId)
    await loadCaseDetail(selectedCase)
  }

  function getSpecialtyName(id: number | null) {
    if (!id) return ''
    const found = specialties.find(function (s) { return s.id === id })
    return found ? found.name_ar : ''
  }

  function getNextHearing(caseId: number) {
    const caseHearings = hearingsAll.filter(function (h) { return h.case_id === caseId })
    const upcoming = caseHearings.filter(function (h) { return h.hearing_date >= todayString() })
    upcoming.sort(function (a, b) { return a.hearing_date.localeCompare(b.hearing_date) })
    return upcoming.length > 0 ? upcoming[0] : null
  }

  function getKanbanColumn(c: LegalCase) {
    return CASE_STATUSES.indexOf(c.status) === -1 ? CASE_STATUSES[0] : c.status
  }

  function getRosterName(id: number) {
    const found = roster.find(function (l) { return l.id === id })
    return found ? found.full_name : ''
  }

  const visibleCases = cases.filter(function (c) {
    if (isFirm && lawyerFilter !== 'all' && c.lawyer_id !== Number(lawyerFilter)) return false
    if (statusFilter === 'all') return true
    const open = OPEN_STATUSES.indexOf(getKanbanColumn(c)) !== -1
    if (statusFilter === 'active') return open
    if (statusFilter === 'closed') return !open
    return true
  })

  async function handleDropOnColumn(column: string) {
    if (draggedCaseId === null || isFirm) return
    const update: { status: string; suspension_type?: null } = { status: column }
    if (column !== 'موقوفة') update.suspension_type = null
    await supabase.from('legal_cases').update(update).eq('id', draggedCaseId)
    setDraggedCaseId(null)
    if (lawyerId) await loadCases(lawyerId)
  }

  async function handleSuspensionOnCard(caseId: number, value: string) {
    await supabase.from('legal_cases').update({ suspension_type: value || null }).eq('id', caseId)
    if (lawyerId) await loadCases(lawyerId)
  }

  function renderCaseCard(c: LegalCase, draggable: boolean) {
    const nextHearing = getNextHearing(c.id)
    const menuOpenHere = cardMenuOpenId === c.id

    function clickCard() {
      loadCaseDetail(c)
    }

    function menuClick(e: React.MouseEvent) {
      e.stopPropagation()
      setCardMenuOpenId(menuOpenHere ? null : c.id)
    }

    function editClick(e: React.MouseEvent) {
      e.stopPropagation()
      setCardMenuOpenId(null)
      loadCaseDetail(c).then(function () { startFullEdit() })
    }

    function deleteClick(e: React.MouseEvent) {
      e.stopPropagation()
      handleDeleteCase(c.id)
    }

    function dragStart() {
      setDraggedCaseId(c.id)
    }

    return (
      <div
        key={c.id}
        onClick={clickCard}
        draggable={draggable}
        onDragStart={dragStart}
        className="cursor-pointer bg-white border border-[#D8D2C4] rounded-lg p-4 mb-3 hover:border-[#AD8A4E] transition relative"
      >
        <div className="flex justify-between items-start mb-2">
          <p className="font-['Tajawal'] font-bold text-[#1B1A17]">رقم {c.case_number}</p>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-[#F3EEE4] text-[#AD8A4E] text-xs font-['Tajawal'] rounded-full">{c.status}{c.status === 'موقوفة' && c.suspension_type ? ' — ' + c.suspension_type : ''}</span>
            {!isFirm && (
            <div className="relative">
              <button onClick={menuClick} className="cursor-pointer text-[#4A473F] px-1">⋮</button>
              {menuOpenHere && (
                <div className="absolute left-0 top-full mt-1 bg-white border border-[#D8D2C4] rounded-md shadow-lg z-10 w-28">
                  <button onClick={editClick} className="cursor-pointer w-full text-right px-3 py-2 font-['Tajawal'] text-xs text-[#1B1A17] hover:bg-[#F3EEE4]">تعديل</button>
                  <button onClick={deleteClick} className="cursor-pointer w-full text-right px-3 py-2 font-['Tajawal'] text-xs text-[#7A2E2E] hover:bg-[#F3EEE4] border-t border-[#D8D2C4]">حذف</button>
                </div>
              )}
            </div>
            )}
          </div>
        </div>
        {isFirm && <p className="font-['Tajawal'] text-xs text-[#1B1A17] font-bold mb-1">المحامي: {getRosterName(c.lawyer_id)}</p>}
        <p className="font-['Tajawal'] text-sm text-[#4A473F] mb-1">الموكل: {c.client_name}</p>
        {c.opposing_party && <p className="font-['Tajawal'] text-sm text-[#4A473F] mb-1">ضد: {c.opposing_party}</p>}
        <p className="font-['Tajawal'] text-xs text-[#AD8A4E] mb-1">{[getSpecialtyName(c.specialty_id), c.court_category, courtOf(c)].filter(Boolean).join(' — ')}</p>
        {c.status === 'موقوفة' && !isFirm && (
          <select
            value={c.suspension_type || ''}
            onClick={function (e) { e.stopPropagation() }}
            onChange={function (e) { handleSuspensionOnCard(c.id, e.target.value) }}
            className="w-full mt-1 mb-1 px-2 py-1 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-xs text-[#1B1A17]"
          >
            <option value="">نوع الوقف؟</option>
            {SUSPENSION_TYPES.map(function (t) { return <option key={t} value={t}>{t}</option> })}
          </select>
        )}
        {nextHearing && (
          <p className="font-['Tajawal'] text-xs text-[#2F4538] font-bold">الجلسة القادمة: {formatDateDisplay(nextHearing.hearing_date)}</p>
        )}
      </div>
    )
  }

  function renderKanban() {
    function dragOver(e: React.DragEvent) {
      e.preventDefault()
    }

    return (
      <div className="flex gap-3 overflow-x-auto pb-3 -mx-1 px-1">
        {CASE_STATUSES.map(function (col) {
          const colCases = visibleCases.filter(function (c) { return getKanbanColumn(c) === col })

          function dropHandler() {
            handleDropOnColumn(col)
          }

          return (
            <div key={col} onDragOver={dragOver} onDrop={dropHandler} className="bg-[#F3EEE4] rounded-lg p-3 min-h-[160px] min-w-[230px] flex-1 shrink-0">
              <h3 className="font-['Tajawal'] font-bold text-sm text-[#1B1A17] mb-3 text-center">{col} ({colCases.length})</h3>
              {colCases.length === 0 && (
                <p className="font-['Tajawal'] text-xs text-[#4A473F] text-center">لا توجد قضايا</p>
              )}
              {colCases.map(function (c) { return renderCaseCard(c, !isFirm) })}
            </div>
          )
        })}
      </div>
    )
  }

  function renderHearing(h: CaseHearing) {
    const isEditing = editingHearingId === h.id

    function editClick() {
      startEditHearing(h)
    }

    function saveClick() {
      handleSaveHearingEdit(h)
    }

    return (
      <div key={h.id} className="bg-[#F3EEE4] rounded-md p-4 mb-3">
        <div className="flex justify-between items-start mb-2">
          <p className="font-['Tajawal'] font-bold text-sm text-[#1B1A17]">{formatDateDisplay(h.hearing_date)} {h.hearing_time ? '- ' + h.hearing_time : ''}</p>
          {!isEditing && !isFirm && (
            <button onClick={editClick} className="font-['Tajawal'] text-xs text-[#AD8A4E]">تحديث الجلسة</button>
          )}
        </div>

        {!isEditing && (h.outcome || h.next_procedure || h.procedure_due_date) && (
          <div className="space-y-1">
            {h.outcome && <p className="font-['Tajawal'] text-xs text-[#4A473F]"><span className="font-bold text-[#1B1A17]">ما تم في الجلسة:</span> {h.outcome}</p>}
            {h.next_procedure && <p className="font-['Tajawal'] text-xs text-[#4A473F]"><span className="font-bold text-[#1B1A17]">المطلوب للجلسة القادمة:</span> {h.next_procedure}</p>}
            {h.procedure_due_date && <p className="font-['Tajawal'] text-xs text-[#7A2E2E] font-bold">الجلسة القادمة: {formatDateDisplay(h.procedure_due_date)} {h.procedure_due_time || ''}</p>}
          </div>
        )}

        {isEditing && (
          <div className="space-y-3 mt-2">
            <div>
              <label className={labelClass}>ما تم في الجلسة</label>
              <textarea value={editOutcome} onChange={function (e) { setEditOutcome(e.target.value) }} rows={2} className={smallFieldClass} />
            </div>
            <div>
              <label className={labelClass}>المطلوب للجلسة القادمة (شهود، مستندات، مذكرة...)</label>
              <textarea value={editNextProcedure} onChange={function (e) { setEditNextProcedure(e.target.value) }} rows={2} className={smallFieldClass} />
            </div>
            <div>
              <label className={labelClass}>موعد الجلسة القادمة</label>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-start">
                <DateFields value={editProcedureDate} onChange={setEditProcedureDate} tone="white" />
                <input type="time" value={editProcedureTime} onChange={function (e) { setEditProcedureTime(e.target.value) }} className={smallFieldClass} />
              </div>
            </div>
            <div>
              <label className={labelClass}>تذكير للتحضير قبل الجلسة بـ</label>
              <div className="flex gap-2">
                {[3, 4].map(function (d) {
                  return (
                    <button key={d} type="button" onClick={function () { setEditReminderDays(d) }} className={"flex-1 py-2 rounded-md font-['Tajawal'] text-xs " + (editReminderDays === d ? 'bg-[#1B1A17] text-white' : 'bg-white text-[#4A473F] border border-[#D8D2C4]')}>
                      {d} أيام
                    </button>
                  )
                })}
              </div>
              <p className="font-['Tajawal'] text-[11px] text-[#4A473F] mt-1">تُضاف الجلسة القادمة والتذكير إلى أجندتك تلقائياً.</p>
            </div>
            {hearingError && <p className="font-['Tajawal'] text-xs text-[#7A2E2E]">{hearingError}</p>}
            <div className="flex gap-2">
              <button onClick={function () { setEditingHearingId(null) }} className="flex-1 py-2 bg-white text-[#4A473F] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-xs">إلغاء</button>
              <button onClick={saveClick} className="flex-1 py-2 bg-[#1B1A17] text-white rounded-md font-['Tajawal'] text-xs">حفظ</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  function renderInvoiceRow(inv: Invoice) {
    function amountBlur(e: React.FocusEvent<HTMLInputElement>) {
      if (e.target.value !== String(inv.amount)) {
        handleUpdateInvoiceAmount(inv.id, e.target.value)
      }
    }

    function statusClick() {
      handleToggleInvoiceStatus(inv)
    }

    if (isFirm) {
      return (
        <div key={inv.id} className="flex items-center justify-between bg-[#F3EEE4] rounded-md p-3 mb-2">
          <span className="font-['Tajawal'] text-sm text-[#1B1A17]">المبلغ: {inv.amount} {cur}</span>
          <span className={"px-3 py-1.5 rounded-md font-['Tajawal'] text-xs " + (inv.status === 'paid' ? 'bg-[#2F4538] text-white' : 'bg-[#7A2E2E] text-white')}>
            {inv.status === 'paid' ? 'مدفوعة' : 'غير مدفوعة'}
          </span>
        </div>
      )
    }

    return (
      <div key={inv.id} className="flex items-center justify-between bg-[#F3EEE4] rounded-md p-3 mb-2">
        <div className="flex items-center gap-2">
          <span className="font-['Tajawal'] text-xs text-[#4A473F]">المبلغ:</span>
          <input
            type="number"
            defaultValue={inv.amount}
            onBlur={amountBlur}
            className="w-24 px-2 py-1 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
          />
          <span className="font-['Tajawal'] text-xs text-[#4A473F]">{cur}</span>
        </div>
        <button onClick={statusClick} className={"px-3 py-1.5 rounded-md font-['Tajawal'] text-xs " + (inv.status === 'paid' ? 'bg-[#2F4538] text-white' : 'bg-[#7A2E2E] text-white')}>
          {inv.status === 'paid' ? 'مدفوعة' : 'غير مدفوعة'}
        </button>
      </div>
    )
  }

  function renderCaseForm() {
    function field(label: string, input: React.ReactNode) {
      return (
        <div>
          <label className={labelClass}>{label}</label>
          {input}
        </div>
      )
    }

    return (
      <div className="bg-white border-2 border-[#AD8A4E] rounded-lg p-6 mb-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {field('رقم القضية', <input type="text" value={formCaseNumber} onChange={function (e) { setFormCaseNumber(e.target.value) }} className={fieldClass} />)}
          {field('الاختصاص', (
            <select value={formSpecialty} onChange={function (e) { setFormSpecialty(e.target.value) }} className={fieldClass}>
              <option value="">اختر</option>
              {specialties.map(function (sp) { return <option key={sp.id} value={sp.id}>{sp.name_ar}</option> })}
            </select>
          ))}
          {field('اسم الموكل', <input type="text" value={formClientName} onChange={function (e) { setFormClientName(e.target.value) }} className={fieldClass} />)}
          {field('هاتف الموكل', <input type="tel" value={formClientPhone} onChange={function (e) { setFormClientPhone(e.target.value) }} className={fieldClass} />)}
          {field('الخصم (شخص أو شركة أو جهة حكومية)', <input type="text" value={formOpposingParty} onChange={function (e) { setFormOpposingParty(e.target.value) }} className={fieldClass} />)}
          {field('محامي الخصم', <input type="text" value={formOpposingCounsel} onChange={function (e) { setFormOpposingCounsel(e.target.value) }} className={fieldClass} />)}
        </div>

        {field('موضوع الدعوى', <textarea value={formLawsuitSubject} onChange={function (e) { setFormLawsuitSubject(e.target.value) }} rows={2} className={fieldClass} />)}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {field('قيمة الدعوى (' + cur + ')', <input type="number" value={formCaseValue} onChange={function (e) { setFormCaseValue(e.target.value) }} className={fieldClass} />)}
          {field('تاريخ رفع الدعوى', <DateFields value={formFilingDate} onChange={setFormFilingDate} tone="paper" />)}
        </div>

        <div className="border-t border-[#D8D2C4] pt-4">
          <CourtPicker value={formCourt} onChange={setFormCourt} abroad={abroad} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {field('اسم القاضي', <input type="text" value={formJudgeName} onChange={function (e) { setFormJudgeName(e.target.value) }} className={fieldClass} />)}
          {field('الشهود', <textarea value={formWitnesses} onChange={function (e) { setFormWitnesses(e.target.value) }} rows={1} className={fieldClass} />)}
        </div>

        {field('ملاحظات', <textarea value={formNotes} onChange={function (e) { setFormNotes(e.target.value) }} rows={2} className={fieldClass} />)}
      </div>
    )
  }

  function renderCaseDetail() {
    if (!selectedCase) return null
    const c = selectedCase
    const caseHearingsList = hearingsAll.filter(function (h) { return h.case_id === c.id }).sort(function (a, b) { return a.hearing_date.localeCompare(b.hearing_date) })

    let totalInvoiced = 0
    let totalPaid = 0
    caseInvoices.forEach(function (inv) {
      totalInvoiced = totalInvoiced + Number(inv.amount)
      if (inv.status === 'paid') totalPaid = totalPaid + Number(inv.amount)
    })
    const totalPending = totalInvoiced - totalPaid

    async function statusChange(e: React.ChangeEvent<HTMLSelectElement>) {
      const value = e.target.value
      if (value !== 'موقوفة' && c.suspension_type) await handleUpdateCaseField('suspension_type', null)
      handleUpdateCaseField('status', value)
    }

    function folderNameChange(e: React.ChangeEvent<HTMLInputElement>) {
      setNewFolderName(e.target.value)
    }

    function generalUploadChange(e: React.ChangeEvent<HTMLInputElement>) {
      handleFileUpload(e, null)
    }

    function invoiceAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
      setNewInvoiceAmount(e.target.value)
    }

    function deleteThisCase() {
      handleDeleteCase(c.id)
    }

    return (
      <div>
        <button onClick={backToList} className="font-['Tajawal'] text-sm text-[#AD8A4E] mb-4">← العودة للقائمة</button>

        <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="font-['Tajawal'] font-bold text-xl text-[#1B1A17]">قضية رقم {c.case_number}</h2>
              {isFirm && <p className="font-['Tajawal'] text-sm text-[#4A473F] mt-1">المحامي: {getRosterName(c.lawyer_id)} — {c.status}{c.status === 'موقوفة' && c.suspension_type ? ' (' + c.suspension_type + ')' : ''}</p>}
            </div>
            {!isFirm && (
            <div className="flex items-center gap-2">
              <select value={getKanbanColumn(c)} onChange={statusChange} className="px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]">
                {CASE_STATUSES.map(function (st) { return <option key={st} value={st}>{st}</option> })}
              </select>
              {c.status === 'موقوفة' && (
                <select value={c.suspension_type || ''} onChange={function (e) { handleUpdateCaseField('suspension_type', e.target.value || null) }} className="px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]">
                  <option value="">نوع الوقف</option>
                  {SUSPENSION_TYPES.map(function (t) { return <option key={t} value={t}>{t}</option> })}
                </select>
              )}
              {!editingCase && (
                <button onClick={startFullEdit} className="px-3 py-2 bg-[#AD8A4E] text-white rounded-md font-['Tajawal'] text-xs">تعديل</button>
              )}
              <button onClick={deleteThisCase} className="px-3 py-2 bg-[#7A2E2E] text-white rounded-md font-['Tajawal'] text-xs">حذف</button>
            </div>
            )}
          </div>

          {editingCase ? (
            <div>
              {renderCaseForm()}
              <div className="flex gap-2">
                <button onClick={function () { setEditingCase(false) }} className="flex-1 py-2 bg-[#F3EEE4] text-[#4A473F] rounded-md font-['Tajawal'] text-sm">إلغاء</button>
                <button onClick={handleSaveFullEdit} className="flex-1 py-2 bg-[#1B1A17] text-white rounded-md font-['Tajawal'] text-sm">حفظ التعديلات</button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 font-['Tajawal'] text-sm mb-4">
              <div><p className="text-[#4A473F]">الموكل</p><p className="text-[#1B1A17] font-medium">{c.client_name}</p></div>
              <div><p className="text-[#4A473F]">هاتف الموكل</p><p className="text-[#1B1A17] font-medium">{c.client_phone || '-'}</p></div>
              <div><p className="text-[#4A473F]">الخصم</p><p className="text-[#1B1A17] font-medium">{c.opposing_party || '-'}</p></div>
              <div><p className="text-[#4A473F]">محامي الخصم</p><p className="text-[#1B1A17] font-medium">{c.opposing_counsel || '-'}</p></div>
              <div className="col-span-2"><p className="text-[#4A473F]">موضوع الدعوى</p><p className="text-[#1B1A17] font-medium">{c.lawsuit_subject || '-'}</p></div>
              <div><p className="text-[#4A473F]">قيمة الدعوى</p><p className="text-[#1B1A17] font-medium">{c.case_value ? c.case_value + ' ' + cur : '-'}</p></div>
              <div><p className="text-[#4A473F]">تاريخ رفع الدعوى</p><p className="text-[#1B1A17] font-medium">{formatDateDisplay(c.filing_date)}</p></div>
              {!abroad && <div><p className="text-[#4A473F]">نوع القضاء</p><p className="text-[#1B1A17] font-medium">{c.court_category || '-'}</p></div>}
              <div><p className="text-[#4A473F]">المحكمة</p><p className="text-[#1B1A17] font-medium">{c.court_instance || c.court_name || '-'}</p></div>
              <div><p className="text-[#4A473F]">الموقع</p><p className="text-[#1B1A17] font-medium">{c.court_location || '-'}</p></div>
              <div><p className="text-[#4A473F]">القاضي</p><p className="text-[#1B1A17] font-medium">{c.judge_name || '-'}</p></div>
              <div className="col-span-2"><p className="text-[#4A473F]">الشهود</p><p className="text-[#1B1A17] font-medium">{c.witnesses || '-'}</p></div>
              {c.notes && <div className="col-span-2"><p className="text-[#4A473F]">ملاحظات</p><p className="text-[#1B1A17] font-medium">{c.notes}</p></div>}
            </div>
          )}
        </div>

        <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-6">
          <h3 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mb-4">الفواتير</h3>
          <div className="grid grid-cols-3 gap-4 text-center mb-4">
            <div><p className="font-['Tajawal'] text-xs text-[#4A473F]">إجمالي</p><p className="font-['Tajawal'] font-bold text-xl text-[#1B1A17]">{totalInvoiced} {cur}</p></div>
            <div><p className="font-['Tajawal'] text-xs text-[#4A473F]">مدفوع</p><p className="font-['Tajawal'] font-bold text-xl text-[#2F4538]">{totalPaid} {cur}</p></div>
            <div><p className="font-['Tajawal'] text-xs text-[#4A473F]">معلّق</p><p className="font-['Tajawal'] font-bold text-xl text-[#7A2E2E]">{totalPending} {cur}</p></div>
          </div>

          {caseInvoices.map(renderInvoiceRow)}

          {!isFirm && (
          <div className="flex flex-wrap gap-2 mt-3 items-start">
            <input type="number" value={newInvoiceAmount} onChange={invoiceAmountChange} placeholder="مبلغ فاتورة جديدة" className="flex-1 px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
            <div className="w-full sm:w-56">
              <p className="font-['Tajawal'] text-[11px] text-[#4A473F] mb-1">تاريخ الاستحقاق</p>
              <DateFields value={newInvoiceDueDate} onChange={setNewInvoiceDueDate} tone="paper" />
            </div>
            <button onClick={handleAddInvoice} disabled={savingInvoice} className="px-4 py-2 bg-[#1B1A17] text-white rounded-md font-['Tajawal'] text-sm">إضافة فاتورة</button>
          </div>
          )}
        </div>

        <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17]">الجلسات</h3>
            {!isFirm && (
            <button onClick={function () { setShowAddHearing(!showAddHearing) }} className="px-4 py-2 bg-[#AD8A4E] text-white rounded-md font-['Tajawal'] text-xs">
              {showAddHearing ? 'إلغاء' : '+ إضافة جلسة'}
            </button>
            )}
          </div>

          {showAddHearing && !isFirm && (
            <div className="bg-[#F3EEE4] rounded-md p-4 mb-4">
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 mb-3 items-start">
                <DateFields value={hearingDate} onChange={setHearingDate} tone="white" />
                <input type="time" value={hearingTime} onChange={function (e) { setHearingTime(e.target.value) }} className="w-full px-3 py-2 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
              </div>
              <button onClick={handleAddHearing} disabled={savingHearing} className="w-full py-2 bg-[#1B1A17] text-white rounded-md font-['Tajawal'] text-sm">
                {savingHearing ? 'جاري الحفظ...' : 'حفظ الجلسة (وستُضاف تلقائياً للأجندة)'}
              </button>
            </div>
          )}

          {caseHearingsList.length === 0 && <p className="font-['Tajawal'] text-sm text-[#4A473F]">لا توجد جلسات بعد</p>}
          {caseHearingsList.map(renderHearing)}
        </div>

        <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-6">
          <h3 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mb-4">الملفات والمجلدات</h3>

          {!isFirm && (
          <div className="mb-4">
            <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-1">رفع ملف مباشرة للقضية</label>
            <label className="cursor-pointer inline-block px-4 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-xs text-[#4A473F] hover:bg-[#D8D2C4] transition">
              📎 اختر ملفاً
              <input type="file" onChange={generalUploadChange} className="hidden" />
            </label>
          </div>
          )}

          {!isFirm && (
          <div className="flex gap-2 mb-4">
            <input type="text" value={newFolderName} onChange={folderNameChange} placeholder="اسم مجلد جديد (اختياري)" className="flex-1 px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
            <button onClick={handleAddFolder} className="px-4 py-2 bg-[#1B1A17] text-white rounded-md font-['Tajawal'] text-xs">إنشاء مجلد</button>
          </div>
          )}

          {caseFolders.map(function (folder) {
            const folderFiles = caseFiles.filter(function (f) { return f.folder_id === folder.id })

            function folderUploadChange(e: React.ChangeEvent<HTMLInputElement>) {
              handleFileUpload(e, folder.id)
            }

            return (
              <div key={folder.id} className="bg-[#F3EEE4] rounded-md p-3 mb-3">
                <p className="font-['Tajawal'] font-bold text-sm text-[#1B1A17] mb-2">📁 {folder.folder_name}</p>
                {folderFiles.map(function (f) {
                  return <button type="button" key={f.id} onClick={function () { openPrivateFile(supabase, 'case-files', f.file_url) }} className="block font-['Tajawal'] text-xs text-[#AD8A4E] underline mb-1">{f.file_name}</button>
                })}
                {!isFirm && (
                <label className="cursor-pointer inline-block mt-2 px-3 py-1.5 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-xs text-[#4A473F] hover:bg-[#D8D2C4] transition">
                  📎 رفع ملف لهذا المجلد
                  <input type="file" onChange={folderUploadChange} className="hidden" />
                </label>
                )}
              </div>
            )
          })}

          {caseFiles.filter(function (f) { return !f.folder_id }).length > 0 && (
            <div>
              <p className="font-['Tajawal'] text-xs text-[#4A473F] mb-1">ملفات بدون مجلد:</p>
              {caseFiles.filter(function (f) { return !f.folder_id }).map(function (f) {
                return <button type="button" key={f.id} onClick={function () { openPrivateFile(supabase, 'case-files', f.file_url) }} className="block font-['Tajawal'] text-xs text-[#AD8A4E] underline mb-1">{f.file_name}</button>
              })}
            </div>
          )}
        </div>

        <div className="bg-white border border-[#D8D2C4] rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17]">الوكالة</h3>
            <a href="/wakalah" className="font-['Tajawal'] text-xs text-[#AD8A4E] hover:underline">كل الوكالات ←</a>
          </div>

          {caseWakalah.map(function (w) {
            const expired = wakalahExpired(w)
            const revoked = w.status === 'revoked'
            return (
              <div key={w.id} className={"rounded-md p-3 mb-2 border " + (expired || revoked ? 'bg-[#F3EEE4] border-[#7A2E2E]/40' : 'bg-[#F3EEE4] border-transparent')}>
                <div className="flex justify-between items-start gap-2 mb-1">
                  <p className="font-['Tajawal'] font-bold text-sm text-[#1B1A17]">{w.client_name || c.client_name}</p>
                  <span className={"px-2 py-0.5 rounded-full font-['Tajawal'] text-[11px] whitespace-nowrap " + (revoked ? 'bg-[#7A2E2E] text-white' : expired ? 'bg-white text-[#7A2E2E] border border-[#7A2E2E]' : 'bg-[#D9E5DC] text-[#2F4538]')}>
                    {revoked ? 'ملغاة' : expired ? 'منتهية' : (w.wakalah_type || 'وكالة')}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1 font-['Tajawal'] text-xs text-[#4A473F]">
                  {w.certified_date && <p>تاريخ التصديق: {formatDateDisplay(w.certified_date)}</p>}
                  {w.certified_by && <p>جهة التصديق: {w.certified_by}</p>}
                  {w.expiry_date && <p className={expired ? 'text-[#7A2E2E] font-bold' : ''}>تاريخ الانتهاء: {formatDateDisplay(w.expiry_date)}</p>}
                  {w.issued_abroad && (
                    <p className="col-span-2">صادرة من الخارج — وزارة الخارجية: {w.mofa_date ? formatDateDisplay(w.mofa_date) : 'لم تُصدّق بعد'} — كاتب العدل: {w.notary_date ? formatDateDisplay(w.notary_date) : 'لم تُصدّق بعد'}</p>
                  )}
                </div>
                <div className="flex gap-3 mt-1">
                  {w.lawyer_file_url && <button type="button" onClick={function () { openPrivateFile(supabase, 'wakalah-files', w.lawyer_file_url as string) }} className="font-['Tajawal'] text-xs text-[#AD8A4E] underline">عرض ملف الوكالة</button>}
                  {w.customer_file_url && <button type="button" onClick={function () { openPrivateFile(supabase, 'wakalah-files', w.customer_file_url as string) }} className="font-['Tajawal'] text-xs text-[#2F4538] underline">النسخة الموقّعة من العميل</button>}
                </div>
              </div>
            )
          })}

          {caseWakalah.length === 0 && isFirm && (
            <p className="font-['Tajawal'] text-sm text-[#4A473F]">لا توجد وكالة مرتبطة بهذه القضية</p>
          )}

          {!isFirm && (
            <a href={'/wakalah?case=' + c.id} className="inline-block mt-1 mb-3 px-4 py-2 bg-[#AD8A4E] text-white rounded-md font-['Tajawal'] text-xs hover:bg-[#c49b58] transition">
              + وكالة جديدة لهذه القضية (في صفحة الوكالات)
            </a>
          )}

          {!isFirm && unlinkedWakalah.length > 0 && (
            <div>
              <p className="font-['Tajawal'] text-xs text-[#4A473F] mb-2">أو اربط وكالة مسجّلة سابقاً بهذه القضية:</p>
              {unlinkedWakalah.map(function (w) {
                return (
                  <button key={w.id} onClick={function () { handleLinkWakalah(w.id) }} className="flex justify-between items-center font-['Tajawal'] text-xs text-[#1B1A17] bg-[#F3EEE4] hover:bg-[#EDE6D8] rounded-md p-2 mb-1 w-full text-right transition">
                    <span>{w.client_name || 'وكالة'}{w.wakalah_type ? ' — ' + w.wakalah_type : ''}{w.certified_date ? ' — ' + formatDateDisplay(w.certified_date) : ''}</span>
                    <span className="text-[#AD8A4E]">ربط ←</span>
                  </button>
                )
              })}
            </div>
          )}
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
            <h1 className="font-['Tajawal'] font-bold text-2xl text-[#1B1A17] mb-3">يلزم الاشتراك للوصول إلى ملفات القضايا</h1>
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
              {isFirm && (
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
          <h1 className="font-['Tajawal'] font-bold text-4xl mb-2">ملفات القضايا ({cases.length})</h1>
          {isFirm ? (
            <p className="font-['Tajawal'] text-sm text-[#D8D2C4]">قضايا محامي المكتب — للاطلاع فقط. القضايا الخاصة بحساب المحامي الخاص لا تظهر هنا.</p>
          ) : (
            <div className="w-16 h-[2px] bg-[#AD8A4E]"></div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10 flex-1 w-full">
        {!isFirm && <WorkspaceSwitch />}

        {!selectedCase && (
          <div>
            {isFirm && (
              <select value={lawyerFilter} onChange={function (e) { setLawyerFilter(e.target.value) }} className="w-full px-3 py-2 mb-4 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]">
                <option value="all">جميع المحامين</option>
                {roster.map(function (l) { return <option key={l.id} value={String(l.id)}>{l.full_name}</option> })}
              </select>
            )}

            <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
              <div className="flex bg-white border border-[#D8D2C4] rounded-md p-1 w-fit">
                <button onClick={function () { setView('list') }} className={"px-5 py-2 rounded font-['Tajawal'] text-sm font-medium transition " + (view === 'list' ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'text-[#4A473F]')}>قائمة</button>
                <button onClick={function () { setView('kanban') }} className={"px-5 py-2 rounded font-['Tajawal'] text-sm font-medium transition " + (view === 'kanban' ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'text-[#4A473F]')}>كانبان</button>
              </div>

              <select value={statusFilter} onChange={function (e) { setStatusFilter(e.target.value) }} className="px-4 py-2 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]">
                <option value="active">المنظورة والجارية فقط</option>
                <option value="closed">المنتهية (مفصولة، منفذة، مسقطة، متروكة)</option>
                <option value="all">عرض الكل</option>
              </select>

              {!isFirm && (
              <button onClick={function () { resetCaseForm(); setShowAddCase(!showAddCase) }} className="px-5 py-2 bg-[#AD8A4E] text-white rounded-md font-['Tajawal'] text-sm">
                {showAddCase ? 'إلغاء' : '+ إضافة قضية'}
              </button>
              )}
            </div>

            {showAddCase && !isFirm && (
              <div>
                {renderCaseForm()}
                <button onClick={handleAddCase} disabled={savingCase} className="w-full py-3 mb-6 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal'] font-medium hover:bg-[#AD8A4E] transition disabled:opacity-60">
                  {savingCase ? 'جاري الإضافة...' : 'إضافة القضية'}
                </button>
              </div>
            )}

            {visibleCases.length === 0 && !showAddCase && (
              <p className="font-['Tajawal'] text-center text-[#4A473F]">لا توجد قضايا مطابقة</p>
            )}

            {view === 'list' && visibleCases.map(function (c) { return renderCaseCard(c, false) })}
            {view === 'kanban' && renderKanban()}
          </div>
        )}

        {selectedCase && renderCaseDetail()}
      </div>

      <Footer variant={isFirm ? 'firm' : 'lawyer'} />
    </div>
  )
}