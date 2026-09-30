'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase'

type Props = {
  // 'banner': a thin strip at the top of a tool page
  // 'card': the full switch on the tools page (أدواتي)
  variant?: 'banner' | 'card'
}

function todayString() {
  const now = new Date()
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0')
}

function formatDateDisplay(dateStr: string) {
  const parts = dateStr.split('T')[0].split('-')
  if (parts.length !== 3) return dateStr
  return parts[2] + '/' + parts[1] + '/' + parts[0]
}

// The private sub-account switch for lawyers.
// In "private work" the lawyer's cases, wakalahs, invoices, expenses and
// calendar are a separate space that the firm never sees. The database
// decides what each space shows; this only flips the switch.
export default function WorkspaceSwitch(props: Props) {
  const supabase = createClient()
  const [loaded, setLoaded] = useState(false)
  const [lawyerId, setLawyerId] = useState<number | null>(null)
  const [inFirm, setInFirm] = useState(false)
  const [privateMode, setPrivateMode] = useState(false)
  const [activeUntil, setActiveUntil] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(function () {
    async function load() {
      const userResult = await supabase.auth.getUser()
      if (!userResult.data.user) {
        setLoaded(true)
        return
      }

      const lawyerResult = await supabase
        .from('lawyers')
        .select('id, firm_id, private_mode, subaccount_until')
        .eq('user_id', userResult.data.user.id)
        .maybeSingle()

      if (lawyerResult.data) {
        const until = lawyerResult.data.subaccount_until || ''
        const active = !!until && until >= todayString()
        setLawyerId(lawyerResult.data.id)
        setInFirm(!!lawyerResult.data.firm_id)
        setActiveUntil(active ? until : '')
        setPrivateMode(active && lawyerResult.data.private_mode === true)
      }

      setLoaded(true)
    }

    load()
  }, [])

  async function switchTo(value: boolean) {
    if (!lawyerId) return
    setSaving(true)
    await supabase.from('lawyers').update({ private_mode: value }).eq('id', lawyerId)
    window.location.reload()
  }

  if (!loaded || !lawyerId) return null

  const variant = props.variant || 'banner'

  if (variant === 'banner') {
    if (!activeUntil) return null

    if (privateMode) {
      return (
        <div className="bg-[#1B1A17] text-[#F3EEE4] rounded-lg px-4 py-3 mb-6 flex flex-wrap items-center justify-between gap-2">
          <p className="font-['Tajawal'] text-sm">🔒 أنت في <strong>حسابك الخاص</strong> — هذه المساحة لا يراها المكتب</p>
          <button onClick={function () { switchTo(false) }} disabled={saving} className="px-3 py-1.5 bg-[#AD8A4E] text-white rounded-md font-['Tajawal'] text-xs disabled:opacity-60">
            العودة لعمل المكتب
          </button>
        </div>
      )
    }

    return (
      <div className="bg-white border border-[#D8D2C4] rounded-lg px-4 py-3 mb-6 flex flex-wrap items-center justify-between gap-2">
        <p className="font-['Tajawal'] text-sm text-[#4A473F]">أنت في مساحة <strong>عمل المكتب</strong></p>
        <button onClick={function () { switchTo(true) }} disabled={saving} className="px-3 py-1.5 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal'] text-xs disabled:opacity-60">
          التبديل إلى حسابي الخاص 🔒
        </button>
      </div>
    )
  }

  if (activeUntil) {
    return (
      <div className="bg-white border border-[#D8D2C4] rounded-lg p-5 mb-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-1 h-5 bg-[#AD8A4E] rounded"></span>
          <h2 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17]">مساحة العمل</h2>
        </div>
        <div className="flex bg-[#F3EEE4] border border-[#D8D2C4] rounded-md p-1 w-fit mb-3">
          <button onClick={function () { if (privateMode) switchTo(false) }} disabled={saving} className={"px-5 py-2 rounded font-['Tajawal'] text-sm font-medium transition " + (!privateMode ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'text-[#4A473F]')}>
            عمل المكتب
          </button>
          <button onClick={function () { if (!privateMode) switchTo(true) }} disabled={saving} className={"px-5 py-2 rounded font-['Tajawal'] text-sm font-medium transition " + (privateMode ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'text-[#4A473F]')}>
            حسابي الخاص 🔒
          </button>
        </div>
        <p className="font-['Tajawal'] text-xs text-[#4A473F]">
          في حسابك الخاص تكون القضايا والوكالات والفواتير والمصاريف والأجندة مساحة منفصلة لا يراها المكتب. الحساب الخاص فعّال حتى {formatDateDisplay(activeUntil)}.
        </p>
      </div>
    )
  }

  if (!inFirm) return null

  return (
    <a href="/subscription#private" className="block bg-white border border-[#D8D2C4] rounded-lg p-5 mb-8 hover:border-[#AD8A4E] transition">
      <p className="font-['Tajawal'] font-bold text-[#1B1A17] mb-1">🔒 الحساب الخاص</p>
      <p className="font-['Tajawal'] text-sm text-[#4A473F]">
        مساحة منفصلة لقضاياك وموكليك الخاصين لا يراها المكتب، بنصف سعر الاشتراك. اعرف المزيد ←
      </p>
    </a>
  )
}
