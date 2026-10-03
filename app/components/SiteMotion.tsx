'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

// Cards further down a page slide in gently as they scroll into view.
// Cards already on screen when they appear are left alone, and anything
// inside a header, a pop-up window or a dropdown is never touched.
const CARD_SELECTOR = [
  '[class*="bg-white"][class*="rounded-lg"][class*="border"]',
  '[class*="bg-white"][class*="rounded-xl"]',
  '[class*="bg-white"][class*="rounded-2xl"]',
].join(',')

export default function SiteMotion() {
  const pathname = usePathname()

  useEffect(function () {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const seen = new WeakSet<Element>()
    let timer: ReturnType<typeof setTimeout> | null = null

    const io = new IntersectionObserver(function (entries) {
      let order = 0
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return
        const el = entry.target as HTMLElement
        el.style.transitionDelay = Math.min(order * 70, 280) + 'ms'
        order = order + 1
        el.classList.add('is-in')
        io.unobserve(el)
      })
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 })

    function skip(el: Element) {
      if (el.closest('.hm-header, .hm-home, .hm-no-reveal, [class*="fixed"], [class*="absolute"], [class*="sticky"]')) return true
      // only the outer card of a group of nested cards moves
      let parent = el.parentElement
      while (parent) {
        if (seen.has(parent)) return true
        parent = parent.parentElement
      }
      return false
    }

    function scan() {
      const viewportBottom = window.innerHeight * 0.92
      document.querySelectorAll(CARD_SELECTOR).forEach(function (el) {
        if (seen.has(el)) return
        seen.add(el)
        if (skip(el)) return
        const rect = el.getBoundingClientRect()
        if (rect.height < 40 || rect.top < viewportBottom) return
        el.classList.add('hm-reveal')
        io.observe(el)
      })
    }

    function schedule() {
      if (timer) clearTimeout(timer)
      timer = setTimeout(scan, 120)
    }

    scan()
    const mo = new MutationObserver(schedule)
    mo.observe(document.body, { childList: true, subtree: true })

    return function () {
      if (timer) clearTimeout(timer)
      mo.disconnect()
      io.disconnect()
    }
  }, [pathname])

  return null
}
