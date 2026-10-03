'use client'

import { useEffect, useState } from 'react'

type Props = {
  // stored format: YYYY-MM-DD, or '' when empty
  value: string
  onChange: (value: string) => void
  // background of the three boxes: 'paper' on white cards, 'white' on beige panels
  tone?: 'paper' | 'white'
}

function splitDate(value: string) {
  const parts = (value || '').split('T')[0].split('-')
  if (parts.length !== 3) return { d: '', m: '', y: '' }
  return { d: String(Number(parts[2])), m: String(Number(parts[1])), y: parts[0] }
}

function buildDate(d: string, m: string, y: string) {
  const day = Number(d)
  const month = Number(m)
  const year = Number(y)
  if (!d || !m || !y || !Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return null
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1) return null
  const lastDay = new Date(year, month, 0).getDate()
  if (day > lastDay) return null
  return year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0')
}

// Day / month / year as three boxes (يوم / شهر / سنة), so a date can never be
// read the American way (month first) the way the browser's date picker can.
export default function DateFields(props: Props) {
  const initial = splitDate(props.value)
  const [day, setDay] = useState(initial.d)
  const [month, setMonth] = useState(initial.m)
  const [year, setYear] = useState(initial.y)

  // a new value from outside (a form being reset or filled for editing)
  useEffect(function () {
    const current = buildDate(day, month, year) || ''
    if ((props.value || '') !== current) {
      const next = splitDate(props.value)
      setDay(next.d)
      setMonth(next.m)
      setYear(next.y)
    }
  }, [props.value])

  function update(d: string, m: string, y: string) {
    setDay(d)
    setMonth(m)
    setYear(y)
    props.onChange(buildDate(d, m, y) || '')
  }

  const started = !!(day || month || year)
  const invalid = started && !buildDate(day, month, year) && !!(day && month && year.length === 4)
  const box = "w-full px-2 py-2 border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17] text-center " + (props.tone === 'white' ? 'bg-white' : 'bg-[#F3EEE4]')

  return (
    <div>
      <div className="grid grid-cols-3 gap-2" dir="rtl">
        <input type="number" inputMode="numeric" value={day} onChange={function (e) { update(e.target.value, month, year) }} placeholder="يوم" min="1" max="31" className={box} aria-label="يوم" />
        <input type="number" inputMode="numeric" value={month} onChange={function (e) { update(day, e.target.value, year) }} placeholder="شهر" min="1" max="12" className={box} aria-label="شهر" />
        <input type="number" inputMode="numeric" value={year} onChange={function (e) { update(day, month, e.target.value) }} placeholder="سنة" min="1900" max="2200" className={box} aria-label="سنة" />
      </div>
      {invalid && <p className="font-['Tajawal'] text-xs text-[#7A2E2E] mt-1">التاريخ غير صحيح</p>}
    </div>
  )
}
