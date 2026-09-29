'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'
import { uploadOwnFile, openPrivateFile } from '../lib/files'

type LegalCase = {
  id: number
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
  court_instance: string | null
  court_location: string | null
  judge_name: string | null
  witnesses: string | null
  status: string
  deadline_date: string | null
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
}

type Specialty = {
  id: number
  name_ar: string
}

const courtInstances = ['محكمة البداية', 'محكمة الاستئناف', 'محكمة التمييز']
const statusOptions = ['نشطة', 'مؤجلة', 'مكتسبة', 'خاسرة', 'مغلقة']

function formatDateDisplay(dateStr: string | null) {
  if (!dateStr) return '-'
  const parts = dateStr.split('-')
  if (parts.length !== 3) return dateStr
  return parts[2] + '/' + parts[1] + '/' + parts[0]
}

export default function LawyerCasesPage() {
  const [loading, setLoading] = useState(true)
  const [lawyerId, setLawyerId] = useState<number | null>(null)
  const [notAllowed, setNotAllowed] = useState(false)
  const [notSubscribed, setNotSubscribed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

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
  const [formCourtName, setFormCourtName] = useState('')
  const [formCourtInstance, setFormCourtInstance] = useState(courtInstances[0])
  const [formCourtLocation, setFormCourtLocation] = useState('')
  const [formJudgeName, setFormJudgeName] = useState('')
  const [formWitnesses, setFormWitnesses] = useState('')
  const [formDeadlineDate, setFormDeadlineDate] = useState('')
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

  const [newFolderName, setNewFolderName] = useState('')

  const [newInvoiceAmount, setNewInvoiceAmount] = useState('')
  const [newInvoiceDueDate, setNewInvoiceDueDate] = useState('')
  const [savingInvoice, setSavingInvoice] = useState(false)

  const [uploadingWakalah, setUploadingWakalah] = useState(false)

  const supabase = createClient()
  const router = useRouter()

  async function loadCases(id: number) {
    const casesResult = await supabase.from('legal_cases').select('*').eq('lawyer_id', id).order('id', { ascending: false })
    setCases(casesResult.data || [])

    const caseIds = (casesResult.data || []).map(function (c) { return c.id })
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

      await loadCases(lawyerResult.data.id)
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
    setFormCourtName('')
    setFormCourtInstance(courtInstances[0])
    setFormCourtLocation('')
    setFormJudgeName('')
    setFormWitnesses('')
    setFormDeadlineDate('')
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
      court_name: formCourtName,
      court_instance: formCourtInstance,
      court_location: formCourtLocation,
      judge_name: formJudgeName,
      witnesses: formWitnesses,
      status: 'نشطة',
      deadline_date: formDeadlineDate || null,
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
    await supabase.from('legal_cases').update({ [field]: value }).eq('id', selectedCase.id)
    if (lawyerId) await loadCases(lawyerId)
    setSelectedCase(Object.assign({}, selectedCase, { [field]: value }))
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
      court_name: formCourtName,
      court_instance: formCourtInstance,
      court_location: formCourtLocation,
      judge_name: formJudgeName,
      witnesses: formWitnesses,
      deadline_date: formDeadlineDate || null,
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
    setFormCourtName(selectedCase.court_name || '')
    setFormCourtInstance(selectedCase.court_instance || courtInstances[0])
    setFormCourtLocation(selectedCase.court_location || '')
    setFormJudgeName(selectedCase.judge_name || '')
    setFormWitnesses(selectedCase.witnesses || '')
    setFormDeadlineDate(selectedCase.deadline_date || '')
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

    const wakalahResult = await supabase.from('wakalah_documents').select('id, case_id, lawyer_file_url, customer_file_url, status').eq('case_id', c.id)
    setCaseWakalah(wakalahResult.data || [])

    if (lawyerId) {
      const unlinkedResult = await supabase.from('wakalah_documents').select('id, case_id, lawyer_file_url, customer_file_url, status').eq('lawyer_id', lawyerId).is('case_id', null)
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

  async function syncProcedureToCalendar(dueDate: string, dueTime: string, caseNumber: string) {
    if (!lawyerId) return
    await supabase.from('personal_calendar').insert({
      lawyer_id: lawyerId,
      title: 'إجراء مطلوب - قضية رقم ' + caseNumber,
      event_date: dueDate,
      time_slot: dueTime || '',
      notes: 'موعد تقديم إجراء',
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
  }

  async function handleSaveHearingEdit(h: CaseHearing) {
    if (!selectedCase) return

    await supabase.from('case_hearings').update({
      outcome: editOutcome,
      next_procedure: editNextProcedure,
      procedure_due_date: editProcedureDate || null,
      procedure_due_time: editProcedureTime || null,
    }).eq('id', h.id)

    if (editProcedureDate) {
      await syncProcedureToCalendar(editProcedureDate, editProcedureTime, selectedCase.case_number)
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

  async function handleUploadNewWakalah(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files || !e.target.files[0] || !selectedCase || !lawyerId) return
    setUploadingWakalah(true)

    const file = e.target.files[0]

    const storedPath = await uploadOwnFile(supabase, 'wakalah-files', file)
    if (!storedPath) {
      setUploadingWakalah(false)
      alert('تعذر رفع الملف، حاول مرة أخرى')
      return
    }

    await supabase.from('wakalah_documents').insert({
      lawyer_id: lawyerId,
      case_id: selectedCase.id,
      lawyer_file_url: storedPath,
      status: 'pending_customer',
    })

    await loadCaseDetail(selectedCase)
    setUploadingWakalah(false)
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
    const upcoming = caseHearings.filter(function (h) { return h.hearing_date >= new Date().toISOString().split('T')[0] })
    upcoming.sort(function (a, b) { return a.hearing_date.localeCompare(b.hearing_date) })
    return upcoming.length > 0 ? upcoming[0] : null
  }

  function getKanbanColumn(c: LegalCase) {
    if (c.status === 'مكتسبة') return 'مكتسبة'
    if (c.status === 'خاسرة') return 'خاسرة'
    return c.court_instance || courtInstances[0]
  }

  const kanbanColumns = courtInstances.concat(['مكتسبة', 'خاسرة'])

  const visibleCases = cases.filter(function (c) {
    if (statusFilter === 'all') return true
    if (statusFilter === 'active') return c.status !== 'مغلقة' && c.status !== 'مكتسبة' && c.status !== 'خاسرة'
    if (statusFilter === 'closed') return c.status === 'مغلقة' || c.status === 'مكتسبة' || c.status === 'خاسرة'
    return true
  })

  async function handleDropOnColumn(column: string) {
    if (draggedCaseId === null) return

    if (column === 'مكتسبة' || column === 'خاسرة') {
      await supabase.from('legal_cases').update({ status: column }).eq('id', draggedCaseId)
    } else {
      await supabase.from('legal_cases').update({ court_instance: column, status: 'نشطة' }).eq('id', draggedCaseId)
    }

    setDraggedCaseId(null)
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
            <span className="px-2 py-0.5 bg-[#F3EEE4] text-[#AD8A4E] text-xs font-['Tajawal'] rounded-full">{c.status}</span>
            <div className="relative">
              <button onClick={menuClick} className="cursor-pointer text-[#4A473F] px-1">⋮</button>
              {menuOpenHere && (
                <div className="absolute left-0 top-full mt-1 bg-white border border-[#D8D2C4] rounded-md shadow-lg z-10 w-28">
                  <button onClick={editClick} className="cursor-pointer w-full text-right px-3 py-2 font-['Tajawal'] text-xs text-[#1B1A17] hover:bg-[#F3EEE4]">تعديل</button>
                  <button onClick={deleteClick} className="cursor-pointer w-full text-right px-3 py-2 font-['Tajawal'] text-xs text-[#7A2E2E] hover:bg-[#F3EEE4] border-t border-[#D8D2C4]">حذف</button>
                </div>
              )}
            </div>
          </div>
        </div>
        <p className="font-['Tajawal'] text-sm text-[#4A473F] mb-1">الموكل: {c.client_name}</p>
        {c.opposing_party && <p className="font-['Tajawal'] text-sm text-[#4A473F] mb-1">ضد: {c.opposing_party}</p>}
        <p className="font-['Tajawal'] text-xs text-[#AD8A4E] mb-1">{getSpecialtyName(c.specialty_id)} — {c.court_instance}</p>
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
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {kanbanColumns.map(function (col) {
          const colCases = visibleCases.filter(function (c) { return getKanbanColumn(c) === col })

          function dropHandler() {
            handleDropOnColumn(col)
          }

          return (
            <div key={col} onDragOver={dragOver} onDrop={dropHandler} className="bg-[#F3EEE4] rounded-lg p-3 min-h-[120px]">
              <h3 className="font-['Tajawal'] font-bold text-sm text-[#1B1A17] mb-3 text-center">{col} ({colCases.length})</h3>
              {colCases.length === 0 && (
                <p className="font-['Tajawal'] text-xs text-[#4A473F] text-center">لا توجد قضايا</p>
              )}
              {colCases.map(function (c) { return renderCaseCard(c, true) })}
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
          {!isEditing && (
            <button onClick={editClick} className="font-['Tajawal'] text-xs text-[#AD8A4E]">تحديث النتيجة</button>
          )}
        </div>

        {!isEditing && h.outcome && (
          <div>
            <p className="font-['Tajawal'] text-xs text-[#4A473F] mb-1">النتيجة: {h.outcome}</p>
            {h.next_procedure && <p className="font-['Tajawal'] text-xs text-[#4A473F] mb-1">الإجراء المطلوب: {h.next_procedure}</p>}
            {h.procedure_due_date && <p className="font-['Tajawal'] text-xs text-[#7A2E2E]">موعد تقديم الإجراء: {formatDateDisplay(h.procedure_due_date)} {h.procedure_due_time}</p>}
          </div>
        )}

        {isEditing && (
          <div className="space-y-2 mt-2">
            <textarea value={editOutcome} onChange={function (e) { setEditOutcome(e.target.value) }} placeholder="نتيجة الجلسة" rows={2} className="w-full px-3 py-2 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-xs text-[#1B1A17]" />
            <textarea value={editNextProcedure} onChange={function (e) { setEditNextProcedure(e.target.value) }} placeholder="الإجراء المطلوب بعد الجلسة" rows={2} className="w-full px-3 py-2 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-xs text-[#1B1A17]" />
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={editProcedureDate} onChange={function (e) { setEditProcedureDate(e.target.value) }} className="w-full px-3 py-2 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-xs text-[#1B1A17]" />
              <input type="time" value={editProcedureTime} onChange={function (e) { setEditProcedureTime(e.target.value) }} className="w-full px-3 py-2 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-xs text-[#1B1A17]" />
            </div>
            <button onClick={saveClick} className="w-full py-2 bg-[#1B1A17] text-white rounded-md font-['Tajawal'] text-xs">حفظ</button>
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
          <span className="font-['Tajawal'] text-xs text-[#4A473F]">د.أ</span>
        </div>
        <button onClick={statusClick} className={"px-3 py-1.5 rounded-md font-['Tajawal'] text-xs " + (inv.status === 'paid' ? 'bg-[#2F4538] text-white' : 'bg-[#7A2E2E] text-white')}>
          {inv.status === 'paid' ? 'مدفوعة' : 'غير مدفوعة'}
        </button>
      </div>
    )
  }

  function renderCaseForm() {
    return (
      <div className="bg-white border-2 border-[#AD8A4E] rounded-lg p-6 mb-6 space-y-3">
        <input type="text" value={formCaseNumber} onChange={function (e) { setFormCaseNumber(e.target.value) }} placeholder="رقم القضية" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
        <select value={formSpecialty} onChange={function (e) { setFormSpecialty(e.target.value) }} className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]">
          <option value="">اختر الاختصاص</option>
          {specialties.map(function (s) { return <option key={s.id} value={s.id}>{s.name_ar}</option> })}
        </select>
        <input type="text" value={formClientName} onChange={function (e) { setFormClientName(e.target.value) }} placeholder="اسم الموكل" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
        <input type="tel" value={formClientPhone} onChange={function (e) { setFormClientPhone(e.target.value) }} placeholder="هاتف الموكل" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
        <input type="text" value={formOpposingParty} onChange={function (e) { setFormOpposingParty(e.target.value) }} placeholder="الخصم (شخص أو شركة أو جهة حكومية)" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
        <input type="text" value={formOpposingCounsel} onChange={function (e) { setFormOpposingCounsel(e.target.value) }} placeholder="محامي الخصم" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
        <textarea value={formLawsuitSubject} onChange={function (e) { setFormLawsuitSubject(e.target.value) }} placeholder="موضوع الدعوى" rows={2} className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
        <input type="number" value={formCaseValue} onChange={function (e) { setFormCaseValue(e.target.value) }} placeholder="قيمة الدعوى" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
        <div>
          <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-1">تاريخ رفع الدعوى (يوم تقديم الدعوى للمحكمة)</label>
          <input type="date" value={formFilingDate} onChange={function (e) { setFormFilingDate(e.target.value) }} className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
        </div>
        <input type="text" value={formCourtName} onChange={function (e) { setFormCourtName(e.target.value) }} placeholder="اسم المحكمة" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
        <select value={formCourtInstance} onChange={function (e) { setFormCourtInstance(e.target.value) }} className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]">
          {courtInstances.map(function (ci) { return <option key={ci} value={ci}>{ci}</option> })}
        </select>
        <input type="text" value={formCourtLocation} onChange={function (e) { setFormCourtLocation(e.target.value) }} placeholder="موقع المحكمة" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
        <input type="text" value={formJudgeName} onChange={function (e) { setFormJudgeName(e.target.value) }} placeholder="اسم القاضي" className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
        <textarea value={formWitnesses} onChange={function (e) { setFormWitnesses(e.target.value) }} placeholder="الشهود" rows={2} className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
        <div>
          <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-1">موعد حرج (اختياري)</label>
          <p className="font-['Tajawal'] text-xs text-[#AD8A4E] mb-1">لتتبع مواعيد تقادم قانونية أو مواعيد نهائية غير مرتبطة بجلسة محددة بعد</p>
          <input type="date" value={formDeadlineDate} onChange={function (e) { setFormDeadlineDate(e.target.value) }} className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
        </div>
        <textarea value={formNotes} onChange={function (e) { setFormNotes(e.target.value) }} placeholder="ملاحظات" rows={2} className="w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
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

    function statusChange(e: React.ChangeEvent<HTMLSelectElement>) {
      handleUpdateCaseField('status', e.target.value)
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
            <h2 className="font-['Tajawal'] font-bold text-xl text-[#1B1A17]">قضية رقم {c.case_number}</h2>
            <div className="flex items-center gap-2">
              <select value={c.status} onChange={statusChange} className="px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]">
                {statusOptions.map(function (s) { return <option key={s} value={s}>{s}</option> })}
              </select>
              {!editingCase && (
                <button onClick={startFullEdit} className="px-3 py-2 bg-[#AD8A4E] text-white rounded-md font-['Tajawal'] text-xs">تعديل</button>
              )}
              <button onClick={deleteThisCase} className="px-3 py-2 bg-[#7A2E2E] text-white rounded-md font-['Tajawal'] text-xs">حذف</button>
            </div>
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
              <div><p className="text-[#4A473F]">قيمة الدعوى</p><p className="text-[#1B1A17] font-medium">{c.case_value ? c.case_value + ' د.أ' : '-'}</p></div>
              <div><p className="text-[#4A473F]">تاريخ رفع الدعوى</p><p className="text-[#1B1A17] font-medium">{formatDateDisplay(c.filing_date)}</p></div>
              <div><p className="text-[#4A473F]">المحكمة</p><p className="text-[#1B1A17] font-medium">{c.court_name || '-'}</p></div>
              <div><p className="text-[#4A473F]">درجة التقاضي</p><p className="text-[#1B1A17] font-medium">{c.court_instance}</p></div>
              <div><p className="text-[#4A473F]">موقع المحكمة</p><p className="text-[#1B1A17] font-medium">{c.court_location || '-'}</p></div>
              <div><p className="text-[#4A473F]">القاضي</p><p className="text-[#1B1A17] font-medium">{c.judge_name || '-'}</p></div>
              <div className="col-span-2"><p className="text-[#4A473F]">الشهود</p><p className="text-[#1B1A17] font-medium">{c.witnesses || '-'}</p></div>
              <div className="col-span-2 bg-[#F3EEE4] rounded-md p-3">
                <p className="text-[#7A2E2E] font-bold">⚠️ موعد حرج (تقادم/موعد نهائي غير مرتبط بجلسة): {c.deadline_date ? formatDateDisplay(c.deadline_date) : 'غير محدد'}</p>
              </div>
              {c.notes && <div className="col-span-2"><p className="text-[#4A473F]">ملاحظات</p><p className="text-[#1B1A17] font-medium">{c.notes}</p></div>}
            </div>
          )}
        </div>

        <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-6">
          <h3 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mb-4">الفواتير</h3>
          <div className="grid grid-cols-3 gap-4 text-center mb-4">
            <div><p className="font-['Tajawal'] text-xs text-[#4A473F]">إجمالي</p><p className="font-['Tajawal'] font-bold text-xl text-[#1B1A17]">{totalInvoiced} د.أ</p></div>
            <div><p className="font-['Tajawal'] text-xs text-[#4A473F]">مدفوع</p><p className="font-['Tajawal'] font-bold text-xl text-[#2F4538]">{totalPaid} د.أ</p></div>
            <div><p className="font-['Tajawal'] text-xs text-[#4A473F]">معلّق</p><p className="font-['Tajawal'] font-bold text-xl text-[#7A2E2E]">{totalPending} د.أ</p></div>
          </div>

          {caseInvoices.map(renderInvoiceRow)}

          <div className="flex gap-2 mt-3">
            <input type="number" value={newInvoiceAmount} onChange={invoiceAmountChange} placeholder="مبلغ فاتورة جديدة" className="flex-1 px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
            <input type="date" value={newInvoiceDueDate} onChange={function (e) { setNewInvoiceDueDate(e.target.value) }} className="px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
            <button onClick={handleAddInvoice} disabled={savingInvoice} className="px-4 py-2 bg-[#1B1A17] text-white rounded-md font-['Tajawal'] text-sm">إضافة فاتورة</button>
          </div>
        </div>

        <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17]">الجلسات</h3>
            <button onClick={function () { setShowAddHearing(!showAddHearing) }} className="px-4 py-2 bg-[#AD8A4E] text-white rounded-md font-['Tajawal'] text-xs">
              {showAddHearing ? 'إلغاء' : '+ إضافة جلسة'}
            </button>
          </div>

          {showAddHearing && (
            <div className="bg-[#F3EEE4] rounded-md p-4 mb-4">
              <div className="grid grid-cols-2 gap-2 mb-3">
                <input type="date" value={hearingDate} onChange={function (e) { setHearingDate(e.target.value) }} className="w-full px-3 py-2 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
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

          <div className="mb-4">
            <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-1">رفع ملف مباشرة للقضية</label>
            <label className="cursor-pointer inline-block px-4 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-xs text-[#4A473F] hover:bg-[#D8D2C4] transition">
              📎 اختر ملفاً
              <input type="file" onChange={generalUploadChange} className="hidden" />
            </label>
          </div>

          <div className="flex gap-2 mb-4">
            <input type="text" value={newFolderName} onChange={folderNameChange} placeholder="اسم مجلد جديد (اختياري)" className="flex-1 px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]" />
            <button onClick={handleAddFolder} className="px-4 py-2 bg-[#1B1A17] text-white rounded-md font-['Tajawal'] text-xs">إنشاء مجلد</button>
          </div>

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
                <label className="cursor-pointer inline-block mt-2 px-3 py-1.5 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-xs text-[#4A473F] hover:bg-[#D8D2C4] transition">
                  📎 رفع ملف لهذا المجلد
                  <input type="file" onChange={folderUploadChange} className="hidden" />
                </label>              </div>
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
          <h3 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mb-4">الوكالة</h3>

          {caseWakalah.map(function (w) {
            return (
              <div key={w.id} className="bg-[#F3EEE4] rounded-md p-3 mb-2">
                <p className="font-['Tajawal'] text-xs text-[#4A473F]">الحالة: {w.status === 'completed' ? 'مكتملة' : 'بانتظار توقيع العميل'}</p>
                {w.lawyer_file_url && <button type="button" onClick={function () { openPrivateFile(supabase, 'wakalah-files', w.lawyer_file_url as string) }} className="font-['Tajawal'] text-xs text-[#AD8A4E] underline block">عرض ملف الوكالة</button>}
              </div>
            )
          })}

          <div className="mb-3">
            <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-1">رفع وكالة جديدة لهذه القضية</label>
            <label className="cursor-pointer inline-block px-4 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-xs text-[#4A473F] hover:bg-[#D8D2C4] transition">
              📎 اختر ملف الوكالة
              <input type="file" onChange={handleUploadNewWakalah} disabled={uploadingWakalah} className="hidden" />
            </label>
          </div>

          {unlinkedWakalah.length > 0 && (
            <div>
              <p className="font-['Tajawal'] text-xs text-[#4A473F] mb-2">أو اربط وكالة سابقة بهذه القضية:</p>
              {unlinkedWakalah.map(function (w) {
                function linkClick() {
                  handleLinkWakalah(w.id)
                }
                return (
                  <button key={w.id} onClick={linkClick} className="block font-['Tajawal'] text-xs text-[#1B1A17] bg-[#F3EEE4] rounded-md p-2 mb-1 w-full text-right">
                    وكالة #{w.id} — ربط بهذه القضية
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
            <h1 className="font-['Tajawal'] font-bold text-2xl text-[#1B1A17] mb-3">يلزم الاشتراك للوصول إلى ملفات القضايا</h1>
            <a href="/subscription" className="inline-block mt-4 px-6 py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal']">عرض خطط الاشتراك</a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div dir="rtl" className="min-h-screen pattern-bg">
      <div className="bg-[#1B1A17] text-[#F3EEE4] py-12 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-8 font-['Tajawal'] text-sm">
            <a href="/"><img src="/logo.png" alt="حمورابي" className="h-12 w-auto" /></a>
            <div className="flex gap-5 items-center">
              <a href="/my-appointments" className="hover:text-[#AD8A4E] transition">مواعيدي</a>
              <a href="/my-consultations" className="hover:text-[#AD8A4E] transition">استشاراتي</a>
              <a href="/ai-assistant" className="hover:text-[#AD8A4E] transition">مساعد ذكي</a>
              <a href="/lawyer-tools" className="hover:text-[#AD8A4E] transition">أدواتي</a>
              <a href="/community" className="hover:text-[#AD8A4E] transition">المجتمع</a>
              <a href="/lawyer-messages" className="hover:text-[#AD8A4E] transition">الرسائل</a>
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
          <h1 className="font-['Tajawal'] font-bold text-4xl mb-2">ملفات القضايا ({cases.length})</h1>
          <div className="w-16 h-[2px] bg-[#AD8A4E]"></div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10">
        {!selectedCase && (
          <div>
            <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
              <div className="flex bg-white border border-[#D8D2C4] rounded-md p-1 w-fit">
                <button onClick={function () { setView('list') }} className={"px-5 py-2 rounded font-['Tajawal'] text-sm font-medium transition " + (view === 'list' ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'text-[#4A473F]')}>قائمة</button>
                <button onClick={function () { setView('kanban') }} className={"px-5 py-2 rounded font-['Tajawal'] text-sm font-medium transition " + (view === 'kanban' ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'text-[#4A473F]')}>كانبان</button>
              </div>

              <select value={statusFilter} onChange={function (e) { setStatusFilter(e.target.value) }} className="px-4 py-2 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]">
                <option value="active">القضايا النشطة فقط</option>
                <option value="closed">المغلقة/المكتسبة/الخاسرة</option>
                <option value="all">عرض الكل</option>
              </select>

              <button onClick={function () { resetCaseForm(); setShowAddCase(!showAddCase) }} className="px-5 py-2 bg-[#AD8A4E] text-white rounded-md font-['Tajawal'] text-sm">
                {showAddCase ? 'إلغاء' : '+ إضافة قضية'}
              </button>
            </div>

            {showAddCase && (
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
    </div>
  )
}