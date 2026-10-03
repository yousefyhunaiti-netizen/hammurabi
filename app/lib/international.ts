// Countries, languages, currencies and time zones for the international
// directory («دولي»). Country and language names come from the browser in
// Arabic, so nothing here needs translating by hand.

export const HOME_COUNTRY = 'JO'
export const HOME_TIMEZONE = 'Asia/Amman'

// ISO country codes (Jordan first, then everything else).
export const COUNTRY_CODES = [
  'JO', 'AE', 'SA', 'KW', 'QA', 'BH', 'OM', 'IQ', 'SY', 'LB', 'PS', 'EG', 'LY', 'TN', 'DZ', 'MA', 'SD', 'YE',
  'TR', 'IR', 'CY', 'GR', 'GB', 'IE', 'FR', 'DE', 'NL', 'BE', 'LU', 'CH', 'AT', 'IT', 'ES', 'PT', 'MT',
  'SE', 'NO', 'DK', 'FI', 'IS', 'PL', 'CZ', 'SK', 'HU', 'RO', 'BG', 'HR', 'SI', 'RS', 'BA', 'ME', 'MK', 'AL',
  'UA', 'MD', 'BY', 'RU', 'EE', 'LV', 'LT', 'GE', 'AM', 'AZ', 'KZ', 'UZ', 'TM', 'KG', 'TJ', 'AF', 'PK', 'IN',
  'BD', 'LK', 'NP', 'MV', 'CN', 'HK', 'MO', 'TW', 'JP', 'KR', 'MN', 'SG', 'MY', 'ID', 'TH', 'VN', 'PH', 'KH',
  'LA', 'MM', 'BN', 'AU', 'NZ', 'US', 'CA', 'MX', 'BR', 'AR', 'CL', 'CO', 'PE', 'VE', 'EC', 'UY', 'PY', 'BO',
  'CR', 'PA', 'DO', 'GT', 'CU', 'JM', 'NG', 'GH', 'KE', 'ET', 'TZ', 'UG', 'RW', 'ZA', 'SN', 'CI', 'CM', 'SO',
  'DJ', 'ER', 'MR', 'KM', 'MU', 'SC', 'ZW', 'ZM', 'AO', 'MZ', 'NA', 'BW',
]

// Languages a lawyer can say they work in.
export const LANGUAGE_CODES = [
  'ar', 'en', 'fr', 'de', 'es', 'it', 'tr', 'fa', 'ur', 'hi', 'zh', 'ru', 'pt', 'nl', 'el', 'ja', 'ko', 'he',
  'ku', 'id', 'ms', 'bn', 'sv', 'pl', 'ro', 'uk',
]

let regionNames: Intl.DisplayNames | null = null
let languageNames: Intl.DisplayNames | null = null

export function countryName(code: string | null | undefined) {
  const c = (code || HOME_COUNTRY).toUpperCase()
  try {
    if (!regionNames) regionNames = new Intl.DisplayNames(['ar'], { type: 'region' })
    return regionNames.of(c) || c
  } catch (e) {
    return c
  }
}

export function languageName(code: string) {
  try {
    if (!languageNames) languageNames = new Intl.DisplayNames(['ar'], { type: 'language' })
    return languageNames.of(code) || code
  } catch (e) {
    return code
  }
}

// Countries sorted by their Arabic name, Jordan kept first.
export function countryOptions() {
  const rest = COUNTRY_CODES.filter(function (c) { return c !== HOME_COUNTRY })
    .map(function (c) { return { code: c, name: countryName(c) } })
    .sort(function (a, b) { return a.name.localeCompare(b.name, 'ar') })
  return [{ code: HOME_COUNTRY, name: countryName(HOME_COUNTRY) }].concat(rest)
}

export function isInternational(country: string | null | undefined) {
  return !!country && country.toUpperCase() !== HOME_COUNTRY
}

// Accounts outside Jordan pay and charge in US dollars.
export function currencyOf(country: string | null | undefined): 'JOD' | 'USD' {
  return isInternational(country) ? 'USD' : 'JOD'
}

export function formatMoney(amount: number | string | null | undefined, currency: string | null | undefined) {
  const value = amount === null || amount === undefined || amount === '' ? 0 : Number(amount)
  if (currency === 'USD') return '$' + value
  return value + ' د.أ'
}

export function currencyLabel(currency: string | null | undefined) {
  return currency === 'USD' ? '$' : 'د.أ'
}

// Subscription prices; the database charges the same numbers.
export const PRICES = {
  JOD: { lawyer: { monthly: 20, yearly: 180, '5year': 300 }, firm: { monthly: 30, yearly: 270, '5year': 450 }, sub: { monthly: 10, yearly: 90, '5year': 150 } },
  USD: { lawyer: { monthly: 28, yearly: 254, '5year': 423 }, firm: { monthly: 42, yearly: 381, '5year': 635 }, sub: { monthly: 14, yearly: 127, '5year': 212 } },
}

// ---------- time zones ----------

export function viewerTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || HOME_TIMEZONE
  } catch (e) {
    return HOME_TIMEZONE
  }
}

export function allTimeZones(): string[] {
  try {
    const intl = Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
    if (intl.supportedValuesOf) return intl.supportedValuesOf('timeZone')
  } catch (e) {
    // older browsers
  }
  return [HOME_TIMEZONE, 'UTC']
}

function zoneParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timeZone, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(instant)
  const get = function (type: string) {
    const found = parts.find(function (p) { return p.type === type })
    return found ? Number(found.value) : 0
  }
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour') % 24, min: get('minute'), s: get('second') }
}

// The exact moment of a date and time written in a time zone ("10:00 in Shanghai").
export function zonedToInstant(dateStr: string, timeStr: string, timeZone: string | null | undefined) {
  const tz = timeZone || HOME_TIMEZONE
  const [y, m, d] = (dateStr || '').split('T')[0].split('-').map(Number)
  const [hh, mm] = (timeStr || '00:00').split(':').map(Number)
  const asUtc = Date.UTC(y, (m || 1) - 1, d || 1, hh || 0, mm || 0)
  if (isNaN(asUtc)) return new Date(NaN)
  // two passes settle the offset, including around daylight-saving changes
  let guess = asUtc
  for (let i = 0; i < 2; i++) {
    const p = zoneParts(new Date(guess), tz)
    const shown = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s)
    guess = guess + (asUtc - shown)
  }
  return new Date(guess)
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

// A date and time written in one time zone, shown in the viewer's own zone.
export function inViewerZone(dateStr: string, timeStr: string, timeZone: string | null | undefined) {
  const source = timeZone || HOME_TIMEZONE
  const viewer = viewerTimeZone()
  const instant = zonedToInstant(dateStr, timeStr, source)
  if (isNaN(instant.getTime())) {
    const parts = (dateStr || '').split('T')[0].split('-')
    return { date: dateStr, time: timeStr, dateDisplay: parts.length === 3 ? parts[2] + '/' + parts[1] + '/' + parts[0] : dateStr, sameAsSource: true, instant: instant }
  }
  const p = zoneParts(instant, viewer)
  const date = p.y + '-' + pad(p.m) + '-' + pad(p.d)
  const time = pad(p.h) + ':' + pad(p.min)
  return {
    date: date,
    time: time,
    dateDisplay: pad(p.d) + '/' + pad(p.m) + '/' + p.y,
    sameAsSource: zoneOffsetMinutes(instant, source) === zoneOffsetMinutes(instant, viewer),
    instant: instant,
  }
}

function zoneOffsetMinutes(instant: Date, timeZone: string) {
  const p = zoneParts(instant, timeZone)
  return Math.round((Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - instant.getTime()) / 60000)
}

// Today's date (YYYY-MM-DD) in a time zone.
export function todayIn(timeZone: string | null | undefined) {
  let p
  try {
    p = zoneParts(new Date(), timeZone || HOME_TIMEZONE)
  } catch (e) {
    p = zoneParts(new Date(), HOME_TIMEZONE)
  }
  return p.y + '-' + pad(p.m) + '-' + pad(p.d)
}

// A short readable name for a time zone, e.g. "Asia/Shanghai" → "Shanghai".
export function zoneLabel(timeZone: string | null | undefined) {
  const tz = timeZone || HOME_TIMEZONE
  try {
    const parts = new Intl.DateTimeFormat('ar', { timeZone: tz, timeZoneName: 'longGeneric' }).formatToParts(new Date())
    const name = parts.find(function (p) { return p.type === 'timeZoneName' })
    if (name && name.value) return name.value.replace(/^توقيت\s+/, '')
  } catch (e) {
    // fall back to the city in the zone's name
  }
  const last = tz.split('/').pop() || tz
  return last.replace(/_/g, ' ')
}

// "dd/mm/yyyy - HH:MM" in the viewer's zone, plus a note when the lawyer's own time differs.
export function appointmentTimeText(dateStr: string, timeStr: string, timeZone: string | null | undefined) {
  const v = inViewerZone(dateStr, timeStr, timeZone)
  const main = v.dateDisplay + ' - ' + v.time
  if (v.sameAsSource) return { main: main, note: '' }
  return { main: main, note: 'بتوقيتك · ' + timeStr + ' بتوقيت ' + zoneLabel(timeZone) }
}
