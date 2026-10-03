'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase'

type Notification = {
  id: number
  created_at: string
  consultation_id: number | null
  kind: string
  message: string
  is_read: boolean
}

// A deadline that has passed, worked out on the page (not stored).
export type OverdueAlert = {
  consultationId: number
  message: string
}

type Props = {
  accountType: 'lawyer' | 'firm'
  accountId: number
  overdue: OverdueAlert[]
  onOpenConsultation?: (consultationId: number) => void
}

function timeAgo(dateStr: string) {
  const diffMinutes = Math.max(0, Math.round((Date.now() - new Date(dateStr).getTime()) / 60000))
  if (diffMinutes < 1) return 'الآن'
  if (diffMinutes < 60) return 'قبل ' + diffMinutes + ' دقيقة'
  const hours = Math.round(diffMinutes / 60)
  if (hours < 24) return 'قبل ' + hours + ' ساعة'
  const days = Math.round(hours / 24)
  return 'قبل ' + days + ' يوم'
}

// «التنبيهات» at the top of «المواعيد والاستشارات»: what happened in the
// review flow (answer sent for review, review assigned, answer approved),
// plus anything overdue. Opening the page marks them as read.
export default function Notifications(props: Props) {
  const supabase = createClient()
  const [items, setItems] = useState<Notification[]>([])
  const [loaded, setLoaded] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(function () {
    async function load() {
      const column = props.accountType === 'firm' ? 'firm_id' : 'lawyer_id'
      const result = await supabase
        .from('notifications')
        .select('id, created_at, consultation_id, kind, message, is_read')
        .eq(column, props.accountId)
        .order('created_at', { ascending: false })
        .limit(30)
      setItems(result.data || [])
      setLoaded(true)

      // seen now: they stop counting on the profile icon
      if ((result.data || []).some(function (n: Notification) { return !n.is_read })) {
        await supabase.rpc('mark_notifications_read')
      }
    }
    load()
  }, [props.accountType, props.accountId])

  if (!loaded) return null
  if (items.length === 0 && props.overdue.length === 0) return null

  const visible = expanded ? items : items.slice(0, 4)

  function open(consultationId: number | null) {
    if (consultationId && props.onOpenConsultation) props.onOpenConsultation(consultationId)
  }

  return (
    <div className="bg-white border border-[#D8D2C4] rounded-lg p-5 mb-6 hm-no-reveal">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-1 h-5 bg-[#AD8A4E] rounded"></span>
        <h2 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17]">التنبيهات</h2>
      </div>

      {props.overdue.map(function (o) {
        return (
          <button key={'overdue-' + o.consultationId} type="button" onClick={function () { open(o.consultationId) }} className="w-full text-right flex items-start gap-3 bg-[#F2DEDC] border border-[#7A2E2E]/30 rounded-md px-3 py-2.5 mb-2 hover:border-[#7A2E2E] transition">
            <span className="mt-1.5 w-2 h-2 rounded-full bg-[#7A2E2E] flex-shrink-0"></span>
            <span className="font-['Tajawal'] text-sm text-[#7A2E2E] font-bold">{o.message}</span>
          </button>
        )
      })}

      {visible.map(function (n) {
        return (
          <button key={n.id} type="button" onClick={function () { open(n.consultation_id) }} className={"w-full text-right flex items-start gap-3 rounded-md px-3 py-2.5 mb-2 transition " + (n.is_read ? 'bg-[#F3EEE4] hover:bg-[#EDE6D8]' : 'bg-[#F0E6D2] hover:bg-[#EADCBF]')}>
            <span className={"mt-1.5 w-2 h-2 rounded-full flex-shrink-0 " + (n.is_read ? 'bg-[#D8D2C4]' : 'bg-[#AD8A4E]')}></span>
            <span className="flex-1">
              <span className={"block font-['Tajawal'] text-sm text-[#1B1A17] " + (n.is_read ? '' : 'font-bold')}>{n.message}</span>
              <span className="block font-['Tajawal'] text-xs text-[#8A8474] mt-0.5">{timeAgo(n.created_at)}</span>
            </span>
          </button>
        )
      })}

      {items.length > 4 && (
        <button type="button" onClick={function () { setExpanded(!expanded) }} className="font-['Tajawal'] text-xs text-[#AD8A4E] hover:underline mt-1">
          {expanded ? 'عرض أقل' : 'عرض كل التنبيهات (' + items.length + ')'}
        </button>
      )}
    </div>
  )
}
