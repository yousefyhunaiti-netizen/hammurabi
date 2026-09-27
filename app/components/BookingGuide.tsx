// Shown on /lawyers/[id] and /firms/[id] to help customers choose between
// a quick written consultation and a full appointment.

export default function BookingGuide() {
  return (
    <div className="bg-[#F3EEE4] border border-[#D8D2C4] rounded-md p-4 mb-4">
      <p className="font-['Tajawal'] font-bold text-sm text-[#1B1A17] mb-3">أيهما يناسبك؟</p>
      <div className="mb-3">
        <p className="font-['Tajawal'] font-bold text-xs text-[#AD8A4E] mb-1">استشارة سريعة</p>
        <p className="font-['Tajawal'] text-xs text-[#4A473F] leading-relaxed">لسؤال محدد تكفيه إجابة مكتوبة، مثل معرفة حقك في موقف معيّن أو خطوتك التالية.</p>
      </div>
      <div>
        <p className="font-['Tajawal'] font-bold text-xs text-[#AD8A4E] mb-1">حجز موعد</p>
        <p className="font-['Tajawal'] text-xs text-[#4A473F] leading-relaxed">لقضية تحتاج مراجعة مستندات، أو نقاشاً مفصّلاً، أو متابعة أمام المحكمة.</p>
      </div>
    </div>
  )
}

export function ConsultationFeeNote() {
  return (
    <p className="font-['Tajawal'] text-xs text-[#4A473F] leading-relaxed">
      رسوم الاستشارة السريعة تغطي الإجابة المكتوبة فقط. إذا وجد المحامي أن مسألتك تحتاج دراسة أعمق، سيوصيك بحجز موعد، ويُتفق على الأتعاب حينها.
    </p>
  )
}
