'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase'

type Props = {
  // 'banner': a thin strip at the top of a tool page
  // 'card': the switch on the tools page (أدواتي)
  variant?: 'banner' | 'card'
}

function todayString() {
  const now = new Date()
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0')
}

// Tells every switch and every tool page on screen that the workspace changed,
// so they refresh in place instead of reloading the whole page.
export const WORKSPACE_EVENT = 'hm:workspace'

// The sliding switch between the firm's work and the lawyer's private work.
function SlidingSwitch(props: { privateMode: boolean; busy: boolean; onChange: (value: boolean) => void; small?: boolean; onDark?: boolean }) {
  const className = 'hm-switch' + (props.small ? ' small' : '') + (props.onDark ? ' on-dark' : '')
  return (
    <div className={className} role="radiogroup" aria-label="مساحة العمل">
      <span className="hm-switch-thumb" style={{ insetInlineStart: props.privateMode ? '50%' : '4px' }} aria-hidden="true"></span>
      <button type="button" role="radio" aria-checked={!props.privateMode} disabled={props.busy} className={!props.privateMode ? 'on' : ''} onClick={function () { if (props.privateMode) props.onChange(false) }}>
        عمل المكتب
      </button>
      <button type="button" role="radio" aria-checked={props.privateMode} disabled={props.busy} className={props.privateMode ? 'on' : ''} onClick={function () { if (!props.privateMode) props.onChange(true) }}>
        حسابي الخاص 🔒
      </button>
    </div>
  )
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

    // another switch on the page flipped: follow it
    function onChange(e: Event) {
      const detail = (e as CustomEvent).detail
      if (detail && typeof detail.privateMode === 'boolean') setPrivateMode(detail.privateMode)
    }
    window.addEventListener(WORKSPACE_EVENT, onChange)
    return function () {
      window.removeEventListener(WORKSPACE_EVENT, onChange)
    }
  }, [])

  async function switchTo(value: boolean) {
    if (!lawyerId || saving) return
    const previous = privateMode
    setSaving(true)
    setPrivateMode(value)

    const result = await supabase.from('lawyers').update({ private_mode: value }).eq('id', lawyerId).select('private_mode')
    setSaving(false)

    if (result.error || !result.data || result.data.length === 0 || result.data[0].private_mode !== value) {
      setPrivateMode(previous)
      return
    }

    window.dispatchEvent(new CustomEvent(WORKSPACE_EVENT, { detail: { privateMode: value } }))
  }

  if (!loaded || !lawyerId) return null

  const variant = props.variant || 'banner'

  if (variant === 'banner') {
    if (!activeUntil) return null

    return (
      <div className={"rounded-lg px-4 py-3 mb-6 flex flex-wrap items-center gap-3 transition-colors duration-300 " + (privateMode ? 'bg-[#1B1A17] text-[#F3EEE4] justify-between' : 'bg-transparent justify-end px-0 py-0')}>
        {privateMode && <p className="font-['Tajawal'] text-sm font-bold">🔒 أنت في حسابك الخاص</p>}
        <SlidingSwitch privateMode={privateMode} busy={saving} onChange={switchTo} small onDark={privateMode} />
      </div>
    )
  }

  if (activeUntil) {
    return (
      <div className="bg-white border border-[#D8D2C4] rounded-lg p-5 mb-8 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="w-1 h-5 bg-[#AD8A4E] rounded"></span>
          <h2 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17]">مساحة العمل</h2>
        </div>
        <SlidingSwitch privateMode={privateMode} busy={saving} onChange={switchTo} />
      </div>
    )
  }

  if (!inFirm) return null

  return (
    <a href="/subscription#private" className="block bg-white border border-[#D8D2C4] rounded-lg p-5 mb-8 hover:border-[#AD8A4E] transition">
      <p className="font-['Tajawal'] font-bold text-[#1B1A17] mb-1">🔒 الحساب الخاص</p>
      <p className="font-['Tajawal'] text-sm text-[#4A473F]">
        مساحة عمل خاصة ومستقلة لقضاياك وموكليك، بنصف سعر الاشتراك. اعرف المزيد ←
      </p>
    </a>
  )
}
