'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'
import { getLawyerBadgeCount, getFirmBadgeCount } from '../lib/badges'
import Footer from '../components/Footer'
import HeaderLines from '../components/HeaderLines'
import Loader from '../components/Loader'

type Message = {
  id: number
  sender_lawyer_id: number | null
  recipient_lawyer_id: number | null
  sender_firm_id: number | null
  recipient_firm_id: number | null
  body: string
  is_read: boolean | null
  created_at: string
}

type Participant = {
  type: 'lawyer' | 'firm'
  id: number
  name: string
}

type Announcement = {
  id: number
  subject: string
  message: string
  created_at: string
}

type Identity = {
  type: 'lawyer' | 'firm'
  id: number
  name: string
}

type Conversation = {
  partner: Participant
  last: Message
  unread: number
}

function partnerKey(p: Participant) {
  return p.type + '-' + p.id
}

function dateKey(dateStr: string) {
  const d = new Date(dateStr)
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate()
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr)
  return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0')
}

function formatListTime(dateStr: string) {
  const d = new Date(dateStr)
  if (dateKey(dateStr) === dateKey(new Date().toISOString())) return formatTime(dateStr)
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (dateKey(dateStr) === dateKey(yesterday.toISOString())) return 'أمس'
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0')
}

function formatDayLabel(dateStr: string) {
  const d = new Date(dateStr)
  if (dateKey(dateStr) === dateKey(new Date().toISOString())) return 'اليوم'
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (dateKey(dateStr) === dateKey(yesterday.toISOString())) return 'أمس'
  return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear()
}

export default function LawyerMessagesPage() {
  const [loading, setLoading] = useState(true)
  const [myIdentity, setMyIdentity] = useState<Identity | null>(null)
  const [notAllowed, setNotAllowed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [pendingConsultations, setPendingConsultations] = useState(0)
  const [allLawyers, setAllLawyers] = useState<Participant[]>([])
  const [allFirms, setAllFirms] = useState<Participant[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [lastSeenAnnouncementAt, setLastSeenAnnouncementAt] = useState<string | null>(null)
  const [selectedPartner, setSelectedPartner] = useState<Participant | null>(null)
  const [viewingAnnouncements, setViewingAnnouncements] = useState(false)
  const [search, setSearch] = useState('')
  const [listFilter, setListFilter] = useState('all')
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')

  const menuRef = useRef<HTMLDivElement>(null)
  const threadScrollRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const lastMarkRef = useRef('')
  const supabase = createClient()
  const router = useRouter()

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

  async function loadMessages(identity: Identity) {
    const orFilter = identity.type === 'lawyer'
      ? 'sender_lawyer_id.eq.' + identity.id + ',recipient_lawyer_id.eq.' + identity.id
      : 'sender_firm_id.eq.' + identity.id + ',recipient_firm_id.eq.' + identity.id

    const result = await supabase
      .from('lawyer_messages')
      .select('*')
      .or(orFilter)
      .order('created_at', { ascending: true })

    setMessages(result.data || [])
  }

  async function loadAnnouncements() {
    const result = await supabase.from('announcements').select('*').order('created_at', { ascending: false })
    setAnnouncements(result.data || [])
  }

  useEffect(function () {
    async function loadData() {
      const userResult = await supabase.auth.getUser()

      if (!userResult.data.user) {
        setNotAllowed(true)
        setLoading(false)
        return
      }

      const lawyerResult = await supabase.from('lawyers').select('id, full_name, last_seen_announcement_at').eq('user_id', userResult.data.user.id).maybeSingle()

      let foundIdentity: Identity | null = null

      if (lawyerResult.data) {
        foundIdentity = { type: 'lawyer', id: lawyerResult.data.id, name: lawyerResult.data.full_name }
        setLastSeenAnnouncementAt(lawyerResult.data.last_seen_announcement_at)
      } else {
        const firmResult = await supabase.from('firms').select('id, firm_name, last_seen_announcement_at').eq('user_id', userResult.data.user.id).maybeSingle()
        if (firmResult.data) {
          foundIdentity = { type: 'firm', id: firmResult.data.id, name: firmResult.data.firm_name }
          setLastSeenAnnouncementAt(firmResult.data.last_seen_announcement_at)
        }
      }

      if (!foundIdentity) {
        setNotAllowed(true)
        setLoading(false)
        return
      }

      const me: Identity = foundIdentity
      setMyIdentity(me)

      const lawyersResult = await supabase.from('lawyers').select('id, full_name')
      const lawyerParticipants: Participant[] = (lawyersResult.data || [])
        .filter(function (l) { return !(me.type === 'lawyer' && l.id === me.id) })
        .map(function (l) { return { type: 'lawyer' as const, id: l.id, name: l.full_name } })
      setAllLawyers(lawyerParticipants)

      const firmsResult = await supabase.from('firms').select('id, firm_name')
      const firmParticipants: Participant[] = (firmsResult.data || [])
        .filter(function (f) { return !(me.type === 'firm' && f.id === me.id) })
        .map(function (f) { return { type: 'firm' as const, id: f.id, name: f.firm_name } })
      setAllFirms(firmParticipants)

      if (me.type === 'lawyer') {
        setPendingConsultations(await getLawyerBadgeCount(supabase, me.id))
      } else {
        setPendingConsultations(await getFirmBadgeCount(supabase, me.id))
      }

      await loadMessages(me)
      await loadAnnouncements()
      setLoading(false)
    }

    loadData()
  }, [])

  useEffect(function () {
    if (!myIdentity) return
    const identity = myIdentity
    const timer = setInterval(function () {
      if (document.hidden) return
      loadMessages(identity)
    }, 10000)
    return function () {
      clearInterval(timer)
    }
  }, [myIdentity])

  async function handleLogout() {
    await supabase.auth.signOut()
    setMenuOpen(false)
    router.push('/')
  }

  function toggleMenu() {
    setMenuOpen(!menuOpen)
  }

  async function openAnnouncements() {
    setViewingAnnouncements(true)
    setSelectedPartner(null)
    setSearch('')

    if (!myIdentity) return

    const nowStr = new Date().toISOString()
    const tableName = myIdentity.type === 'lawyer' ? 'lawyers' : 'firms'

    await supabase.from(tableName).update({ last_seen_announcement_at: nowStr }).eq('id', myIdentity.id)
    setLastSeenAnnouncementAt(nowStr)
  }

  function handleSelectPartner(partner: Participant) {
    setSelectedPartner(partner)
    setViewingAnnouncements(false)
    setSearch('')
    setSendError('')
  }

  function closeThread() {
    setSelectedPartner(null)
    setViewingAnnouncements(false)
  }

  async function markThreadRead(identity: Identity, partner: Participant) {
    const recipientColumn = identity.type === 'lawyer' ? 'recipient_lawyer_id' : 'recipient_firm_id'
    const senderColumn = partner.type === 'lawyer' ? 'sender_lawyer_id' : 'sender_firm_id'

    const updateResult = await supabase
      .from('lawyer_messages')
      .update({ is_read: true })
      .eq(recipientColumn, identity.id)
      .eq(senderColumn, partner.id)
      .eq('is_read', false)

    if (updateResult.error) {
      console.error('Failed to mark messages as read:', updateResult.error.message)
    }

    await loadMessages(identity)
  }

  async function handleSend() {
    if (!newMessage.trim() || !myIdentity || !selectedPartner) return
    setSending(true)
    setSendError('')

    const insertData: any = {
      body: newMessage.trim(),
      is_read: false,
      sender_lawyer_id: null,
      recipient_lawyer_id: null,
      sender_firm_id: null,
      recipient_firm_id: null,
    }

    if (myIdentity.type === 'lawyer') {
      insertData.sender_lawyer_id = myIdentity.id
    } else {
      insertData.sender_firm_id = myIdentity.id
    }

    if (selectedPartner.type === 'lawyer') {
      insertData.recipient_lawyer_id = selectedPartner.id
    } else {
      insertData.recipient_firm_id = selectedPartner.id
    }

    const insertResult = await supabase.from('lawyer_messages').insert(insertData)

    if (insertResult.error) {
      setSendError('تعذر إرسال الرسالة، حاول مرة أخرى')
      setSending(false)
      return
    }

    setNewMessage('')
    if (composerRef.current) {
      composerRef.current.style.height = 'auto'
    }
    await loadMessages(myIdentity)
    setSending(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function findParticipant(type: 'lawyer' | 'firm', id: number): Participant | null {
    const list = type === 'lawyer' ? allLawyers : allFirms
    const found = list.find(function (p) { return p.id === id })
    if (found) return found
    return { type: type, id: id, name: type === 'lawyer' ? 'محامي' : 'مكتب' }
  }

  function isMineMessage(m: Message) {
    if (!myIdentity) return false
    return (myIdentity.type === 'lawyer' && m.sender_lawyer_id === myIdentity.id) ||
      (myIdentity.type === 'firm' && m.sender_firm_id === myIdentity.id)
  }

  function isIncomingUnread(m: Message) {
    if (!myIdentity || m.is_read) return false
    return (myIdentity.type === 'lawyer' && m.recipient_lawyer_id === myIdentity.id) ||
      (myIdentity.type === 'firm' && m.recipient_firm_id === myIdentity.id)
  }

  function getOtherParty(m: Message): Participant | null {
    if (!myIdentity) return null

    if (isMineMessage(m)) {
      if (m.recipient_lawyer_id) return findParticipant('lawyer', m.recipient_lawyer_id)
      if (m.recipient_firm_id) return findParticipant('firm', m.recipient_firm_id)
    } else {
      if (m.sender_lawyer_id) return findParticipant('lawyer', m.sender_lawyer_id)
      if (m.sender_firm_id) return findParticipant('firm', m.sender_firm_id)
    }

    return null
  }

  function buildConversations() {
    const map: { [key: string]: Conversation } = {}

    messages.forEach(function (m) {
      const other = getOtherParty(m)
      if (!other) return
      const key = partnerKey(other)
      if (!map[key]) {
        map[key] = { partner: other, last: m, unread: 0 }
      }
      map[key].last = m
      if (isIncomingUnread(m)) {
        map[key].unread = map[key].unread + 1
      }
    })

    return Object.values(map).sort(function (a, b) {
      return new Date(b.last.created_at).getTime() - new Date(a.last.created_at).getTime()
    })
  }

  const conversations = buildConversations()
  const totalUnread = conversations.filter(function (c) { return c.unread > 0 }).length

  const unreadAnnouncements = announcements.filter(function (a) {
    return !lastSeenAnnouncementAt || new Date(a.created_at) > new Date(lastSeenAnnouncementAt)
  }).length

  const visibleConversations = conversations.filter(function (c) {
    return listFilter === 'unread' ? c.unread > 0 : true
  })

  const searchTerm = search.trim().toLowerCase()
  const searchResults = searchTerm
    ? allLawyers.concat(allFirms).filter(function (p) {
        return p.name.toLowerCase().indexOf(searchTerm) !== -1
      }).slice(0, 20)
    : []

  const threadMessages = messages.filter(function (m) {
    if (!selectedPartner || !myIdentity) return false
    const other = getOtherParty(m)
    return other !== null && other.type === selectedPartner.type && other.id === selectedPartner.id
  })

  const hasOpenThread = selectedPartner !== null || viewingAnnouncements
  const accountType: 'lawyer' | 'firm' = myIdentity ? myIdentity.type : 'lawyer'

  useEffect(function () {
    if (!myIdentity || !selectedPartner || viewingAnnouncements) return

    const current = conversations.find(function (c) {
      return c.partner.type === selectedPartner.type && c.partner.id === selectedPartner.id
    })
    const unread = current ? current.unread : 0

    if (unread === 0) {
      lastMarkRef.current = ''
      return
    }

    const attemptKey = partnerKey(selectedPartner) + ':' + unread
    if (lastMarkRef.current === attemptKey) return
    lastMarkRef.current = attemptKey

    markThreadRead(myIdentity, selectedPartner)
  }, [messages, selectedPartner, viewingAnnouncements, myIdentity])

  useEffect(function () {
    const el = threadScrollRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [selectedPartner, viewingAnnouncements, threadMessages.length, announcements.length])

  function renderAvatar(name: string, type: 'lawyer' | 'firm') {
    const colorClass = type === 'firm' ? 'bg-[#AD8A4E] text-white' : 'bg-[#1B1A17] text-[#F3EEE4]'
    return (
      <div className={"w-11 h-11 rounded-full flex items-center justify-center font-['Tajawal'] font-bold text-lg flex-shrink-0 " + colorClass}>
        {name.trim().charAt(0)}
      </div>
    )
  }

  function renderFirmTag(type: 'lawyer' | 'firm') {
    if (type !== 'firm') return null
    return <span className="font-['Tajawal'] text-[10px] px-1.5 py-0.5 rounded bg-[#F0E6D2] text-[#AD8A4E] flex-shrink-0">مكتب</span>
  }

  function renderConversationRow(c: Conversation) {
    const isSelected = selectedPartner !== null && selectedPartner.type === c.partner.type && selectedPartner.id === c.partner.id && !viewingAnnouncements
    const mine = isMineMessage(c.last)

    function clickRow() {
      handleSelectPartner(c.partner)
    }

    return (
      <button
        key={partnerKey(c.partner)}
        onClick={clickRow}
        className={"w-full text-right flex items-center gap-3 px-3 py-3 rounded-xl transition " + (isSelected ? 'bg-[#F3EEE4]' : 'hover:bg-[#F8F5EE]')}
      >
        {renderAvatar(c.partner.name, c.partner.type)}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-center gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-['Tajawal'] font-bold text-sm text-[#1B1A17] truncate">{c.partner.name}</span>
              {renderFirmTag(c.partner.type)}
            </div>
            <span className="font-['Tajawal'] text-[11px] text-[#4A473F] flex-shrink-0">{formatListTime(c.last.created_at)}</span>
          </div>
          <div className="flex justify-between items-center gap-2 mt-0.5">
            <span className={"font-['Tajawal'] text-xs truncate " + (c.unread > 0 ? 'text-[#1B1A17] font-medium' : 'text-[#4A473F]')}>{mine ? 'أنت: ' : ''}{c.last.body}</span>
            {c.unread > 0 && (
              <span className="bg-[#AD8A4E] text-white text-[11px] rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center flex-shrink-0">{c.unread}</span>
            )}
          </div>
        </div>
      </button>
    )
  }

  function renderSearchResult(p: Participant) {
    const existing = conversations.find(function (c) { return c.partner.type === p.type && c.partner.id === p.id })

    function clickRow() {
      handleSelectPartner(p)
    }

    return (
      <button key={partnerKey(p)} onClick={clickRow} className="w-full text-right flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-[#F8F5EE] transition">
        {renderAvatar(p.name, p.type)}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-['Tajawal'] font-bold text-sm text-[#1B1A17] truncate">{p.name}</span>
            {renderFirmTag(p.type)}
          </div>
          <p className="font-['Tajawal'] text-xs text-[#4A473F]">{existing ? 'محادثة قائمة' : 'بدء محادثة جديدة'}</p>
        </div>
      </button>
    )
  }

  function renderDaySeparator(key: string, label: string) {
    return (
      <div key={key} className="flex justify-center my-3">
        <span className="font-['Tajawal'] text-[11px] text-[#4A473F] bg-white border border-[#E7E1D3] rounded-full px-3 py-1">{label}</span>
      </div>
    )
  }

  function renderMessage(m: Message) {
    const isMine = isMineMessage(m)
    return (
      <div key={m.id} className={"flex mb-1.5 " + (isMine ? 'justify-start' : 'justify-end')}>
        <div className={"px-4 py-2 max-w-[75%] shadow-sm " + (isMine ? 'bg-[#1B1A17] text-[#F3EEE4] rounded-2xl rounded-br-sm' : 'bg-white text-[#1B1A17] border border-[#E7E1D3] rounded-2xl rounded-bl-sm')}>
          <p className="font-['Tajawal'] text-sm leading-relaxed whitespace-pre-wrap break-words">{m.body}</p>
          <div className="flex items-center gap-1 justify-end mt-0.5">
            <span className={"text-[10px] " + (isMine ? 'text-[#D8D2C4]' : 'text-[#4A473F]')}>{formatTime(m.created_at)}</span>
            {isMine && (
              <span className={"text-[10px] " + (m.is_read ? 'text-[#AD8A4E]' : 'text-[#D8D2C4]')}>{m.is_read ? '✓✓' : '✓'}</span>
            )}
          </div>
        </div>
      </div>
    )
  }

  function renderThreadMessages() {
    const nodes: React.ReactNode[] = []
    let lastKey = ''

    threadMessages.forEach(function (m) {
      const key = dateKey(m.created_at)
      if (key !== lastKey) {
        nodes.push(renderDaySeparator('sep-' + key, formatDayLabel(m.created_at)))
        lastKey = key
      }
      nodes.push(renderMessage(m))
    })

    return nodes
  }

  function renderAnnouncementsThread() {
    const nodes: React.ReactNode[] = []
    let lastKey = ''
    const ordered = announcements.slice().reverse()

    ordered.forEach(function (a) {
      const key = dateKey(a.created_at)
      if (key !== lastKey) {
        nodes.push(renderDaySeparator('asep-' + key, formatDayLabel(a.created_at)))
        lastKey = key
      }
      nodes.push(
        <div key={'a-' + a.id} className="flex justify-end mb-2">
          <div className="max-w-[85%] bg-white border border-[#AD8A4E] rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
            <p className="font-['Tajawal'] font-bold text-xs text-[#AD8A4E] mb-1">📢 {a.subject}</p>
            <p className="font-['Tajawal'] text-sm text-[#1B1A17] leading-relaxed whitespace-pre-wrap break-words">{a.message}</p>
            <p className="font-['Tajawal'] text-[10px] text-[#4A473F] mt-1 text-left">{formatTime(a.created_at)}</p>
          </div>
        </div>
      )
    })

    return nodes
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

  return (
    <div dir="rtl" className="min-h-screen pattern-bg flex flex-col">
      <div className="hm-header bg-[#1B1A17] text-[#F3EEE4] py-12 px-6">
        <HeaderLines />
        <div className="max-w-5xl mx-auto">
          <div className="flex justify-between items-center mb-8 font-['Tajawal'] text-sm">
            <a href="/"><img src="/logo.png" alt="حمورابي" className="h-12 w-auto" /></a>
            <div className="flex gap-5 items-center">
              {accountType === 'firm' && (
                <a href="/firm-dashboard" className="hover:text-[#AD8A4E] transition">لوحة التحكم</a>
              )}
              <a href="/lawyer-tools" className="hover:text-[#AD8A4E] transition">أدواتي</a>
              <a href="/ai-assistant" className="hover:text-[#AD8A4E] transition">مساعد ذكي</a>
              <a href="/community" className="hover:text-[#AD8A4E] transition">المجتمع</a>
              <a href="/lawyer-messages" className="relative text-[#AD8A4E]">
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
          <h1 className="font-['Tajawal'] font-bold text-4xl mb-2">الرسائل</h1>
          <div className="w-16 h-[2px] bg-[#AD8A4E]"></div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-6 -mt-6 mb-10 flex-1 w-full relative z-20">
        <div className="bg-white rounded-2xl shadow-xl border border-[#D8D2C4] overflow-hidden flex" style={{ height: 'min(72vh, 680px)', minHeight: '520px' }}>

          <div className={(hasOpenThread ? 'hidden md:flex' : 'flex') + ' flex-col w-full md:w-[360px] md:border-l border-[#E7E1D3] flex-shrink-0'}>
            <div className="p-4 pb-2">
              <div className="relative mb-3">
                <svg className="w-4 h-4 text-[#4A473F] absolute right-3 top-1/2 -translate-y-1/2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4.3-4.3" />
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={function (e) { setSearch(e.target.value) }}
                  placeholder="ابحث عن محامي أو مكتب..."
                  className="w-full pr-10 pl-3 py-2.5 bg-[#F3EEE4] border border-transparent focus:border-[#AD8A4E] focus:outline-none rounded-xl font-['Tajawal'] text-sm text-[#1B1A17]"
                />
              </div>

              {!searchTerm && (
                <div className="flex gap-2">
                  <button
                    onClick={function () { setListFilter('all') }}
                    className={"px-4 py-1.5 rounded-full font-['Tajawal'] text-xs transition " + (listFilter === 'all' ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'bg-[#F3EEE4] text-[#4A473F]')}
                  >
                    الكل
                  </button>
                  <button
                    onClick={function () { setListFilter('unread') }}
                    className={"px-4 py-1.5 rounded-full font-['Tajawal'] text-xs transition " + (listFilter === 'unread' ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'bg-[#F3EEE4] text-[#4A473F]')}
                  >
                    غير المقروءة{totalUnread > 0 ? ' (' + totalUnread + ')' : ''}
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-3">
              {searchTerm && (
                <div>
                  <p className="font-['Tajawal'] text-xs text-[#4A473F] px-3 py-2">نتائج البحث</p>
                  {searchResults.length === 0 && (
                    <p className="font-['Tajawal'] text-sm text-[#4A473F] text-center py-6">لا توجد نتائج</p>
                  )}
                  {searchResults.map(renderSearchResult)}
                </div>
              )}

              {!searchTerm && (
                <div>
                  {(listFilter === 'all' || unreadAnnouncements > 0) && (
                    <button
                      onClick={openAnnouncements}
                      className={"w-full text-right flex items-center gap-3 px-3 py-3 rounded-xl transition mb-1 border " + (viewingAnnouncements ? 'bg-[#F3EEE4] border-[#AD8A4E]' : 'border-[#F0E6D2] bg-[#FBF8F1] hover:bg-[#F8F5EE]')}
                    >
                      <div className="w-11 h-11 rounded-full bg-[#F0E6D2] flex items-center justify-center text-xl flex-shrink-0">📢</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-['Tajawal'] font-bold text-sm text-[#1B1A17]">حمورابي</span>
                            <span className="font-['Tajawal'] text-[10px] px-1.5 py-0.5 rounded bg-[#1B1A17] text-[#F3EEE4]">رسمي</span>
                          </div>
                          {announcements.length > 0 && (
                            <span className="font-['Tajawal'] text-[11px] text-[#4A473F] flex-shrink-0">{formatListTime(announcements[0].created_at)}</span>
                          )}
                        </div>
                        <div className="flex justify-between items-center gap-2 mt-0.5">
                          <span className="font-['Tajawal'] text-xs text-[#4A473F] truncate">{announcements.length > 0 ? announcements[0].subject : 'إعلانات وتحديثات المنصة'}</span>
                          {unreadAnnouncements > 0 && (
                            <span className="bg-[#AD8A4E] text-white text-[11px] rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center flex-shrink-0">{unreadAnnouncements}</span>
                          )}
                        </div>
                      </div>
                    </button>
                  )}

                  {visibleConversations.map(renderConversationRow)}

                  {conversations.length === 0 && (
                    <div className="text-center px-6 py-10">
                      <p className="font-['Tajawal'] font-bold text-sm text-[#1B1A17] mb-1">لا توجد محادثات بعد</p>
                      <p className="font-['Tajawal'] text-xs text-[#4A473F] leading-relaxed">ابحث عن محامي أو مكتب من الأعلى لتبدأ أول محادثة.</p>
                    </div>
                  )}

                  {conversations.length > 0 && visibleConversations.length === 0 && (
                    <p className="font-['Tajawal'] text-sm text-[#4A473F] text-center py-8">لا توجد رسائل غير مقروءة</p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className={(hasOpenThread ? 'flex' : 'hidden md:flex') + ' flex-1 flex-col min-w-0 bg-[#FAF7F0]'}>
            {!hasOpenThread && (
              <div className="m-auto text-center px-6">
                <div className="w-20 h-20 rounded-full bg-white border border-[#E7E1D3] flex items-center justify-center mx-auto mb-4">
                  <svg className="w-9 h-9 text-[#AD8A4E]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                  </svg>
                </div>
                <p className="font-['Tajawal'] font-bold text-[#1B1A17] mb-1">مراسلاتك المهنية في مكان واحد</p>
                <p className="font-['Tajawal'] text-sm text-[#4A473F]">اختر محادثة من القائمة أو ابحث عن محامي أو مكتب لتبدأ.</p>
              </div>
            )}

            {viewingAnnouncements && (
              <div className="flex flex-col h-full">
                <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-[#E7E1D3]">
                  <button onClick={closeThread} className="md:hidden text-[#1B1A17] text-xl leading-none px-1">›</button>
                  <div className="w-11 h-11 rounded-full bg-[#F0E6D2] flex items-center justify-center text-xl flex-shrink-0">📢</div>
                  <div>
                    <p className="font-['Tajawal'] font-bold text-sm text-[#1B1A17]">حمورابي</p>
                    <p className="font-['Tajawal'] text-xs text-[#4A473F]">إعلانات وتحديثات المنصة</p>
                  </div>
                </div>
                <div ref={threadScrollRef} className="flex-1 overflow-y-auto px-5 py-4">
                  {announcements.length === 0 && (
                    <p className="font-['Tajawal'] text-sm text-[#4A473F] text-center py-10">لا توجد إعلانات بعد</p>
                  )}
                  {renderAnnouncementsThread()}
                </div>
                <div className="px-4 py-3 bg-white border-t border-[#E7E1D3] text-center">
                  <p className="font-['Tajawal'] text-xs text-[#4A473F]">هذه القناة للقراءة فقط</p>
                </div>
              </div>
            )}

            {selectedPartner && !viewingAnnouncements && (
              <div className="flex flex-col h-full">
                <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-[#E7E1D3]">
                  <button onClick={closeThread} className="md:hidden text-[#1B1A17] text-xl leading-none px-1">›</button>
                  {renderAvatar(selectedPartner.name, selectedPartner.type)}
                  <div className="min-w-0">
                    <p className="font-['Tajawal'] font-bold text-sm text-[#1B1A17] truncate">{selectedPartner.name}</p>
                    <p className="font-['Tajawal'] text-xs text-[#4A473F]">{selectedPartner.type === 'firm' ? 'مكتب محاماة' : 'محامي'}</p>
                  </div>
                </div>

                <div ref={threadScrollRef} className="flex-1 overflow-y-auto px-5 py-4">
                  {threadMessages.length === 0 && (
                    <div className="text-center py-12">
                      <p className="font-['Tajawal'] font-bold text-sm text-[#1B1A17] mb-1">ابدأ المحادثة مع {selectedPartner.name}</p>
                      <p className="font-['Tajawal'] text-xs text-[#4A473F]">اكتب رسالتك الأولى في الأسفل.</p>
                    </div>
                  )}
                  {renderThreadMessages()}
                </div>

                <div className="bg-white border-t border-[#E7E1D3] px-4 py-3">
                  {sendError && <p className="font-['Tajawal'] text-xs text-[#7A2E2E] mb-2">{sendError}</p>}
                  <div className="flex items-end gap-2">
                    <textarea
                      ref={composerRef}
                      rows={1}
                      value={newMessage}
                      onChange={function (e) {
                        setNewMessage(e.target.value)
                        e.target.style.height = 'auto'
                        e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                      }}
                      onKeyDown={handleKeyDown}
                      placeholder="اكتب رسالتك..."
                      className="flex-1 resize-none px-4 py-2.5 bg-[#F3EEE4] border border-transparent focus:border-[#AD8A4E] focus:outline-none rounded-2xl font-['Tajawal'] text-sm text-[#1B1A17]"
                      style={{ maxHeight: 120 }}
                    />
                    <button
                      onClick={handleSend}
                      disabled={sending || !newMessage.trim()}
                      className="w-11 h-11 rounded-full bg-[#1B1A17] text-[#F3EEE4] hover:bg-[#AD8A4E] transition flex items-center justify-center flex-shrink-0 disabled:opacity-40"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: 'scaleX(-1)' }}>
                        <path d="M22 2L11 13" />
                        <path d="M22 2L15 22l-4-9-9-4 20-7z" />
                      </svg>
                    </button>
                  </div>
                  <p className="font-['Tajawal'] text-[10px] text-[#4A473F] mt-1.5">Enter للإرسال، Shift + Enter لسطر جديد</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer variant={accountType === 'firm' ? 'firm' : 'lawyer'} />
    </div>
  )
}