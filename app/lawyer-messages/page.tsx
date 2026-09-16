'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '../lib/supabase'

type Message = {
  id: number
  sender_lawyer_id: number
  recipient_lawyer_id: number
  body: string
  is_read: boolean | null
  created_at: string
}

type LawyerOption = {
  id: number
  full_name: string
}

type Announcement = {
  id: number
  subject: string
  message: string
  created_at: string
}

export default function LawyerMessagesPage() {
  const [loading, setLoading] = useState(true)
  const [myLawyerId, setMyLawyerId] = useState<number | null>(null)
  const [notAllowed, setNotAllowed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [allLawyers, setAllLawyers] = useState<LawyerOption[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [selectedPartner, setSelectedPartner] = useState<number | null>(null)
  const [viewingAnnouncements, setViewingAnnouncements] = useState(false)
  const [search, setSearch] = useState('')
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)

  const threadEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  async function loadMessages(id: number) {
    const result = await supabase
      .from('lawyer_messages')
      .select('*')
      .or('sender_lawyer_id.eq.' + id + ',recipient_lawyer_id.eq.' + id)
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

      const lawyerResult = await supabase.from('lawyers').select('id').eq('user_id', userResult.data.user.id).maybeSingle()

      if (!lawyerResult.data) {
        setNotAllowed(true)
        setLoading(false)
        return
      }

      setMyLawyerId(lawyerResult.data.id)

      const lawyersResult = await supabase.from('lawyers').select('id, full_name').neq('id', lawyerResult.data.id)
      setAllLawyers(lawyersResult.data || [])

      await loadMessages(lawyerResult.data.id)
      await loadAnnouncements()
      setLoading(false)
    }

    loadData()
  }, [])

  useEffect(function () {
    if (threadEndRef.current) {
      threadEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [selectedPartner, viewingAnnouncements, messages])

  async function handleLogout() {
    await supabase.auth.signOut()
    setMenuOpen(false)
  }

  function toggleMenu() {
    setMenuOpen(!menuOpen)
  }

  function openAnnouncements() {
    setViewingAnnouncements(true)
    setSelectedPartner(null)
    setSearch('')
  }

  async function handleSelectPartner(partnerId: number) {
    setSelectedPartner(partnerId)
    setViewingAnnouncements(false)
    setSearch('')

    if (myLawyerId) {
      await supabase
        .from('lawyer_messages')
        .update({ is_read: true })
        .eq('sender_lawyer_id', partnerId)
        .eq('recipient_lawyer_id', myLawyerId)
        .eq('is_read', false)

      await loadMessages(myLawyerId)
    }
  }

  async function handleSend() {
    if (!newMessage.trim() || !myLawyerId || !selectedPartner) return
    setSending(true)

    await supabase.from('lawyer_messages').insert({
      sender_lawyer_id: myLawyerId,
      recipient_lawyer_id: selectedPartner,
      body: newMessage,
      is_read: false,
    })

    setNewMessage('')
    await loadMessages(myLawyerId)
    setSending(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function getConversationPartners() {
    if (!myLawyerId) return []
    const partnerIds = new Set<number>()
    for (let i = 0; i < messages.length; i++) {
      if (messages[i].sender_lawyer_id === myLawyerId) {
        partnerIds.add(messages[i].recipient_lawyer_id)
      } else {
        partnerIds.add(messages[i].sender_lawyer_id)
      }
    }
    return Array.from(partnerIds).sort(function (a, b) {
      const lastA = getLastMessage(a)
      const lastB = getLastMessage(b)
      const timeA = lastA ? new Date(lastA.created_at).getTime() : 0
      const timeB = lastB ? new Date(lastB.created_at).getTime() : 0
      return timeB - timeA
    })
  }

  function getLawyerName(id: number) {
    const found = allLawyers.find(function (l) { return l.id === id })
    return found ? found.full_name : ''
  }

  function getLastMessage(partnerId: number) {
    const relevant = messages.filter(function (m) {
      return (m.sender_lawyer_id === partnerId && m.recipient_lawyer_id === myLawyerId) ||
        (m.sender_lawyer_id === myLawyerId && m.recipient_lawyer_id === partnerId)
    })
    return relevant.length > 0 ? relevant[relevant.length - 1] : null
  }

  function getUnreadCount(partnerId: number) {
    return messages.filter(function (m) {
      return m.sender_lawyer_id === partnerId && m.recipient_lawyer_id === myLawyerId && !m.is_read
    }).length
  }

  function getTotalUnread() {
    if (!myLawyerId) return 0
    return messages.filter(function (m) { return m.recipient_lawyer_id === myLawyerId && !m.is_read }).length
  }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr)
    return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0')
  }

  const conversationPartners = getConversationPartners()
  const totalUnread = getTotalUnread()

  const searchResults = allLawyers.filter(function (l) {
    if (!search.trim()) return false
    return l.full_name.toLowerCase().indexOf(search.toLowerCase()) !== -1
  })

  const threadMessages = messages.filter(function (m) {
    if (!selectedPartner || !myLawyerId) return false
    return (m.sender_lawyer_id === myLawyerId && m.recipient_lawyer_id === selectedPartner) ||
      (m.sender_lawyer_id === selectedPartner && m.recipient_lawyer_id === myLawyerId)
  })

  function renderPartnerRow(partnerId: number) {
    const isSelected = selectedPartner === partnerId && !viewingAnnouncements
    const lastMsg = getLastMessage(partnerId)
    const unreadCount = getUnreadCount(partnerId)

    function clickRow() {
      handleSelectPartner(partnerId)
    }

    return (
      <button
        key={partnerId}
        onClick={clickRow}
        className={"w-full text-right px-4 py-3 rounded-md font-['Tajawal'] transition mb-1 " + (isSelected ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'bg-[#F3EEE4] text-[#1B1A17] hover:bg-[#D8D2C4]')}
      >
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">{getLawyerName(partnerId)}</span>
          {unreadCount > 0 && (
            <span className="bg-[#AD8A4E] text-white text-xs rounded-full px-2 py-0.5 min-w-[20px] text-center">{unreadCount}</span>
          )}
        </div>
        {lastMsg && (
          <p className={"text-xs mt-0.5 truncate " + (isSelected ? 'text-[#D8D2C4]' : 'text-[#4A473F]')}>{lastMsg.body}</p>
        )}
      </button>
    )
  }

  function renderSearchResult(lawyer: LawyerOption) {
    function clickRow() {
      handleSelectPartner(lawyer.id)
    }
    return (
      <button key={lawyer.id} onClick={clickRow} className="w-full text-right px-4 py-3 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17] mb-1 hover:border-[#AD8A4E] transition">
        {lawyer.full_name}
      </button>
    )
  }

  function renderMessage(m: Message) {
    const isMine = m.sender_lawyer_id === myLawyerId
    return (
      <div key={m.id} className={"mb-2 flex " + (isMine ? 'justify-start' : 'justify-end')}>
        <div className={"px-4 py-2 rounded-lg max-w-xs font-['Tajawal'] text-sm " + (isMine ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'bg-[#F3EEE4] text-[#1B1A17]')}>
          <p>{m.body}</p>
          <p className={"text-[10px] mt-1 " + (isMine ? 'text-[#D8D2C4]' : 'text-[#4A473F]')}>{formatTime(m.created_at)}</p>
        </div>
      </div>
    )
  }

  function renderAnnouncement(a: Announcement) {
    return (
      <div key={a.id} className="mb-2 flex justify-end">
        <div className="px-4 py-3 rounded-lg max-w-sm font-['Tajawal'] text-sm bg-[#F0E6D2] text-[#1B1A17] border border-[#AD8A4E]">
          <p className="font-bold text-xs text-[#AD8A4E] mb-1">📢 {a.subject}</p>
          <p className="whitespace-pre-wrap">{a.message}</p>
          <p className="text-[10px] mt-1 text-[#4A473F]">{formatTime(a.created_at)}</p>
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
              <a href="/lawyer-messages" className="relative hover:text-[#AD8A4E] transition">
                <svg className="w-5 h-5 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
                {totalUnread > 0 && (
                  <span className="absolute -top-2 -left-2 bg-[#AD8A4E] text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{totalUnread}</span>
                )}
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
          <h1 className="font-['Tajawal'] font-bold text-4xl mb-2">الرسائل</h1>
          <div className="w-16 h-[2px] bg-[#AD8A4E]"></div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <input
            type="text"
            value={search}
            onChange={function (e) { setSearch(e.target.value) }}
            placeholder="ابحث لبدء محادثة جديدة..."
            className="w-full px-3 py-2.5 mb-3 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
          />

          {search.trim() && searchResults.length === 0 && (
            <p className="font-['Tajawal'] text-xs text-[#4A473F]">لا توجد نتائج</p>
          )}
          {search.trim() && searchResults.map(renderSearchResult)}

          {!search.trim() && (
            <div>
              <button
                onClick={openAnnouncements}
                className={"w-full text-right px-4 py-3 rounded-md font-['Tajawal'] transition mb-2 border-2 " + (viewingAnnouncements ? 'bg-[#1B1A17] text-[#F3EEE4] border-[#AD8A4E]' : 'bg-white text-[#1B1A17] border-[#AD8A4E]')}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">📢</span>
                  <span className="text-sm font-bold">حمورابي</span>
                  {announcements.length > 0 && (
                    <span className="bg-[#AD8A4E] text-white text-xs rounded-full px-2 py-0.5 mr-auto">{announcements.length}</span>
                  )}
                </div>
                <p className={"text-xs mt-0.5 " + (viewingAnnouncements ? 'text-[#D8D2C4]' : 'text-[#4A473F]')}>إعلانات وتحديثات المنصة</p>
              </button>

              {conversationPartners.length === 0 && (
                <p className="font-['Tajawal'] text-xs text-[#4A473F]">لا توجد محادثات أخرى بعد</p>
              )}
              {conversationPartners.map(renderPartnerRow)}
            </div>
          )}
        </div>

        <div className="md:col-span-2 bg-white border border-[#D8D2C4] rounded-lg p-5 flex flex-col" style={{ minHeight: '450px', maxHeight: '450px' }}>
          {!selectedPartner && !viewingAnnouncements && (
            <p className="font-['Tajawal'] text-center text-[#4A473F] m-auto">اختر محادثة أو ابحث عن محامٍ</p>
          )}

          {viewingAnnouncements && (
            <div className="flex flex-col h-full">
              <p className="font-['Tajawal'] font-bold text-[#1B1A17] mb-4 pb-3 border-b border-[#D8D2C4]">📢 حمورابي</p>
              <div className="flex-1 overflow-y-auto mb-4">
                {announcements.length === 0 && <p className="font-['Tajawal'] text-sm text-[#4A473F] text-center">لا توجد إعلانات بعد</p>}
                {announcements.map(renderAnnouncement)}
                <div ref={threadEndRef} />
              </div>
            </div>
          )}

          {selectedPartner && !viewingAnnouncements && (
            <div className="flex flex-col h-full">
              <p className="font-['Tajawal'] font-bold text-[#1B1A17] mb-4 pb-3 border-b border-[#D8D2C4]">{getLawyerName(selectedPartner)}</p>
              <div className="flex-1 overflow-y-auto mb-4">
                {threadMessages.map(renderMessage)}
                <div ref={threadEndRef} />
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={function (e) { setNewMessage(e.target.value) }}
                  onKeyDown={handleKeyDown}
                  placeholder="اكتب رسالتك..."
                  className="flex-1 px-3 py-2.5 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
                />
                <button
                  onClick={handleSend}
                  disabled={sending}
                  className="px-5 py-2.5 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal'] text-sm hover:bg-[#AD8A4E] transition disabled:opacity-60"
                >
                  إرسال
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}