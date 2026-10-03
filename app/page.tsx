'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from './lib/supabase'
import { getLawyerBadgeCount, getFirmBadgeCount } from './lib/badges'
import Footer from './components/Footer'
import HeaderLines from './components/HeaderLines'
import './home.css'

type AccountKind = 'guest' | 'customer' | 'lawyer' | 'firm'

type Audience = 'customer' | 'lawyer' | 'firm' | 'trainee'

const AUDIENCES: { key: Audience | 'all'; label: string }[] = [
  { key: 'all', label: 'الكل' },
  { key: 'customer', label: 'للعملاء' },
  { key: 'lawyer', label: 'للمحامين' },
  { key: 'firm', label: 'للمكاتب' },
  { key: 'trainee', label: 'للمتدربين' },
]

// Everything Hammurabi offers beyond Laila's story, and who each one is for.
const SERVICES: { title: string; text: string; icon: string; for: Audience[] }[] = [
  { title: 'المساعد الذكي', text: 'للعميل: شرح بسيط واقتراح الاختصاص. للمحامي: إجابات معمّقة كزميل مهنة.', icon: 'M12 3l1.8 4.7L18.5 9l-4.7 1.8L12 15.5l-1.8-4.7L5.5 9l4.7-1.3L12 3zM5 17l.9 2.1L8 20l-2.1.9L5 23l-.9-2.1L2 20l2.1-.9L5 17z', for: ['customer', 'lawyer', 'firm', 'trainee'] },
  { title: 'التوظيف والتدريب', text: 'فرص عمل للمحامين وفرص تدريب للمتدربين، ينشرها أي محامي أو مكتب، وتتابع طلباتك من «طلباتي».', icon: 'M4 8h16v11H4zM9 8V5h6v3M4 13h16', for: ['lawyer', 'firm', 'trainee'] },
  { title: 'حساب المحامي المتدرب', text: 'سجّل كمحامي متدرب، تصفّح فرص التدريب وقدّم عليها، وانتقل لحساب محامي عند انتهاء تدريبك.', icon: 'M12 4l9 4-9 4-9-4 9-4zM7 10v5c0 1.5 2.2 3 5 3s5-1.5 5-3v-5', for: ['trainee'] },
  { title: 'مقالات قانونية', text: 'مقالات يكتبها محامون ومكاتب موثّقون لتزيد معرفتك القانونية.', icon: 'M5 4h10l4 4v12H5zM9 12h6M9 16h6', for: ['customer', 'lawyer', 'firm'] },
  { title: 'تقييم المحامين', text: 'بعد موعدك أو استشارتك المدفوعة، قيّم المحامي أو المكتب ليستفيد غيرك.', icon: 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7L12 3z', for: ['customer'] },
  { title: 'مجتمع المحامين', text: 'انشر، علّق، وتبادل الخبرة مع زملائك، باسمك أو باسم مكتبك.', icon: 'M8 11a3 3 0 100-6 3 3 0 000 6zM16 11a3 3 0 100-6 3 3 0 000 6zM2 20c0-3 2.7-5 6-5s6 2 6 5M14 15c3.3 0 8 1 8 5', for: ['lawyer', 'firm', 'trainee'] },
  { title: 'المكتبة القانونية', text: 'القوانين والقرارات التي تحتاجها، مع المفضلة وملخص بالذكاء الاصطناعي وربط بالقضية.', icon: 'M4 5h5v15H4zM10 5h5v15h-5zM16 6l4 1-3 13-4-1z', for: ['lawyer', 'firm'] },
  { title: 'الوكالات', text: 'سجل وكالاتك العامة والخاصة ووكالات المحامين، مع تواريخ التصديق والانتهاء.', icon: 'M6 3h9l4 4v14H6zM9 13l2 2 4-4', for: ['lawyer', 'firm'] },
  { title: 'الرسائل', text: 'مراسلة مباشرة بين المحامين والمكاتب داخل المنصة.', icon: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z', for: ['lawyer', 'firm'] },
  { title: 'الحساب الخاص', text: 'لمحامي المكتب: مساحة مستقلة لقضاياه وموكليه الخاصين لا يراها المكتب، بضغطة واحدة.', icon: 'M6 11h12v9H6zM9 11V8a3 3 0 016 0v3', for: ['lawyer'] },
  { title: 'محامون بلا أسماء', text: 'للمكتب: اعرض المكتب للعملاء دون أسماء محاميه، والحجز يذهب للمحامي المختص تلقائياً.', icon: 'M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6', for: ['firm'] },
]

export default function HomePage() {
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [account, setAccount] = useState<AccountKind>('guest')
  const [audience, setAudience] = useState<Audience | 'all'>('all')
  const [menuOpen, setMenuOpen] = useState(false)
  const [totalUnread, setTotalUnread] = useState(0)
  const [badgeCount, setBadgeCount] = useState(0)

  const supabase = createClient()
  const router = useRouter()
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(function () {
    function countConversations(rows: { sender_lawyer_id: number | null; sender_firm_id: number | null }[]) {
      const senders = new Set(rows.map(function (m) {
        return m.sender_lawyer_id ? 'lawyer-' + m.sender_lawyer_id : 'firm-' + m.sender_firm_id
      }))
      return senders.size
    }

    async function loadData() {
      const userResult = await supabase.auth.getUser()
      const user = userResult.data.user

      if (user) {
        const customerResult = await supabase.from('customers').select('id').eq('user_id', user.id).maybeSingle()
        if (customerResult.data) {
          setAccount('customer')
        } else {
          const lawyerResult = await supabase.from('lawyers').select('id').eq('user_id', user.id).maybeSingle()
          if (lawyerResult.data) {
            setAccount('lawyer')
            const unreadResult = await supabase.from('lawyer_messages').select('sender_lawyer_id, sender_firm_id').eq('recipient_lawyer_id', lawyerResult.data.id).eq('is_read', false)
            setTotalUnread(countConversations(unreadResult.data || []))
            setBadgeCount(await getLawyerBadgeCount(supabase, lawyerResult.data.id))
          } else {
            const firmResult = await supabase.from('firms').select('id').eq('user_id', user.id).maybeSingle()
            if (firmResult.data) {
              setAccount('firm')
              const unreadResult = await supabase.from('lawyer_messages').select('sender_lawyer_id, sender_firm_id').eq('recipient_firm_id', firmResult.data.id).eq('is_read', false)
              setTotalUnread(countConversations(unreadResult.data || []))
              setBadgeCount(await getFirmBadgeCount(supabase, firmResult.data.id))
            }
          }
        }
      }

      setCheckingAuth(false)

    }

    loadData()
  }, [])

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

  // The story's motion: each act plays its three features in turn,
  // and the case file travels down the gold spine as you scroll.
  useEffect(function () {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const STEP_MS = 4200
    const cleanups: (() => void)[] = []

    document.querySelectorAll('.hm-act').forEach(function (act) {
      const feats = Array.prototype.slice.call(act.querySelectorAll('.hm-feat')) as HTMLElement[]
      const screens = Array.prototype.slice.call(act.querySelectorAll('.hm-screen')) as HTMLElement[]
      let current = 0
      let timer: ReturnType<typeof setTimeout> | undefined
      let resume: ReturnType<typeof setTimeout> | undefined
      let visible = false
      let paused = false

      function schedule() {
        clearTimeout(timer)
        if (reduce || !visible || paused) return
        timer = setTimeout(function () { show((current + 1) % feats.length) }, STEP_MS)
      }

      function show(n: number) {
        current = n
        feats.forEach(function (f, k) {
          f.classList.toggle('on', k === n)
          f.setAttribute('aria-pressed', k === n ? 'true' : 'false')
          f.classList.remove('run')
        })
        screens.forEach(function (s, k) {
          s.classList.toggle('on', k === n)
          s.classList.remove('play')
        })
        if (!reduce) {
          void screens[n].offsetWidth
          screens[n].classList.add('play')
          if (visible && !paused) {
            void feats[n].offsetWidth
            feats[n].classList.add('run')
          }
        }
        schedule()
      }

      const clickHandlers = feats.map(function (f, k) {
        function onClick() {
          paused = true
          clearTimeout(resume)
          show(k)
          resume = setTimeout(function () { paused = false; show(current) }, 12000)
        }
        f.addEventListener('click', onClick)
        return onClick
      })

      const observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          const was = visible
          visible = e.isIntersecting
          if (visible && !was) show(current)
          if (!visible) clearTimeout(timer)
        })
      }, { threshold: 0.35 })
      observer.observe(act)

      cleanups.push(function () {
        observer.disconnect()
        clearTimeout(timer)
        clearTimeout(resume)
        feats.forEach(function (f, k) { f.removeEventListener('click', clickHandlers[k]) })
      })
    })

    const acts = document.getElementById('hm-acts')
    const actEls = ['client', 'lawyer', 'firm'].map(function (id) { return document.getElementById(id) })
    const trackBtns = Array.prototype.slice.call(document.querySelectorAll('.hm-tracker button')) as HTMLElement[]
    const bead = document.querySelector('.hm-bead') as HTMLElement | null
    let active = -1

    function placeBead(i: number) {
      const b = trackBtns[i]
      if (!b || !bead) return
      bead.style.left = b.offsetLeft + 'px'
      bead.style.width = b.offsetWidth + 'px'
    }

    function onScroll() {
      if (!acts) return
      const r = acts.getBoundingClientRect()
      const mid = window.innerHeight * 0.5
      const p = Math.min(1, Math.max(0, (mid - r.top) / r.height))
      acts.style.setProperty('--p', p.toFixed(4))
      let best = 0
      let bestD = Infinity
      actEls.forEach(function (el, i) {
        if (!el) return
        const er = el.getBoundingClientRect()
        const d = Math.abs(er.top + er.height / 2 - mid)
        if (d < bestD) { bestD = d; best = i }
      })
      if (best !== active) {
        active = best
        trackBtns.forEach(function (b, i) { b.classList.toggle('on', i === best) })
        placeBead(best)
      }
    }

    const trackHandlers = trackBtns.map(function (b) {
      function onClick() {
        const target = document.getElementById(b.getAttribute('data-go') || '')
        if (target) target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' })
      }
      b.addEventListener('click', onClick)
      return onClick
    })

    function onResize() {
      placeBead(Math.max(active, 0))
      onScroll()
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    placeBead(0)
    onScroll()
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { placeBead(Math.max(active, 0)) })
    }

    const stele = document.getElementById('hm-stele')
    let steleObserver: IntersectionObserver | null = null
    if (stele) {
      steleObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            stele.classList.add('lit')
            if (steleObserver) steleObserver.disconnect()
          }
        })
      }, { threshold: 0.4 })
      steleObserver.observe(stele)
    }

    return function () {
      cleanups.forEach(function (fn) { fn() })
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      trackBtns.forEach(function (b, i) { b.removeEventListener('click', trackHandlers[i]) })
      if (steleObserver) steleObserver.disconnect()
    }
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    setAccount('guest')
    setMenuOpen(false)
    router.push('/')
  }

  const loggedIn = account !== 'guest'
  const isPro = account === 'lawyer' || account === 'firm'
  const navLink = "font-['Tajawal'] text-sm hover:text-[#AD8A4E] transition whitespace-nowrap"
  const menuItem = "block px-4 py-3 font-['Tajawal'] text-sm text-[#1B1A17] hover:bg-[#F3EEE4] transition"

  function renderNav() {
    if (checkingAuth) return null

    if (!loggedIn) {
      return (
        <div className="hm-top-actions">
          <a className="hm-btn hm-btn-ghost" href="/login">تسجيل الدخول</a>
          <a className="hm-btn hm-btn-gold" href="/signup">إنشاء حساب</a>
        </div>
      )
    }

    return (
      <div className="flex gap-5 items-center">
        <div className="hidden lg:flex gap-5 items-center">
          {account === 'customer' && <a href="/my-appointments" className={navLink}>مواعيدي</a>}
          {account === 'customer' && <a href="/my-consultations" className={navLink}>استشاراتي</a>}
          {account === 'customer' && <a href="/lawyers" className={navLink}>دليل المحامين</a>}
          {account === 'firm' && <a href="/firm-dashboard" className={navLink}>لوحة التحكم</a>}
          {isPro && <a href="/lawyer-tools" className={navLink}>أدواتي</a>}
          <a href="/ai-assistant" className={navLink}>مساعد ذكي</a>
          {account === 'customer' && <a href="/legal-articles" className={navLink}>مقالات قانونية</a>}
          {isPro && <a href="/community" className={navLink}>المجتمع</a>}
        </div>
        {isPro && (
          <a href="/lawyer-messages" className="relative hover:text-[#AD8A4E] transition" aria-label="الرسائل">
            <svg className="w-5 h-5 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            {totalUnread > 0 && (
              <span className="absolute -top-2 -left-2 bg-[#7A2E2E] text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{totalUnread}</span>
            )}
          </a>
        )}
        <div className="relative" ref={menuRef}>
          <button onClick={function () { setMenuOpen(!menuOpen) }} className="relative w-9 h-9 rounded-full bg-[#AD8A4E] flex items-center justify-center hover:bg-[#c49b58] transition" aria-label="حسابي">
            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.5c-3.3 0-9.8 1.6-9.8 4.9v2.4h19.6v-2.4c0-3.3-6.5-4.9-9.8-4.9z" /></svg>
            {isPro && badgeCount > 0 && (
              <span className="absolute -top-1 -left-1 bg-[#7A2E2E] text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{badgeCount}</span>
            )}
          </button>
          {menuOpen && (
            <div className="absolute left-0 top-full mt-2 w-56 bg-white border border-[#D8D2C4] rounded-md shadow-lg overflow-hidden z-30">
              {account === 'customer' && (
                <div className="lg:hidden">
                  <a href="/my-appointments" className={menuItem}>مواعيدي</a>
                  <a href="/my-consultations" className={menuItem + ' border-t border-[#D8D2C4]'}>استشاراتي</a>
                  <a href="/lawyers" className={menuItem + ' border-t border-[#D8D2C4]'}>دليل المحامين</a>
                  <a href="/ai-assistant" className={menuItem + ' border-t border-[#D8D2C4]'}>مساعد ذكي</a>
                  <a href="/legal-articles" className={menuItem + ' border-t border-[#D8D2C4]'}>مقالات قانونية</a>
                </div>
              )}
              {isPro && (
                <div className="lg:hidden">
                  {account === 'firm' && <a href="/firm-dashboard" className={menuItem}>لوحة التحكم</a>}
                  <a href="/lawyer-tools" className={menuItem + (account === 'firm' ? ' border-t border-[#D8D2C4]' : '')}>أدواتي</a>
                  <a href="/ai-assistant" className={menuItem + ' border-t border-[#D8D2C4]'}>مساعد ذكي</a>
                  <a href="/community" className={menuItem + ' border-t border-[#D8D2C4]'}>المجتمع</a>
                </div>
              )}
              {isPro && <a href="/subscription" className={menuItem + ' border-t border-[#D8D2C4] lg:border-t-0'}>ترقية الاشتراك</a>}
              <a href={account === 'customer' ? '/my-info' : account === 'firm' ? '/firm-info' : '/lawyer-info'} className={menuItem + ' border-t border-[#D8D2C4]' + (account === 'customer' ? ' lg:border-t-0' : '')}>معلوماتي الشخصية</a>
              {isPro && (
                <a href="/lawyer-history" className={'relative ' + menuItem + ' border-t border-[#D8D2C4]'}>
                  المواعيد والاستشارات
                  {badgeCount > 0 && (
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 bg-[#7A2E2E] text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{badgeCount}</span>
                  )}
                </a>
              )}
              <button onClick={handleLogout} className="w-full text-right px-4 py-3 font-['Tajawal'] text-sm text-[#7A2E2E] hover:bg-[#F3EEE4] transition border-t border-[#D8D2C4]">تسجيل الخروج</button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Under each part of the story: sign up as that kind of account, or log in.
  function renderActCta(kind: 'customer' | 'lawyer' | 'firm') {
    if (checkingAuth || loggedIn) return null
    const label = kind === 'customer' ? 'سجّل كعميل' : kind === 'lawyer' ? 'سجّل كمحامي' : 'سجّل مكتبك'
    return (
      <div className="hm-act-cta">
        <a className="hm-btn hm-btn-ink" href={'/signup?type=' + kind}>{label}</a>
        <a className="hm-btn hm-btn-outline" href="/login">تسجيل الدخول</a>
      </div>
    )
  }

  function renderCtas() {
    if (account === 'customer') {
      return (
        <div className="hm-ctas one">
          <a className="hm-btn hm-btn-gold" href="/lawyers">تصفح المحامين</a>
        </div>
      )
    }
    if (account === 'lawyer') {
      return (
        <div className="hm-ctas one">
          <a className="hm-btn hm-btn-gold" href="/lawyer-tools">اذهب إلى أدواتي</a>
        </div>
      )
    }
    if (account === 'firm') {
      return (
        <div className="hm-ctas one">
          <a className="hm-btn hm-btn-gold" href="/firm-dashboard">لوحة تحكم المكتب</a>
        </div>
      )
    }
    return (
      <>
        <div className="hm-ctas">
          <a className="hm-btn hm-btn-gold" href="/lawyers">أبحث عن محامي</a>
          <a className="hm-btn hm-btn-line" href="/signup?type=lawyer">أنا محامي: أنشئ حسابي</a>
          <a className="hm-btn hm-btn-line" href="/signup?type=firm">سجّل مكتبك</a>
        </div>
        <p className="hm-trainee">هل أنت محامي متدرب؟ <a href="/signup?type=lawyer&trainee=1">أنشئ حسابك وتصفّح فرص التدريب ←</a></p>
      </>
    )
  }

  return (
    <div dir="rtl" lang="ar" className="hm-home">
      <header className="hm-top hm-header">
        <div className="hm-wrap">
          <a href="/"><img className="hm-top-logo" src="/logo.png" alt="حمورابي" /></a>
          {renderNav()}
        </div>
      </header>

      <section className="hm-hero">
        <HeaderLines />
        <div className="hm-wrap hm-hero-inner">
          <p className="hm-eyebrow">منصة قانونية أردنية</p>
          <h1>كل ما يخص القانون،<br /><span>في مكان واحد.</span></h1>
          <p className="hm-lede">حمورابي يجمع العميل والمحامي ومكتب المحاماة على منصة واحدة: من أول سؤال، إلى الموعد، إلى إدارة القضية حتى صدور الحكم.</p>
          <div className="hm-doors-head">
            <h2>كيف يعمل حمورابي ليلبّي احتياجات الجميع؟</h2>
            <p>اختر بابك وشاهد ما يقدّمه لك، أو تابع القصة كاملة.</p>
          </div>
          <div className="hm-doors">
            <a className="hm-door" href="#client">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" /></svg>
              <span className="hm-door-k">أنا عميل</span>
              <span className="hm-door-v">أبحث عن محامي موثوق أو جواب سريع لمشكلتي</span>
              <span className="hm-door-go">شاهد كيف ↓</span>
            </a>
            <a className="hm-door" href="#lawyer">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18M5 7h14M7 7l-3 7a3 3 0 0 0 6 0L7 7zM17 7l-3 7a3 3 0 0 0 6 0l-3-7zM8 21h8" /></svg>
              <span className="hm-door-k">أنا محامي</span>
              <span className="hm-door-v">أدير قضاياي وموكليّ ومواعيدي وماليتي في مكان واحد</span>
              <span className="hm-door-go">شاهد كيف ↓</span>
            </a>
            <a className="hm-door" href="#firm">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6M9 11h.01M15 11h.01" /></svg>
              <span className="hm-door-k">مكتب محاماة</span>
              <span className="hm-door-v">أتابع عمل فريقي وأراجعه وأوظّف محامين جدد</span>
              <span className="hm-door-go">شاهد كيف ↓</span>
            </a>
          </div>
        </div>
      </section>

      <section className="hm-story" id="story">
        <div className="hm-wrap">
          <header className="hm-story-head">
            <p className="hm-eyebrow">قضية واحدة، ثلاث زوايا</p>
            <h2>تابع ملف ليلى من أول سؤال حتى الحكم</h2>
            <p className="hm-sub">ليلى مستأجرة في عمّان، وصلها إنذار بالإخلاء قبل انتهاء عقدها. هكذا يعمل حمورابي لها، ولمحاميتها، وللمكتب الذي تعمل فيه.</p>
          </header>

          <nav className="hm-tracker" aria-label="مراحل القصة">
            <div className="hm-tracker-in">
              <span className="hm-bead" aria-hidden="true"></span>
              <button type="button" data-go="client" className="on">العميل: ليلى</button>
              <button type="button" data-go="lawyer">المحامية: سارة</button>
              <button type="button" data-go="firm">المكتب</button>
            </div>
          </nav>

          <div className="hm-acts" id="hm-acts">
            <div className="hm-spine" aria-hidden="true">
              <div className="hm-spine-fill"></div>
            </div>
            <div className="hm-token" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" /></svg>
            </div>

            {/* ACT 1: client */}
            <article className="hm-act" id="client">
              <div className="hm-act-text">
                <p className="hm-act-kicker"><b>١</b>العميل</p>
                <h3>ليلى تلقّت إنذاراً بالإخلاء</h3>
                <p className="hm-act-lede">لا تعرف من أين تبدأ. خلال دقائق تفهم وضعها، وتجد محامية مختصة، وتحجز موعداً من هاتفها.</p>
                <ul className="hm-features">
                  <li><button type="button" className="hm-feat on"><span className="hm-feat-t">مساعد ذكي</span><span className="hm-feat-d">يشرح المشكلة بلغة بسيطة ويقترح الاختصاص المناسب</span><span className="hm-bar"><i></i></span></button></li>
                  <li><button type="button" className="hm-feat"><span className="hm-feat-t">دليل المحامين والحجز</span><span className="hm-feat-d">محامون موثوقون حسب الاختصاص والمدينة، وموعد حضوري أو عبر الفيديو</span><span className="hm-bar"><i></i></span></button></li>
                  <li><button type="button" className="hm-feat"><span className="hm-feat-t">استشارة سريعة ومقالات</span><span className="hm-feat-d">سؤال مكتوب وجواب من محامي، ومقالات قانونية يكتبها محامون</span><span className="hm-bar"><i></i></span></button></li>
                </ul>
                {renderActCta('customer')}
              </div>
              <div className="hm-act-stage">
                <div className="hm-phone">
                  <div className="hm-notch"></div>
                  <div className="hm-screens">
                    <div className="hm-screen on">
                      <div className="hm-app-bar">مساعد حمورابي الذكي <small>متاح 24/7</small></div>
                      <div className="hm-chat">
                        <p className="hm-bubble me">صاحب البيت بدو يطلعني من الشقة قبل ما يخلص العقد، شو بقدر أعمل؟</p>
                        <div className="hm-slot">
                          <p className="hm-bubble bot hm-typing"><i></i><i></i><i></i></p>
                          <p className="hm-bubble bot hm-reply">ما دمتِ ملتزمة بشروط العقد ودفع الأجرة، لا يحق للمؤجر إخلاؤك قبل انتهاء مدته. احتفظي بالإنذار ولا تغادري قبل استشارة محامي.<br /><span className="hm-pill gold">الاختصاص المقترح: حقوقي</span></p>
                        </div>
                      </div>
                    </div>
                    <div className="hm-screen">
                      <div className="hm-app-bar">دليل المحامين <small>حقوقي · عمّان</small></div>
                      <div className="hm-panel">
                        <div className="hm-lawyer-card">
                          <span className="hm-avatar">س</span>
                          <div><strong>أ. سارة</strong><br /><span className="hm-quiet">حقوقي · 12 سنة خبرة · ★ 4.9</span></div>
                        </div>
                      </div>
                      <div className="hm-seg"><span>حضوري</span><span className="on">عبر الفيديو</span></div>
                      <div className="hm-days"><span>الأحد 12</span><span className="on">الاثنين 13</span><span>الثلاثاء 14</span></div>
                      <div className="hm-slots"><span>10:00</span><span className="pick">11:30</span><span className="taken">13:00</span><span>14:30</span></div>
                      <div className="hm-toast"><span>✓</span><span>تم الحجز، ورابط الاجتماع جاهز في «مواعيدي»</span></div>
                    </div>
                    <div className="hm-screen">
                      <div className="hm-app-bar">استشاراتي <small>مكتب المحاماة</small></div>
                      <div className="hm-panel">
                        <div className="hm-row"><strong>هل يحق لي استرجاع مبلغ التأمين عند الخروج؟</strong></div>
                        <div className="hm-status-swap"><span className="hm-pill wine before">بانتظار الإجابة</span><span className="hm-pill olive after">تمت الإجابة</span></div>
                        <div className="hm-blur-lines"><span className="hm-skel"></span><span className="hm-skel" style={{ width: '85%' }}></span><span className="hm-skel" style={{ width: '60%' }}></span></div>
                        <div className="hm-pay">ادفع 10 د.أ لعرض الإجابة</div>
                      </div>
                      <div className="hm-panel">
                        <span className="hm-quiet">مقالات قانونية</span>
                        <strong>حقوق المستأجر عند انتهاء عقد الإيجار</strong>
                        <span className="hm-quiet">بقلم محامية في المكتب · قراءة 4 دقائق</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </article>

            {/* ACT 2: lawyer */}
            <article className="hm-act flip" id="lawyer">
              <div className="hm-act-text">
                <p className="hm-act-kicker"><b>٢</b>المحامي</p>
                <h3>المحامية سارة تستلم القضية</h3>
                <p className="hm-act-lede">الموعد يصل إلى أجندتها، والقضية تُفتح بملفاتها وجلساتها، والفاتورة تُرسل وتُتابَع حتى الدفع.</p>
                <ul className="hm-features">
                  <li><button type="button" className="hm-feat on"><span className="hm-feat-t">ملفات القضايا</span><span className="hm-feat-d">القضايا والجلسات والملفات والوكالات في مكان واحد</span><span className="hm-bar"><i></i></span></button></li>
                  <li><button type="button" className="hm-feat"><span className="hm-feat-t">الأجندة</span><span className="hm-feat-d">الجلسات ومواعيد العملاء والإجراءات المطلوبة في تقويم واحد</span><span className="hm-bar"><i></i></span></button></li>
                  <li><button type="button" className="hm-feat"><span className="hm-feat-t">الفواتير والمالية</span><span className="hm-feat-d">فواتير وتذكير عبر واتساب، ودخلك ومصاريفك وأرباحك الحقيقية</span><span className="hm-bar"><i></i></span></button></li>
                </ul>
                {renderActCta('lawyer')}
              </div>
              <div className="hm-act-stage">
                <div className="hm-laptop">
                  <div className="hm-lid">
                    <div className="hm-screens">
                      <div className="hm-screen on">
                        <div className="hm-app-bar">ملفات القضايا <small className="hm-num">12 قضية نشطة</small></div>
                        <div className="hm-kanban">
                          <div className="hm-col"><h4>بداية</h4>
                            <div className="hm-kcard hot"><strong className="hm-num">قضية 2471/2026</strong><span>إخلاء مأجور · ليلى</span><span className="hm-pill gold hm-num">الجلسة القادمة 14/10</span></div>
                            <div className="hm-kcard ghost"><strong className="hm-num">قضية 1980/2026</strong><span>مطالبة مالية</span></div>
                          </div>
                          <div className="hm-col"><h4>استئناف</h4>
                            <div className="hm-kcard ghost"><strong className="hm-num">قضية 1122/2025</strong><span>فسخ عقد</span></div>
                          </div>
                          <div className="hm-col"><h4>تمييز</h4>
                            <div className="hm-kcard ghost"><strong className="hm-num">قضية 905/2024</strong><span>تعويض</span></div>
                          </div>
                        </div>
                      </div>
                      <div className="hm-screen">
                        <div className="hm-app-bar">أجندتي <small>تشرين الأول 2026</small></div>
                        <div className="hm-cal-wrap">
                          <div className="hm-cal">
                            <b>ح</b><b>ن</b><b>ث</b><b>ر</b><b>خ</b><b>ج</b><b>س</b>
                            <span className="dim">27</span><span className="dim">28</span><span className="dim">29</span><span className="dim">30</span><span>1</span><span>2</span><span>3</span>
                            <span>4</span><span>5</span><span>6</span><span>7</span><span>8</span><span>9</span><span>10</span>
                            <span>11</span><span>12</span><span>13</span><span className="hit">14</span><span>15</span><span>16</span><span>17</span>
                            <span>18</span><span>19</span><span>20</span><span>21</span><span>22</span><span>23</span><span>24</span>
                          </div>
                          <div className="hm-agenda">
                            <strong>الأربعاء 14</strong>
                            <div className="hm-panel"><span className="hm-num"><strong>9:30</strong> جلسة</span><span className="hm-quiet">محكمة بداية عمّان · قضية 2471</span></div>
                            <div className="hm-panel"><span className="hm-num"><strong>11:30</strong> موعد فيديو</span><span className="hm-quiet">ليلى · رابط الاجتماع جاهز</span></div>
                          </div>
                        </div>
                      </div>
                      <div className="hm-screen hm-inv">
                        <div className="hm-app-bar">الفواتير والمالية <small>هذا الشهر</small></div>
                        <div className="hm-tiles">
                          <div className="hm-tile"><span className="hm-quiet">الدخل</span><strong>3,450</strong></div>
                          <div className="hm-tile"><span className="hm-quiet">المصاريف</span><strong>1,120</strong></div>
                          <div className="hm-tile"><span className="hm-quiet">صافي الربح</span><strong>2,330</strong></div>
                        </div>
                        <div className="hm-money-wrap">
                          <div className="hm-panel">
                            <div className="hm-row"><strong>ليلى</strong><span className="hm-num">250 د.أ</span></div>
                            <div className="hm-status-swap"><span className="hm-pill wine before">غير مدفوعة</span><span className="hm-pill olive after">مدفوعة</span></div>
                            <div className="hm-wa">مكتب المحامية سارة: تذكير بفاتورة بقيمة 250 د.أ</div>
                          </div>
                          <div className="hm-bars" aria-hidden="true"><i style={{ height: '38%' }}></i><i style={{ height: '52%' }}></i><i style={{ height: '45%' }}></i><i style={{ height: '66%' }}></i><i style={{ height: '58%' }}></i><i style={{ height: '84%' }}></i></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="hm-base"></div>
                </div>
              </div>
            </article>

            {/* ACT 3: firm */}
            <article className="hm-act" id="firm">
              <div className="hm-act-text">
                <p className="hm-act-kicker"><b>٣</b>المكتب</p>
                <h3>المكتب يتابع ملف ليلى</h3>
                <p className="hm-act-lede">سارة تعمل ضمن مكتب. المكتب يرى قضية ليلى بين قضايا فريقه، ويراجع الإجابة على سؤالها قبل أن تصلها، ويتأكد أن الرد وصلها في الوقت المحدد.</p>
                <ul className="hm-features">
                  <li><button type="button" className="hm-feat on"><span className="hm-feat-t">عمل الفريق في مكان واحد</span><span className="hm-feat-d">قضية ليلى بين قضايا الفريق ومواعيده وفواتيره، مع فلتر لكل محامي</span><span className="hm-bar"><i></i></span></button></li>
                  <li><button type="button" className="hm-feat"><span className="hm-feat-t">مراجعة المحامي الأقدم</span><span className="hm-feat-d">إجابة سؤال ليلى تمر على محامي أقدم قبل أن تصلها</span><span className="hm-bar"><i></i></span></button></li>
                  <li><button type="button" className="hm-feat"><span className="hm-feat-t">أوقات الاستجابة</span><span className="hm-feat-d">وقت محدد للرد على كل عميل، وتنبيه لك وللمحامي عند التأخير</span><span className="hm-bar"><i></i></span></button></li>
                </ul>
                {renderActCta('firm')}
              </div>
              <div className="hm-act-stage">
                <div className="hm-browser">
                  <div className="hm-browser-bar"><i></i><i></i><i></i><span>hammurabi · firm-dashboard</span></div>
                  <div className="hm-screens">
                    <div className="hm-screen on">
                      <div className="hm-app-bar">فريق المكتب <small>4 محامين</small></div>
                      <div className="hm-roster"><span className="hm-avatar">خ</span><span className="hm-avatar sel">س</span><span className="hm-avatar">ر</span><span className="hm-avatar">م</span></div>
                      <div className="hm-select"><span className="hm-status-swap hm-swap-name"><span className="before">جميع المحامين</span><span className="after">سارة</span></span><span>▾</span></div>
                      <div className="hm-table">
                        <div className="hm-tr head"><span>المحامي</span><span>القضية</span><span>الجلسة</span></div>
                        <div className="hm-tr hot"><span>سارة</span><span>2471 · إخلاء مأجور (ليلى)</span><span className="hm-num">14/10</span></div>
                        <div className="hm-tr other"><span>خالد</span><span>1650 · شيكات</span><span className="hm-num">16/10</span></div>
                        <div className="hm-tr"><span>سارة</span><span>1980 · مطالبة مالية</span><span className="hm-num">21/10</span></div>
                        <div className="hm-tr other"><span>ريم</span><span>2102 · نفقة</span><span className="hm-num">22/10</span></div>
                      </div>
                    </div>
                    <div className="hm-screen">
                      <div className="hm-app-bar">إجابات بانتظار المراجعة <small>وقت المراجعة: 6 ساعات</small></div>
                      <div className="hm-panel">
                        <div className="hm-row"><strong>سؤال ليلى: استرجاع مبلغ التأمين</strong><span className="hm-pill gold">بانتظار المراجعة</span></div>
                        <span className="hm-quiet">إجابة المحامية ريم، قبل أن تصل لليلى</span>
                        <div className="hm-blur-lines clear"><span className="hm-skel"></span><span className="hm-skel" style={{ width: '90%' }}></span><span className="hm-skel" style={{ width: '70%' }}></span></div>
                        <div className="hm-assign"><span className="hm-quiet">إسناد المراجعة إلى:</span><span className="hm-chipbtn sel">خالد (أقدم)</span><span className="hm-chipbtn">سارة (أقدم)</span></div>
                      </div>
                      <span className="hm-stamp">اعتُمدت وأُرسلت لليلى ✓</span>
                    </div>
                    <div className="hm-screen">
                      <div className="hm-app-bar">أوقات الاستجابة (SLA) <small>الرد خلال 24 ساعة</small></div>
                      <div className="hm-panel">
                        <div className="hm-row"><strong>سؤال ليلى</strong><span className="hm-pill olive">أُرسل الرد ✓</span></div>
                        <div className="hm-sla"><i style={{ width: '38%' }}></i></div>
                        <span className="hm-quiet hm-num">رُدّ عليه خلال 9 ساعات من أصل 24</span>
                      </div>
                      <div className="hm-panel">
                        <div className="hm-row"><strong>سؤال عميل آخر</strong><span className="hm-pill gold hm-num">متبقٍ 3 ساعات</span></div>
                        <div className="hm-sla warn"><i style={{ width: '88%' }}></i></div>
                      </div>
                      <div className="hm-panel hm-late">
                        <div className="hm-row"><strong>سؤال متأخر</strong><span className="hm-pill wine">تجاوز الوقت المحدد</span></div>
                        <span className="hm-quiet">تنبيه للمحامي المسؤول وللمكتب</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="hm-more" id="services">
        <div className="hm-wrap">
          <header className="hm-story-head">
            <p className="hm-eyebrow">أكثر من قصة ليلى</p>
            <h2>خدمات حمورابي لكل واحد منكم</h2>
            <p className="hm-sub">اختر من أنت لترى ما يناسبك.</p>
          </header>
          <div className="hm-chips" role="tablist" aria-label="لمن الخدمة">
            {AUDIENCES.map(function (a) {
              const count = a.key === 'all' ? SERVICES.length : SERVICES.filter(function (x) { return x.for.indexOf(a.key as Audience) !== -1 }).length
              return (
                <button key={a.key} type="button" role="tab" aria-selected={audience === a.key} className={audience === a.key ? 'on' : ''} onClick={function () { setAudience(a.key) }}>
                  {a.label} <span className="hm-num">{count}</span>
                </button>
              )
            })}
          </div>
          <div className="hm-services">
            {SERVICES.map(function (x) {
              const shown = audience === 'all' || x.for.indexOf(audience) !== -1
              return (
                <article key={x.title} className={'hm-service' + (shown ? '' : ' off')} aria-hidden={!shown}>
                  <span className="hm-service-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={x.icon} /></svg>
                  </span>
                  <h3>{x.title}</h3>
                  <p>{x.text}</p>
                  <span className="hm-tags">
                    {x.for.map(function (f) {
                      const label = f === 'customer' ? 'عميل' : f === 'lawyer' ? 'محامي' : f === 'firm' ? 'مكتب' : 'متدرب'
                      return <i key={f}>{label}</i>
                    })}
                  </span>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section className="hm-verdict">
        <div className="hm-wrap">
          <div className="hm-stele" id="hm-stele">
            <p className="hm-stele-k hm-engrave">الحكم</p>
            <p className="hm-stele-t hm-engrave">صدر الحكم لصالح ليلى</p>
            <span className="hm-stele-rule"></span>
            <p className="hm-stele-big hm-engrave">القانون أقرب مما تظن.</p>
            <p className="hm-stele-s">{loggedIn ? 'تابع من حيث توقفت' : 'ابدأ من الباب الذي يناسبك'}</p>
            {renderCtas()}
          </div>
        </div>
      </section>

      <div className="mt-auto">
        <Footer variant={account === 'firm' ? 'firm' : account === 'lawyer' ? 'lawyer' : 'customer'} />
      </div>
    </div>
  )
}
