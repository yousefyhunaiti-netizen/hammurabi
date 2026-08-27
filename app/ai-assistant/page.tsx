'use client'

import { useState } from 'react'

type Message = {
  role: string
  text: string
}

export default function AiAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: 'مرحباً! أنا مساعد حمورابي الذكي. أخبرني بمشكلتك القانونية بإيجاز وسأساعدك في العثور على التخصص أو المحامي المناسب.' },
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)

  async function handleSend() {
    if (!input.trim()) return

    const newMessages = messages.concat([{ role: 'user', text: input }])
    setMessages(newMessages)
    setInput('')
    setSending(true)

    const historyForApi = messages.map(function (m) {
      return { role: m.role, text: m.text }
    })

    const response = await fetch('/api/chatbot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: input, history: historyForApi }),
    })

    const data = await response.json()

    setMessages(newMessages.concat([{ role: 'model', text: data.reply }]))
    setSending(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      handleSend()
    }
  }

  function renderMessage(m: Message, index: number) {
    const isUser = m.role === 'user'
    const hasRecommendation = m.text.indexOf('التخصص المقترح:') !== -1

    return (
      <div key={index} className={"mb-3 flex " + (isUser ? 'justify-start' : 'justify-end')}>
        <div className={"px-4 py-3 rounded-lg max-w-sm font-['Tajawal'] text-sm " + (isUser ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'bg-white border border-[#D8D2C4] text-[#1B1A17]')}>
          <p className="whitespace-pre-wrap">{m.text}</p>
          {hasRecommendation && !isUser && (
            <a href="/lawyers" className="inline-block mt-2 px-3 py-2 bg-[#AD8A4E] text-white rounded-md text-xs">
              تصفح دليل المحامين
            </a>
          )}
        </div>
      </div>
    )
  }

  return (
    <div dir="rtl" className="min-h-screen pattern-bg flex flex-col">
      <div className="bg-[#1B1A17] text-[#F3EEE4] py-8 px-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="font-['Amiri'] text-3xl mb-1">مساعد حمورابي الذكي</h1>
          <p className="font-['Tajawal'] text-sm text-[#D8D2C4]">اسأل عن مشكلتك القانونية وسنوجهك للمحامي المناسب</p>
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-6 py-6 flex flex-col">
        <div className="flex-1 mb-4">
          {messages.map(renderMessage)}
          {sending && (
            <div className="flex justify-end mb-3">
              <div className="px-4 py-3 rounded-lg bg-white border border-[#D8D2C4] font-['Tajawal'] text-sm text-[#4A473F]">
                يكتب...
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={function (e) { setInput(e.target.value) }}
            onKeyDown={handleKeyDown}
            placeholder="اكتب رسالتك هنا..."
            className="flex-1 px-4 py-3 bg-white border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
          />
          <button
            onClick={handleSend}
            disabled={sending}
            className="px-6 py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal'] text-sm hover:bg-[#AD8A4E] transition disabled:opacity-60"
          >
            إرسال
          </button>
        </div>
      </div>
    </div>
  )
}