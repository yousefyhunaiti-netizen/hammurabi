'use client'

import { countryOptions, allTimeZones, LANGUAGE_CODES, languageName, isInternational } from '../lib/international'

type Props = {
  country: string
  onCountry: (value: string) => void
  timezone: string
  onTimezone: (value: string) => void
  languages: string[]
  onLanguages: (value: string[]) => void
  // who is filling it in, for the wording
  who: 'lawyer' | 'firm'
}

// Country, time zone and working languages, on the lawyer and firm profile editors.
export default function LocationFields(props: Props) {
  const box = "w-full px-3 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"

  function toggleLanguage(code: string) {
    if (props.languages.indexOf(code) !== -1) {
      props.onLanguages(props.languages.filter(function (l) { return l !== code }))
    } else {
      props.onLanguages(props.languages.concat([code]))
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-1">{props.who === 'firm' ? 'الدولة التي يقع فيها المكتب' : 'الدولة التي تمارس فيها المحاماة'}</label>
          <select value={props.country} onChange={function (e) { props.onCountry(e.target.value) }} className={box}>
            {countryOptions().map(function (c) { return <option key={c.code} value={c.code}>{c.name}</option> })}
          </select>
        </div>
        <div>
          <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-1">المنطقة الزمنية (أوقات الدوام والمواعيد بها)</label>
          <select value={props.timezone} onChange={function (e) { props.onTimezone(e.target.value) }} className={box} dir="ltr">
            {allTimeZones().map(function (tz) { return <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option> })}
          </select>
        </div>
      </div>
      {isInternational(props.country) && (
        <p className="font-['Tajawal'] text-xs text-[#AD8A4E]">
          {props.who === 'firm' ? 'مكتبك يظهر' : 'تظهر'} في قسم «دولي» من دليل المحامين، والرسوم والاشتراك بالدولار الأمريكي. تغيير الدولة يعيد الحساب للمراجعة.
        </p>
      )}
      <div>
        <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-2">لغات العمل</label>
        <div className="flex flex-wrap gap-2">
          {LANGUAGE_CODES.map(function (code) {
            const on = props.languages.indexOf(code) !== -1
            return (
              <button
                key={code}
                type="button"
                onClick={function () { toggleLanguage(code) }}
                className={"px-3 py-1.5 rounded-full font-['Tajawal'] text-xs transition " + (on ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'bg-[#F3EEE4] text-[#4A473F] border border-[#D8D2C4] hover:border-[#AD8A4E]')}
              >
                {languageName(code)}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
