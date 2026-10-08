'use client'

import { useState } from 'react'
import { COURTS, COURT_TYPES_ABROAD, OTHER, typesOf, locationsOf, flatLocations } from '../lib/courts'

export type CourtValue = { category: string; type: string; location: string }

type Props = {
  value: CourtValue
  onChange: (value: CourtValue) => void
  // outside Jordan: general court levels and a typed location
  abroad?: boolean
}

const labelClass = "block font-['Tajawal'] text-xs text-[#4A473F] mb-1"
const fieldClass = "w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"

// The court of a case in steps: نظامية / خاصة / شرعية, then the court,
// then only that court's locations.
export default function CourtPicker(props: Props) {
  const v = props.value
  const knownTypes = typesOf(v.category).map(function (t) { return t.name })
  const typeIsOther = !!v.type && v.category !== '' && knownTypes.indexOf(v.type) === -1
  const knownLocations = flatLocations(v.category, v.type)
  const locationIsOther = !!v.location && knownLocations.indexOf(v.location) === -1
  const [typeOther, setTypeOther] = useState(typeIsOther)
  const [locationOther, setLocationOther] = useState(locationIsOther || typeIsOther)

  function set(next: Partial<CourtValue>) {
    props.onChange(Object.assign({}, v, next))
  }

  if (props.abroad) {
    return (
      <div className="space-y-3">
        <div>
          <label className={labelClass}>المحكمة</label>
          <select value={v.type} onChange={function (e) { set({ type: e.target.value }) }} className={fieldClass}>
            <option value="">اختر</option>
            {COURT_TYPES_ABROAD.map(function (t) { return <option key={t} value={t}>{t}</option> })}
          </select>
        </div>
        <div>
          <label className={labelClass}>موقع المحكمة</label>
          <input type="text" value={v.location} onChange={function (e) { set({ location: e.target.value }) }} className={fieldClass} />
        </div>
      </div>
    )
  }

  function pickCategory(name: string) {
    setTypeOther(false)
    setLocationOther(false)
    set({ category: name, type: '', location: '' })
  }

  function pickType(e: React.ChangeEvent<HTMLSelectElement>) {
    const t = e.target.value
    if (t === OTHER) {
      setTypeOther(true)
      setLocationOther(true)
      set({ type: '', location: '' })
      return
    }
    setTypeOther(false)
    setLocationOther(false)
    const locs = flatLocations(v.category, t)
    // a court with one seat (e.g. التمييز) is filled in straight away
    set({ type: t, location: locs.length === 1 ? locs[0] : '' })
  }

  function pickLocation(e: React.ChangeEvent<HTMLSelectElement>) {
    const l = e.target.value
    if (l === OTHER) {
      setLocationOther(true)
      set({ location: '' })
      return
    }
    setLocationOther(false)
    set({ location: l })
  }

  const locations = locationsOf(v.category, v.type)

  return (
    <div className="space-y-3">
      <div>
        <label className={labelClass}>نوع القضاء</label>
        <div className="flex gap-2">
          {COURTS.map(function (c) {
            const on = v.category === c.name
            return (
              <button
                key={c.name}
                type="button"
                onClick={function () { pickCategory(c.name) }}
                className={"flex-1 py-2 rounded-md font-['Tajawal'] text-sm transition " + (on ? 'bg-[#1B1A17] text-white' : 'bg-[#F3EEE4] text-[#4A473F] border border-[#D8D2C4] hover:border-[#AD8A4E]')}
              >
                {c.name}
              </button>
            )
          })}
        </div>
      </div>

      {v.category && (
        <div>
          <label className={labelClass}>المحكمة</label>
          <select value={typeOther ? OTHER : v.type} onChange={pickType} className={fieldClass}>
            <option value="">اختر المحكمة</option>
            {typesOf(v.category).map(function (t) { return <option key={t.name} value={t.name}>{t.name}</option> })}
            <option value={OTHER}>أخرى</option>
          </select>
          {typeOther && (
            <input type="text" value={v.type} onChange={function (e) { set({ type: e.target.value }) }} placeholder="اكتب اسم المحكمة" className={fieldClass + ' mt-2'} />
          )}
        </div>
      )}

      {v.category && (v.type || typeOther) && (
        <div>
          <label className={labelClass}>الموقع</label>
          {!typeOther && (
            <select value={locationOther ? OTHER : v.location} onChange={pickLocation} className={fieldClass}>
              <option value="">اختر الموقع</option>
              {locations.map(function (l) {
                if (typeof l === 'string') return <option key={l} value={l}>{l}</option>
                return (
                  <optgroup key={l.group} label={l.group}>
                    {l.items.map(function (i) { return <option key={i} value={i}>{i}</option> })}
                  </optgroup>
                )
              })}
              <option value={OTHER}>أخرى</option>
            </select>
          )}
          {locationOther && (
            <input type="text" value={v.location} onChange={function (e) { set({ location: e.target.value }) }} placeholder="اكتب الموقع" className={fieldClass + (typeOther ? '' : ' mt-2')} />
          )}
        </div>
      )}
    </div>
  )
}
