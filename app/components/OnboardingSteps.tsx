// The three sign-up steps for new lawyers and firms:
// ١ معلوماتك ← ٢ المراجعة ← ٣ الاشتراك
export default function OnboardingSteps(props: { current: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, digit: '١', label: 'معلوماتك' },
    { n: 2, digit: '٢', label: 'المراجعة' },
    { n: 3, digit: '٣', label: 'الاشتراك' },
  ]

  return (
    <ol className="flex items-center justify-center gap-2 sm:gap-3 mb-8 hm-no-reveal" aria-label="خطوات إنشاء الحساب">
      {steps.map(function (step, i) {
        const done = step.n < props.current
        const on = step.n === props.current
        return (
          <li key={step.n} className="flex items-center gap-2 sm:gap-3">
            <span className="flex items-center gap-2" aria-current={on ? 'step' : undefined}>
              <span className={"w-8 h-8 rounded-full flex items-center justify-center font-['Tajawal'] font-bold text-sm transition-colors duration-500 " + (on ? 'bg-[#AD8A4E] text-white shadow-[0_0_0_4px_rgba(173,138,78,.2)]' : done ? 'bg-[#1B1A17] text-[#D6BC8A]' : 'bg-white text-[#8A8474] border border-[#D8D2C4]')}>
                {done ? '✓' : step.digit}
              </span>
              <span className={"font-['Tajawal'] text-sm " + (on ? 'font-bold text-[#1B1A17]' : 'text-[#4A473F]')}>{step.label}</span>
            </span>
            {i < steps.length - 1 && (
              <span className="text-[#AD8A4E] text-sm" aria-hidden="true">←</span>
            )}
          </li>
        )
      })}
    </ol>
  )
}
