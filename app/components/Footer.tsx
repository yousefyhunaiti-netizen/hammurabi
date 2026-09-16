export default function Footer() {
  return (
    <footer className="bg-[#1B1A17] text-[#D8D2C4] py-10 px-6 mt-auto">
      <div className="max-w-4xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div>
            <img src="/logo.png" alt="حمورابي" className="h-10 w-auto mb-3" />
            <p className="font-['Tajawal'] text-sm">مواعيدك القانونية، بضغطة واحدة.</p>
          </div>

          <div>
            <h3 className="font-['Tajawal'] font-bold text-white text-sm mb-3">روابط سريعة</h3>
            <div className="flex flex-col gap-2 font-['Tajawal'] text-sm">
              <a href="/lawyers" className="hover:text-[#AD8A4E] transition">دليل المحامين</a>
              <a href="/legal-articles" className="hover:text-[#AD8A4E] transition">مقالات قانونية</a>
              <a href="/trainee-board" className="hover:text-[#AD8A4E] transition">لوحة التدريب</a>
              <a href="/terms" className="hover:text-[#AD8A4E] transition">الشروط والأحكام</a>
            </div>
          </div>

          <div>
            <h3 className="font-['Tajawal'] font-bold text-white text-sm mb-3">تواصل معنا</h3>
            <div className="flex flex-col gap-2 font-['Tajawal'] text-sm">
              <a href="tel:+962600000000" className="hover:text-[#AD8A4E] transition">📞 06-000-0000</a>
              <a href="mailto:info@hammurabi.jo" className="hover:text-[#AD8A4E] transition">✉️ info@hammurabi.jo</a>
              <a href="/signup" className="hover:text-[#AD8A4E] transition">انضم كمحامٍ أو مكتب محاماة</a>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 pt-6 text-center">
          <p className="font-['Tajawal'] text-xs">© 2026 حمورابي. جميع الحقوق محفوظة.</p>
        </div>
      </div>
    </footer>
  )
}