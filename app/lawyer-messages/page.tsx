'use client'

import { useEffect, useState } from 'react'
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

export default function LawyerMessagesPage() {
  const [loading, setLoading] = useState(true)
  const [myLawyerId, setMyLawyerId] = useState<number | null>(null)
  const [notAllowed, setNotAllowed] = useState(false)
  const [allLawyers, setAllLawyers] = useState<LawyerOption[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [selectedPartner, setSelectedPartner] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)

  const supabase = createClient()

  async function loadMessages(id: number) {
    const result = await supabase
      .from('lawyer_messages')
      .select('*')
      .or('sender_lawyer_id.eq.' + id + ',recipient_lawyer_id.eq.' + id)
      .order('created_at', { ascending: true })
    setMessages(result.data || [])
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
      setLoading(false)
    }

    loadData()
  }, [])

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
    return Array.from(partnerIds)
  }

  function getLawyerName(id: number) {
    const found = allLawyers.find(function (l) { return l.id === id })
    return found ? found.full_name : ''
  }

  const conversationPartners = getConversationPartners()

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
    const isSelected = selectedPartner === partnerId
    function clickRow() {
      setSelectedPartner(partnerId)
      setSearch('')
    }
    return (
      <button
        key={partnerId}
        onClick={clickRow}
        className={"w-full text-right px-4 py-3 rounded-md font-['Tajawal'] text-sm transition mb-1 " + (isSelected ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'bg-[#F3EEE4] text-[#1B1A17]')}
      >
        {getLawyerName(partnerId)}
      </button>
    )
  }

  function renderSearchResult(lawyer: LawyerOption) {
    function clickRow() {
      setSelectedPartner(lawyer.id)
      setSearch('')
    }
    return (
      <button key={lawyer.id} onClick={clickRow} className="w-full text-right px-4 py-3 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17] mb-1">
        {lawyer.full_name}
      </button>
    )
  }

  function renderMessage(m: Message) {
    const isMine = m.sender_lawyer_id === myLawyerId
    return (
      <div key={m.id} className={"mb-2 flex " + (isMine ? 'justify-start' : 'justify-end')}>
        <div className={"px-4 py-2 rounded-lg max-w-xs font-['Tajawal'] text-sm " + (isMine ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'bg-[#F3EEE4] text-[#1B1A17]')}>
          {m.body}
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
          <h1 className="font-['Amiri'] text-4xl mb-2">الرسائل</h1>
          <div className="w-16 h-[2px] bg-[#AD8A4E]"></div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <input
            type="text"
            value={search}
            onChange={function (e) { setSearch(e.target.value) }}
            placeholder="ابحث عن محامٍ لبدء محادثة..."
            className="w-full px-3 py-2 mb-3 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
          />

          {search.trim() && searchResults.map(renderSearchResult)}

          {!search.trim() && (
            <div>
              <p className="font-['Tajawal'] text-xs text-[#4A473F] mb-2">المحادثات</p>
              {conversationPartners.length === 0 && (
                <p className="font-['Tajawal'] text-xs text-[#4A473F]">لا توجد محادثات بعد</p>
              )}
              {conversationPartners.map(renderPartnerRow)}
            </div>
          )}
        </div>

        <div className="md:col-span-2 bg-white border border-[#D8D2C4] rounded-lg p-5 flex flex-col" style={{ minHeight: '400px' }}>
          {!selectedPartner && (
            <p className="font-['Tajawal'] text-center text-[#4A473F] m-auto">اختر محادثة أو ابحث عن محامٍ</p>
          )}

          {selectedPartner && (
            <div className="flex flex-col h-full">
              <p className="font-['Tajawal'] font-bold text-[#1B1A17] mb-4 pb-3 border-b border-[#D8D2C4]">{getLawyerName(selectedPartner)}</p>
              <div className="flex-1 overflow-y-auto mb-4">
                {threadMessages.map(renderMessage)}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={function (e) { setNewMessage(e.target.value) }}
                  placeholder="اكتب رسالتك..."
                  className="flex-1 px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
                />
                <button
                  onClick={handleSend}
                  disabled={sending}
                  className="px-5 py-2 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal'] text-sm hover:bg-[#AD8A4E] transition disabled:opacity-60"
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