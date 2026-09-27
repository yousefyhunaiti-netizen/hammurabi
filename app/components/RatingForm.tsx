'use client'

import { useState } from 'react'
import { createClient } from '../lib/supabase'

// Rating form for a finished appointment or a paid consultation.
// The database only accepts it from the customer who actually had that booking.

type RatingFormProps = {
  customerId: number
  lawyerId: number | null
  firmId: number | null
  appointmentId?: number
  consultationId?: number
  targetLabel: string
  onSaved: (rating: number) => void
}

export function RatingStars({ rating }: { rating: number }) {
  return (
    <span className="text-[#AD8A4E] tracking-wider" aria-label={rating + ' من 5'}>
      {'★'.repeat(rating)}<span className="text-[#D8D2C4]">{'★'.repeat(5 - rating)}</span>
    </span>
  )
}

export default function RatingForm(props: RatingFormProps) {
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const supabase = createClient()

  async function handleSubmit() {
    if (rating < 1) {
      setError('اختر عدد النجوم أولاً')
      return
    }
    setSaving(true)
    setError('')

    const insertResult = await supabase.from('reviews').insert({
      customer_id: props.customerId,
      lawyer_id: props.lawyerId,
      firm_id: props.firmId,
      appointment_id: props.appointmentId || null,
      consultation_id: props.consultationId || null,
      rating: rating,
      comment: comment.trim() || null,
    })

    setSaving(false)

    if (insertResult.error) {
      setError('تعذر حفظ التقييم، حاول مرة أخرى')
      return
    }

    props.onSaved(rating)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={function () { setOpen(true) }}
        className="font-['Tajawal'] text-xs px-3 py-1.5 border border-[#AD8A4E] text-[#AD8A4E] rounded-md hover:bg-[#F3EEE4] transition"
      >
        ★ قيّم {props.targetLabel}
      </button>
    )
  }

  const shown = hovered || rating

  return (
    <div className="mt-3 pt-3 border-t border-[#D8D2C4]">
      <p className="font-['Tajawal'] text-sm text-[#1B1A17] mb-2">كيف كانت تجربتك مع {props.targetLabel}؟</p>
      <div className="flex gap-1 mb-3" dir="ltr" onMouseLeave={function () { setHovered(0) }}>
        {[1, 2, 3, 4, 5].map(function (n) {
          return (
            <button
              key={n}
              type="button"
              onClick={function () { setRating(n) }}
              onMouseEnter={function () { setHovered(n) }}
              className={"text-2xl leading-none transition " + (n <= shown ? 'text-[#AD8A4E]' : 'text-[#D8D2C4]')}
              aria-label={n + ' من 5'}
            >
              ★
            </button>
          )
        })}
      </div>
      <textarea
        value={comment}
        onChange={function (e) { setComment(e.target.value) }}
        rows={2}
        maxLength={500}
        placeholder="أضف تعليقاً (اختياري)"
        className="w-full px-3 py-2 mb-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
      />
      <p className="font-['Tajawal'] text-xs text-[#4A473F] mb-3">يظهر تقييمك على الصفحة العامة دون اسمك، ولا يمكن تعديله بعد الإرسال.</p>
      {error && <p className="font-['Tajawal'] text-xs text-[#7A2E2E] mb-2">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="flex-1 py-2 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal'] text-sm hover:bg-[#AD8A4E] transition disabled:opacity-60"
        >
          {saving ? 'جاري الإرسال...' : 'إرسال التقييم'}
        </button>
        <button
          type="button"
          onClick={function () { setOpen(false); setRating(0); setComment(''); setError('') }}
          className="px-4 py-2 bg-[#F3EEE4] text-[#4A473F] rounded-md font-['Tajawal'] text-sm"
        >
          إلغاء
        </button>
      </div>
    </div>
  )
}
