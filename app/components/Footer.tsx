type FooterProps = {
  variant?: 'customer' | 'lawyer' | 'firm'
}

export default function Footer(props: FooterProps) {  return (
    <footer className="bg-[#3D2B1F] text-[#D8C9B8] py-3 px-6">
      <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-2 font-['Tajawal'] text-xs">
        <div className="flex items-center gap-3">
          <span>© 2026 حمورابي</span>
          <a href="/terms" className="hover:text-white transition">الشروط والأحكام</a>
        </div>

        <div className="flex items-center gap-3">
          <a href="https://linkedin.com/company/hammurabi" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">LinkedIn</a>
          <a href="https://instagram.com/hammurabi.jo" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">Instagram</a>
          <a href="mailto:info@hammurabi.jo" className="hover:text-white transition">✉️</a>
          <a href="tel:+962600000000" className="hover:text-white transition">📞</a>
        </div>
      </div>
    </footer>
  )
}