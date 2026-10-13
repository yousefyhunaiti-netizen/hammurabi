'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'
import { myLawyer, myFirm } from '../lib/me'
import Footer from '../components/Footer'
import HeaderLines from '../components/HeaderLines'
import Loader from '../components/Loader'
import { countryName, languageName, isInternational, currencyOf, formatMoney } from '../lib/international'

type Lawyer = {
  id: number
  full_name: string
  bio: string
  city: string
  cities: string | null
  specialty_id: number
  specialty_ids: string | null
  years_experience: number
  consultation_fee: number
  photo_url: string | null
  vacation_until: string | null
  firm_id: number | null
  country: string | null
  languages: string[] | null
  rating_avg: number | null
  rating_count: number
  firm_name: string | null
}

type Firm = {
  id: number
  firm_name: string
  bio: string | null
  city: string | null
  founded_year: number | null
  country: string | null
  languages: string[] | null
  lawyer_count: number
  rating_avg: number | null
  rating_count: number
}

type DirectoryMeta = {
  lawyers: number
  firms: number
  intl_count: number
  countries: string[]
  languages: string[]
}

const PAGE_SIZE = 24
const EMPTY_META: DirectoryMeta = { lawyers: 0, firms: 0, intl_count: 0, countries: [], languages: [] }

type Specialty = {
  id: number
  name_ar: string
}

const cityOptions = ['عمان', 'إربد', 'الزرقاء', 'البلقاء', 'المفرق', 'الكرك', 'جرش', 'عجلون', 'مادبا', 'العقبة', 'معان', 'الطفيلة']

function todayString() {
  const now = new Date()
  return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0')
}

function formatDateDisplay(dateStr: string) {
  const parts = dateStr.split('T')[0].split('-')
  if (parts.length !== 3) return dateStr
  return parts[2] + '/' + parts[1] + '/' + parts[0]
}

function isOnVacation(l: Lawyer) {
  return !!l.vacation_until && l.vacation_until >= todayString()
}

export default function LawyersPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [lawyers, setLawyers] = useState<Lawyer[]>([])
  const [firms, setFirms] = useState<Firm[]>([])
  const [specialties, setSpecialties] = useState<Specialty[]>([])
  // The database filters, orders and pages the results; the page shows one page at a time.
  const [lawyersTotal, setLawyersTotal] = useState(0)
  const [firmsTotal, setFirmsTotal] = useState(0)
  const [meta, setMeta] = useState<DirectoryMeta>(EMPTY_META)
  const [listLoading, setListLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [debouncedSearch, setDebouncedSearch] = useState('')
  // a new random order on every visit, kept while paging
  const [seed] = useState(function () { return Math.random().toString(36).slice(2) })
  const requestRef = useRef(0)
  const [viewMode, setViewMode] = useState('individuals')
  const [layout, setLayout] = useState('cards')

  const [search, setSearch] = useState('')
  const [selectedSpecialty, setSelectedSpecialty] = useState('')
  const [selectedCity, setSelectedCity] = useState('')
  const [onlyAvailable, setOnlyAvailable] = useState(false)
  // «دولي»: lawyers and firms outside Jordan
  const [intl, setIntl] = useState(false)
  const [selectedCountry, setSelectedCountry] = useState('')
  const [selectedLanguage, setSelectedLanguage] = useState('')

  const [checkingAuth, setCheckingAuth] = useState(true)
  const [loggedIn, setLoggedIn] = useState(false)
  const [accountRole, setAccountRole] = useState<'customer' | 'lawyer' | 'firm' | null>(null)
  const [infoLink, setInfoLink] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)

  const supabase = createClient()
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(function () {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return function () {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  useEffect(function () {
    const params = new URLSearchParams(window.location.search)
    if (params.get('intl') === '1') setIntl(true)
  }, [])

  function switchSection(toIntl: boolean) {
    setIntl(toIntl)
    setSelectedCountry('')
    setSelectedLanguage('')
    setSelectedCity('')
    const url = toIntl ? '/lawyers?intl=1' : '/lawyers'
    try {
      window.history.replaceState(null, '', url)
    } catch (e) {
      // the address bar just keeps the old link
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(function () {
    async function loadData() {
      const userResult = await supabase.auth.getUser()
      const user = userResult.data.user

      if (user) {
        setLoggedIn(true)
        const customerResult = await supabase.from('customers').select('id').eq('user_id', user.id).maybeSingle()
        if (customerResult.data) {
          setAccountRole('customer')
          setInfoLink('/my-info')
        } else {
          const lawyerResult = await myLawyer(supabase).select('id').eq('user_id', user.id).maybeSingle()
          if (lawyerResult.data) {
            setAccountRole('lawyer')
            setCheckingAuth(false)
            setLoading(false)
            return
          }
          const firmResult = await myFirm(supabase).select('id').eq('user_id', user.id).maybeSingle()
          if (firmResult.data) {
            setAccountRole('firm')
            setCheckingAuth(false)
            setLoading(false)
            return
          }
        }
      }

      setCheckingAuth(false)

      const specialtiesResult = await supabase.from('specialties').select('*').order('id')
      setSpecialties(specialtiesResult.data || [])

      setLoading(false)
    }

    loadData()
  }, [])

  // typing in the search box waits a moment before asking the database
  useEffect(function () {
    const timer = setTimeout(function () { setDebouncedSearch(search.trim()) }, 350)
    return function () { clearTimeout(timer) }
  }, [search])

  // No ranking: lawyers and firms come in a random order (the same order while paging).
  async function fetchPage(offset: number) {
    if (viewMode === 'individuals') {
      return supabase.rpc('directory_lawyers', {
        p_intl: intl,
        p_country: selectedCountry || null,
        p_language: selectedLanguage || null,
        p_specialty: selectedSpecialty ? Number(selectedSpecialty) : null,
        p_city: selectedCity || null,
        p_available: onlyAvailable,
        p_search: debouncedSearch || null,
        p_seed: seed,
        p_offset: offset,
        p_limit: PAGE_SIZE,
      })
    }
    return supabase.rpc('directory_firms', {
      p_intl: intl,
      p_country: selectedCountry || null,
      p_language: selectedLanguage || null,
      p_city: selectedCity || null,
      p_search: debouncedSearch || null,
      p_seed: seed,
      p_offset: offset,
      p_limit: PAGE_SIZE,
    })
  }

  function applyPage(result: { data: any }, append: boolean) {
    const data = (result.data || { total: 0, rows: [] }) as { total: number; rows: any[] }
    if (viewMode === 'individuals') {
      setLawyersTotal(data.total || 0)
      setLawyers(function (prev) { return append ? prev.concat(data.rows || []) : (data.rows || []) })
    } else {
      setFirmsTotal(data.total || 0)
      setFirms(function (prev) { return append ? prev.concat(data.rows || []) : (data.rows || []) })
    }
  }

  // first page again whenever a filter, the section or the tab changes
  useEffect(function () {
    if (checkingAuth || accountRole === 'lawyer' || accountRole === 'firm') return
    const requestId = requestRef.current + 1
    requestRef.current = requestId
    setListLoading(true)
    fetchPage(0).then(function (result: { data: any }) {
      if (requestRef.current !== requestId) return
      applyPage(result, false)
      setListLoading(false)
    })
  }, [checkingAuth, accountRole, viewMode, intl, selectedCountry, selectedLanguage, selectedSpecialty, selectedCity, onlyAvailable, debouncedSearch])

  // section totals and filter choices
  useEffect(function () {
    if (checkingAuth || accountRole === 'lawyer' || accountRole === 'firm') return
    supabase.rpc('directory_meta', { p_intl: intl }).then(function (result: { data: any }) {
      setMeta((result.data as DirectoryMeta) || EMPTY_META)
    })
  }, [checkingAuth, accountRole, intl])

  async function loadMore() {
    const requestId = requestRef.current
    setLoadingMore(true)
    const result = await fetchPage(viewMode === 'individuals' ? lawyers.length : firms.length)
    if (requestRef.current === requestId) applyPage(result, true)
    setLoadingMore(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setLoggedIn(false)
    setMenuOpen(false)
    router.push('/')
  }

  function toggleMenu() {
    setMenuOpen(!menuOpen)
  }

  function getSpecialtyName(id: number) {
    const found = specialties.find(function (s) { return s.id === id })
    return found ? found.name_ar : ''
  }

  function getLawyerSpecialtyIds(l: Lawyer) {
    if (l.specialty_ids) return l.specialty_ids.split(',').filter(Boolean).map(Number)
    return [l.specialty_id]
  }

  function getLawyerCities(l: Lawyer) {
    if (l.cities) return l.cities.split(',').filter(Boolean)
    return [l.city]
  }

  function getFirmRatingInfo(f: Firm) {
    if (!f.rating_count) return null
    return { avg: Number(f.rating_avg || 0).toFixed(1), count: f.rating_count }
  }

  function getRatingInfo(l: Lawyer) {
    if (!l.rating_count) return null
    return { avg: Number(l.rating_avg || 0).toFixed(1), value: Number(l.rating_avg || 0), count: l.rating_count }
  }

  function clearFilters() {
    setSearch('')
    setSelectedSpecialty('')
    setSelectedCity('')
    setOnlyAvailable(false)
    setSelectedCountry('')
    setSelectedLanguage('')
  }

  const availableCountries = (meta.countries || []).slice().sort(function (a, b) { return countryName(a).localeCompare(countryName(b), 'ar') })
  const availableLanguages = meta.languages || []
  const intlCount = meta.intl_count || 0

  const lowerSearch = search.trim().toLowerCase()
  const hasActiveFilters = Boolean(lowerSearch || selectedCity || selectedCountry || selectedLanguage || (viewMode === 'individuals' && (selectedSpecialty || onlyAvailable)))

  // already filtered and ordered by the database
  const filteredLawyers = lawyers
  const filteredFirms = firms

  function getFirmLawyerCount(f: Firm) {
    return f.lawyer_count || 0
  }

  function renderLawyerAvatar(l: Lawyer, sizeClass: string, onVacation: boolean) {
    return (
      <div className="relative flex-shrink-0">
        {l.photo_url ? (
          <img src={l.photo_url} alt={l.full_name} className={sizeClass + ' rounded-full object-cover'} />
        ) : (
          <div className={sizeClass + " rounded-full bg-[#1B1A17] flex items-center justify-center text-[#AD8A4E] font-['Tajawal'] font-bold text-2xl"}>
            {l.full_name.charAt(0)}
          </div>
        )}
        <span className={"absolute bottom-0 left-0 w-4 h-4 rounded-full border-2 border-white " + (onVacation ? 'bg-[#7A2E2E]' : 'bg-[#2F4538]')}></span>
      </div>
    )
  }

  function renderAvailability(onVacation: boolean, vacationUntil: string | null) {
    return (
      <div className="flex items-center gap-2">
        <span className={"w-2 h-2 rounded-full flex-shrink-0 " + (onVacation ? 'bg-[#7A2E2E]' : 'bg-[#2F4538]')}></span>
        <span className={"font-['Tajawal'] text-xs " + (onVacation ? 'text-[#7A2E2E]' : 'text-[#2F4538]')}>
          {onVacation && vacationUntil ? 'في إجازة حتى ' + formatDateDisplay(vacationUntil) : 'متاح للحجز'}
        </span>
      </div>
    )
  }

  function renderLawyerCard(l: Lawyer) {
    const specialtyNames = getLawyerSpecialtyIds(l).map(getSpecialtyName).filter(Boolean).join('، ')
    const citiesText = getLawyerCities(l).filter(Boolean).join('، ')
    const rating = getRatingInfo(l)
    const onVacation = isOnVacation(l)
    const feeText = l.consultation_fee ? formatMoney(l.consultation_fee, currencyOf(l.country)) : 'غير محدد'
    const placeText = intl ? countryName(l.country) + (citiesText ? '، ' + citiesText : '') : citiesText
    const langs = (l.languages && l.languages.length > 0 ? l.languages : ['ar']).map(languageName).join('، ')

    if (layout === 'list') {
      return (
        <a key={l.id} href={'/lawyers/' + l.id} className="group flex items-center gap-4 bg-white border border-[#D8D2C4] rounded-xl p-4 mb-3 hover:shadow-lg hover:border-[#AD8A4E] transition-all duration-200">
          {renderLawyerAvatar(l, 'w-14 h-14', onVacation)}

          <div className="flex-1 min-w-0">
            <h3 dir="auto" className="font-['Tajawal'] font-bold text-[#1B1A17] truncate text-right">{l.full_name}</h3>
            <p className="font-['Tajawal'] text-sm text-[#AD8A4E] truncate">{specialtyNames || 'محامي'}{l.firm_name ? ' · ' + l.firm_name : ''}</p>
            <p className="font-['Tajawal'] text-xs text-[#4A473F] truncate md:hidden">🎓 {l.years_experience || 0} سنوات · 📍 {placeText}</p>
          </div>

          <div className="hidden md:block w-36 flex-shrink-0 font-['Tajawal'] text-xs text-[#4A473F]">
            {rating ? <span className="text-[#1B1A17]">⭐ {rating.avg} ({rating.count} تقييم)</span> : 'لا توجد تقييمات بعد'}
          </div>

          <div className="hidden md:block w-32 flex-shrink-0 font-['Tajawal'] text-xs text-[#4A473F] leading-relaxed">
            <p>🎓 {l.years_experience || 0} سنوات خبرة</p>
            <p className="truncate">📍 {placeText}</p>
            {intl && <p className="truncate">🗣 {langs}</p>}
          </div>

          <div className="hidden sm:block w-20 flex-shrink-0 text-center">
            <p className="font-['Tajawal'] text-[10px] text-[#4A473F]">استشارة سريعة</p>
            <p className="font-['Tajawal'] font-bold text-sm text-[#1B1A17]">{feeText}</p>
          </div>

          <div className="hidden lg:block w-40 flex-shrink-0">
            {renderAvailability(onVacation, l.vacation_until)}
          </div>

          <span className="flex-shrink-0 px-4 py-2 bg-[#1B1A17] text-[#F3EEE4] group-hover:bg-[#AD8A4E] transition rounded-md font-['Tajawal'] text-sm">عرض الملف</span>
        </a>
      )
    }

    return (
      <a key={l.id} href={'/lawyers/' + l.id} className="group flex flex-col h-full bg-white border border-[#D8D2C4] rounded-2xl p-5 hover:shadow-xl hover:-translate-y-1 hover:border-[#AD8A4E] transition-all duration-200">
        <div className="flex items-center gap-4 mb-4">
          {renderLawyerAvatar(l, 'w-16 h-16', onVacation)}
          <div className="min-w-0 flex-1">
            <h3 dir="auto" className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] truncate text-right">{l.full_name}</h3>
            <p className="font-['Tajawal'] text-sm text-[#AD8A4E] truncate">{specialtyNames || 'محامي'}</p>
          </div>
        </div>

        <div className="h-6 mb-2">
          {rating ? (
            <p className="font-['Tajawal'] text-sm text-[#1B1A17]">⭐ {rating.avg} <span className="text-xs text-[#4A473F]">({rating.count} تقييم)</span></p>
          ) : (
            <p className="font-['Tajawal'] text-xs text-[#B0AA9C]">لا توجد تقييمات بعد</p>
          )}
        </div>

        {l.firm_name && (
          <p className="font-['Tajawal'] text-xs text-[#2F4538] mb-2 truncate">🏛 عضو في {l.firm_name}</p>
        )}

        <p className="font-['Tajawal'] text-sm text-[#4A473F] leading-relaxed line-clamp-2 min-h-[2.8rem] mb-4">{l.bio}</p>

        <div className="flex flex-wrap gap-2 mb-4">
          <span className="px-3 py-1 bg-[#F3EEE4] rounded-full font-['Tajawal'] text-xs text-[#4A473F]">🎓 {l.years_experience || 0} سنوات خبرة</span>
          <span className="px-3 py-1 bg-[#F3EEE4] rounded-full font-['Tajawal'] text-xs text-[#4A473F] max-w-full truncate">📍 {placeText}</span>
          {(intl || langs !== languageName('ar')) && (
            <span className="px-3 py-1 bg-[#F3EEE4] rounded-full font-['Tajawal'] text-xs text-[#4A473F] max-w-full truncate">🗣 {langs}</span>
          )}
        </div>

        <div className="mb-4">
          {renderAvailability(onVacation, l.vacation_until)}
        </div>

        <div className="mt-auto flex justify-between items-center pt-4 border-t border-[#D8D2C4]">
          <div>
            <p className="font-['Tajawal'] text-[11px] text-[#4A473F]">استشارة سريعة</p>
            <p className="font-['Tajawal'] font-bold text-[#1B1A17]">{feeText}</p>
          </div>
          <span className="px-4 py-2 bg-[#1B1A17] text-[#F3EEE4] group-hover:bg-[#AD8A4E] transition rounded-md font-['Tajawal'] text-sm">عرض الملف</span>
        </div>
      </a>
    )
  }

  function renderFirmCard(f: Firm) {
    const lawyerCount = getFirmLawyerCount(f)
    const yearsSince = f.founded_year ? new Date().getFullYear() - f.founded_year : null
    const firmRating = getFirmRatingInfo(f)

    if (layout === 'list') {
      return (
        <a key={f.id} href={'/firms/' + f.id} className="group flex items-center gap-4 bg-white border border-[#D8D2C4] rounded-xl p-4 mb-3 hover:shadow-lg hover:border-[#AD8A4E] transition-all duration-200">
          <div className="w-14 h-14 rounded-full bg-[#AD8A4E] text-white flex items-center justify-center font-['Tajawal'] font-bold text-2xl flex-shrink-0">
            {f.firm_name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <h3 dir="auto" className="font-['Tajawal'] font-bold text-[#1B1A17] truncate text-right">{f.firm_name}</h3>
            <p className="font-['Tajawal'] text-sm text-[#AD8A4E] truncate">مكتب محاماة{intl ? ' - ' + countryName(f.country) : ''}{f.city ? ' - ' + f.city : ''}</p>
          </div>
          <div className="hidden md:block w-32 flex-shrink-0 font-['Tajawal'] text-xs text-[#4A473F]">👥 {lawyerCount} محامي</div>
          <div className="hidden md:block w-32 flex-shrink-0 font-['Tajawal'] text-xs text-[#4A473F]">{yearsSince !== null ? '🏛️ خبرة ' + yearsSince + ' سنة' : ''}</div>
          <div className="hidden md:block w-32 flex-shrink-0 font-['Tajawal'] text-xs text-[#4A473F]">{firmRating ? '⭐ ' + firmRating.avg + ' (' + firmRating.count + ')' : ''}</div>
          <span className="flex-shrink-0 px-4 py-2 bg-[#1B1A17] text-[#F3EEE4] group-hover:bg-[#AD8A4E] transition rounded-md font-['Tajawal'] text-sm">عرض المكتب</span>
        </a>
      )
    }

    return (
      <a key={f.id} href={'/firms/' + f.id} className="group flex flex-col h-full bg-white border border-[#D8D2C4] rounded-2xl p-5 hover:shadow-xl hover:-translate-y-1 hover:border-[#AD8A4E] transition-all duration-200">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-[#AD8A4E] text-white flex items-center justify-center font-['Tajawal'] font-bold text-2xl flex-shrink-0">
            {f.firm_name.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <h3 dir="auto" className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] truncate text-right">{f.firm_name}</h3>
            <p className="font-['Tajawal'] text-sm text-[#AD8A4E] truncate">مكتب محاماة{intl ? ' - ' + countryName(f.country) : ''}{f.city ? ' - ' + f.city : ''}</p>
          </div>
        </div>

        <p className="font-['Tajawal'] text-sm text-[#4A473F] leading-relaxed line-clamp-2 min-h-[2.8rem] mb-4">{f.bio || ''}</p>

        <div className="flex flex-wrap gap-2 mb-4">
          <span className="px-3 py-1 bg-[#F3EEE4] rounded-full font-['Tajawal'] text-xs text-[#4A473F]">👥 {lawyerCount} محامي</span>
          {yearsSince !== null && (
            <span className="px-3 py-1 bg-[#F3EEE4] rounded-full font-['Tajawal'] text-xs text-[#4A473F]">🏛️ خبرة {yearsSince} سنة</span>
          )}
          {firmRating && (
            <span className="px-3 py-1 bg-[#F3EEE4] rounded-full font-['Tajawal'] text-xs text-[#1B1A17]">⭐ {firmRating.avg} ({firmRating.count} تقييم)</span>
          )}
        </div>

        <div className="mt-auto flex justify-end pt-4 border-t border-[#D8D2C4]">
          <span className="px-4 py-2 bg-[#1B1A17] text-[#F3EEE4] group-hover:bg-[#AD8A4E] transition rounded-md font-['Tajawal'] text-sm">عرض المكتب</span>
        </div>
      </a>
    )
  }

  function renderEmpty(message: string) {
    return (
      <div className="bg-white border border-[#D8D2C4] rounded-2xl p-10 text-center">
        <p className="font-['Tajawal'] font-bold text-[#1B1A17] mb-1">{message}</p>
        {hasActiveFilters && (
          <div>
            <p className="font-['Tajawal'] text-sm text-[#4A473F] mb-4">جرّب تغيير الفلاتر أو البحث بكلمات أخرى.</p>
            <button onClick={clearFilters} className="px-5 py-2 bg-[#1B1A17] text-[#F3EEE4] hover:bg-[#AD8A4E] transition rounded-md font-['Tajawal'] text-sm">مسح الفلاتر</button>
          </div>
        )}
      </div>
    )
  }

  if (checkingAuth) {
    return (
      <div dir="rtl" className="min-h-screen pattern-bg flex items-center justify-center">
        <Loader />
      </div>
    )
  }

  if (accountRole === 'lawyer' || accountRole === 'firm') {
    return (
      <div dir="rtl" className="min-h-screen pattern-bg flex items-center justify-center px-6">
        <div className="text-center max-w-md bg-white border border-[#D8D2C4] rounded-2xl p-8">
          <h1 className="font-['Tajawal'] font-bold text-2xl text-[#1B1A17] mb-3">دليل المحامين مخصص للعملاء</h1>
          <p className="font-['Tajawal'] text-sm text-[#4A473F] leading-relaxed mb-6">
            حسابك حساب {accountRole === 'firm' ? 'مكتب' : 'محامي'}، ويمكنك متابعة عملك من لوحة أدواتك.
          </p>
          <a href={accountRole === 'firm' ? '/firm-dashboard' : '/lawyer-tools'} className="inline-block px-6 py-3 bg-[#1B1A17] text-[#F3EEE4] hover:bg-[#AD8A4E] transition rounded-md font-['Tajawal']">
            الذهاب إلى {accountRole === 'firm' ? 'لوحة التحكم' : 'أدواتي'}
          </a>
        </div>
      </div>
    )
  }

  const resultsCount = viewMode === 'individuals' ? lawyersTotal : firmsTotal
  const hasMore = viewMode === 'individuals' ? lawyers.length < lawyersTotal : firms.length < firmsTotal
  const gridClass = layout === 'cards' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch' : ''

  return (
    <div dir="rtl" className="min-h-screen pattern-bg flex flex-col">
      <div className="hm-header bg-[#1B1A17] text-[#F3EEE4] py-12 px-6">
        <HeaderLines />
        <div className="max-w-5xl mx-auto">
          <div className="flex justify-between items-center mb-8 font-['Tajawal'] text-sm">
            <a href="/"><img src="/logo.png" alt="حمورابي" className="h-12 w-auto" /></a>
            <div className="flex gap-5 items-center">
              {loggedIn && <a href="/my-appointments" className="hover:text-[#AD8A4E] transition">مواعيدي</a>}
              {loggedIn && <a href="/my-consultations" className="hover:text-[#AD8A4E] transition">استشاراتي</a>}
              <a href="/lawyers" className="text-[#AD8A4E]">دليل المحامين</a>
              <a href="/ai-assistant" className="hover:text-[#AD8A4E] transition">مساعد ذكي</a>
              <a href="/legal-articles" className="hover:text-[#AD8A4E] transition">مقالات قانونية</a>

              {!loggedIn && (
                <a href="/login" className="hover:text-[#AD8A4E] transition">تسجيل الدخول</a>
              )}
              {!loggedIn && (
                <a href="/signup?type=customer" className="px-4 py-2 bg-[#AD8A4E] text-white rounded-md hover:bg-[#c49b58] transition">إنشاء حساب</a>
              )}

              {loggedIn && (
                <div className="relative" ref={menuRef}>
                  <button onClick={toggleMenu} className="w-8 h-8 rounded-full bg-[#AD8A4E] flex items-center justify-center hover:bg-[#c49b58] transition">
                    <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.5c-3.3 0-9.8 1.6-9.8 4.9v2.4h19.6v-2.4c0-3.3-6.5-4.9-9.8-4.9z" /></svg>
                  </button>
                  {menuOpen && (
                    <div className="absolute left-0 top-full mt-2 w-52 bg-white border border-[#D8D2C4] rounded-md shadow-lg overflow-hidden z-20">
                      {infoLink && (
                        <a href={infoLink} className="block px-4 py-3 font-['Tajawal'] text-sm text-[#1B1A17] hover:bg-[#F3EEE4] transition">معلوماتي الشخصية</a>
                      )}
                      <button onClick={handleLogout} className={"w-full text-right px-4 py-3 font-['Tajawal'] text-sm text-[#7A2E2E] hover:bg-[#F3EEE4] transition " + (infoLink ? 'border-t border-[#D8D2C4]' : '')}>تسجيل الخروج</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <h1 className="font-['Tajawal'] font-bold text-4xl mb-3">{intl ? 'دليل المحامين الدولي' : 'دليل المحامين'}</h1>
          <p className="font-['Tajawal'] text-sm text-[#D8D2C4]">{intl ? 'محامون ومكاتب خارج الأردن، حسب الدولة واللغة' : 'ابحث عن محامي موثوق حسب الاختصاص والمدينة'}</p>
          {!loggedIn && !checkingAuth && (
            <p className="font-['Tajawal'] text-sm text-[#F3EEE4] mt-4 bg-white/10 border border-white/20 rounded-md px-4 py-2 inline-block">
              تصفّح المحامين بحرية، ولحجز موعد أو إرسال استشارة <a href="/signup?type=customer" className="text-[#AD8A4E] underline">أنشئ حساباً مجانياً</a> أو <a href="/login" className="text-[#AD8A4E] underline">سجّل الدخول</a>.
            </p>
          )}

          {!loading && (
            <div className="flex flex-wrap gap-3 mt-5">
              <span className="px-4 py-1.5 rounded-full bg-white/10 border border-white/20 font-['Tajawal'] text-xs">{meta.lawyers} محامي</span>
              <span className="px-4 py-1.5 rounded-full bg-white/10 border border-white/20 font-['Tajawal'] text-xs">{meta.firms} مكتب محاماة</span>
              {intl && <span className="px-4 py-1.5 rounded-full bg-white/10 border border-white/20 font-['Tajawal'] text-xs">{availableCountries.length} دولة</span>}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10 flex-1 w-full">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
          <div className="flex bg-white border border-[#D8D2C4] rounded-md p-1 w-fit">
            <button onClick={function () { setViewMode('individuals') }} className={"px-5 py-2 rounded font-['Tajawal'] text-sm font-medium transition " + (viewMode === 'individuals' ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'text-[#4A473F]')}>
              محامون أفراد{!loading ? ' (' + meta.lawyers + ')' : ''}
            </button>
            <button onClick={function () { setViewMode('firms') }} className={"px-5 py-2 rounded font-['Tajawal'] text-sm font-medium transition " + (viewMode === 'firms' ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'text-[#4A473F]')}>
              مكاتب محاماة{!loading ? ' (' + meta.firms + ')' : ''}
            </button>
          </div>

          <div className="flex items-center gap-4">
          {intl ? (
            <button onClick={function () { switchSection(false) }} className="font-['Tajawal'] text-xs text-[#4A473F] hover:text-[#AD8A4E] transition">→ محامو الأردن</button>
          ) : (
            <button onClick={function () { switchSection(true) }} className="group flex items-center gap-1.5 font-['Tajawal'] text-xs text-[#4A473F] hover:text-[#AD8A4E] transition" title="محامون ومكاتب خارج الأردن">
              <svg className="w-4 h-4 transition-transform group-hover:rotate-45" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18" /></svg>
              دولي{intlCount > 0 ? ' (' + intlCount + ')' : ''} ←
            </button>
          )}
          <div className="flex bg-white border border-[#D8D2C4] rounded-md p-1">
            <button onClick={function () { setLayout('cards') }} className={"px-4 py-1.5 rounded font-['Tajawal'] text-sm transition " + (layout === 'cards' ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'text-[#4A473F]')}>▦ بطاقات</button>
            <button onClick={function () { setLayout('list') }} className={"px-4 py-1.5 rounded font-['Tajawal'] text-sm transition " + (layout === 'list' ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'text-[#4A473F]')}>☰ قائمة</button>
          </div>
          </div>
        </div>

        <div className="bg-white border border-[#D8D2C4] rounded-2xl p-5 mb-6 shadow-sm">
          <div className="relative mb-4">
            <svg className="w-5 h-5 text-[#4A473F] absolute right-4 top-1/2 -translate-y-1/2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={function (e) { setSearch(e.target.value) }}
              placeholder={viewMode === 'individuals' ? 'ابحث بالاسم أو الاختصاص أو المدينة...' : 'ابحث باسم المكتب أو المدينة...'}
              className="w-full pr-12 pl-4 py-3 bg-[#F3EEE4] border border-transparent focus:border-[#AD8A4E] focus:outline-none rounded-xl font-['Tajawal'] text-[#1B1A17]"
            />
          </div>

          {viewMode === 'individuals' && (
            <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
              <button
                onClick={function () { setSelectedSpecialty('') }}
                className={"flex-shrink-0 px-4 py-2 rounded-full font-['Tajawal'] text-xs transition " + (selectedSpecialty === '' ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'bg-white border border-[#D8D2C4] text-[#4A473F] hover:border-[#AD8A4E]')}
              >
                كل الاختصاصات
              </button>
              {specialties.map(function (s) {
                const isActive = selectedSpecialty === String(s.id)
                return (
                  <button
                    key={s.id}
                    onClick={function () { setSelectedSpecialty(isActive ? '' : String(s.id)) }}
                    className={"flex-shrink-0 px-4 py-2 rounded-full font-['Tajawal'] text-xs transition " + (isActive ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'bg-white border border-[#D8D2C4] text-[#4A473F] hover:border-[#AD8A4E]')}
                  >
                    {s.name_ar}
                  </button>
                )
              })}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {intl ? (
              <select value={selectedCountry} onChange={function (e) { setSelectedCountry(e.target.value) }} className="px-4 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]">
                <option value="">كل الدول ({availableCountries.length})</option>
                {availableCountries.map(function (c) { return <option key={c} value={c}>{countryName(c)}</option> })}
              </select>
            ) : (
              <select value={selectedCity} onChange={function (e) { setSelectedCity(e.target.value) }} className="px-4 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]">
                <option value="">كل المدن</option>
                {cityOptions.map(function (c) { return <option key={c} value={c}>{c}</option> })}
              </select>
            )}

            {availableLanguages.length > 1 && (
              <select value={selectedLanguage} onChange={function (e) { setSelectedLanguage(e.target.value) }} className="px-4 py-2 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]">
                <option value="">كل اللغات</option>
                {availableLanguages.map(function (code) { return <option key={code} value={code}>{languageName(code)}</option> })}
              </select>
            )}

            {viewMode === 'individuals' && (
              <label className="flex items-center gap-2 font-['Tajawal'] text-sm text-[#4A473F] cursor-pointer">
                <input type="checkbox" checked={onlyAvailable} onChange={function (e) { setOnlyAvailable(e.target.checked) }} />
                المتاحون فقط
              </label>
            )}

            {hasActiveFilters && (
              <button onClick={clearFilters} className="mr-auto font-['Tajawal'] text-xs text-[#AD8A4E] underline">مسح الفلاتر</button>
            )}
          </div>
        </div>

        <div className="bg-[#1B1A17] text-[#F3EEE4] rounded-2xl p-5 mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-['Tajawal'] font-bold mb-1">لا تعرف أي اختصاص تحتاجه؟</p>
            <p className="font-['Tajawal'] text-sm text-[#D8D2C4]">صف مشكلتك للمساعد الذكي وسيقترح عليك الاختصاص المناسب.</p>
          </div>
          <a href="/ai-assistant" className="flex-shrink-0 px-5 py-2 bg-[#AD8A4E] text-white hover:bg-[#c49b58] transition rounded-md font-['Tajawal'] text-sm">جرّب المساعد الذكي</a>
        </div>

        {!loading && (
          <p className="font-['Tajawal'] text-xs text-[#4A473F] mb-4">
            {resultsCount} {viewMode === 'individuals' ? 'محامي' : 'مكتب'}
          </p>
        )}

        {(loading || listLoading) && (
          <div className={layout === 'cards' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5' : ''}>
            {[1, 2, 3, 4, 5, 6].map(function (i) {
              return <div key={i} className={(layout === 'cards' ? 'h-72' : 'h-20 mb-3') + ' bg-white border border-[#D8D2C4] rounded-2xl animate-pulse'}></div>
            })}
          </div>
        )}

        {!loading && !listLoading && viewMode === 'individuals' && (
          <div>
            {filteredLawyers.length === 0 && renderEmpty(intl && meta.lawyers === 0 ? 'لا يوجد محامون خارج الأردن بعد' : 'لا يوجد محامون مطابقون')}
            <div className={gridClass}>
              {filteredLawyers.map(renderLawyerCard)}
            </div>
          </div>
        )}

        {!loading && !listLoading && viewMode === 'firms' && (
          <div>
            {filteredFirms.length === 0 && renderEmpty(meta.firms === 0 ? (intl ? 'لا توجد مكاتب خارج الأردن بعد' : 'لا يوجد مكاتب محاماة مسجلة حالياً') : 'لا توجد مكاتب مطابقة')}
            <div className={gridClass}>
              {filteredFirms.map(renderFirmCard)}
            </div>
          </div>
        )}

        {!loading && !listLoading && hasMore && (
          <div className="text-center mt-8">
            <button onClick={loadMore} disabled={loadingMore} className="px-6 py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal'] text-sm hover:bg-[#AD8A4E] transition disabled:opacity-60">
              {loadingMore ? 'جاري التحميل...' : 'عرض المزيد'}
            </button>
          </div>
        )}
      </div>

      <Footer variant="customer" />
    </div>
  )
}