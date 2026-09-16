'use client'

import { useState } from 'react'
import Footer from '../components/Footer'

export default function TermsPage() {
  const [tab, setTab] = useState('general')

  function tabButtonClass(tabName: string) {
    return "px-4 py-2 rounded-md font-['Tajawal'] text-sm font-medium transition " + (tab === tabName ? 'bg-[#1B1A17] text-[#F3EEE4]' : 'bg-white text-[#4A473F] border border-[#D8D2C4]')
  }

  return (
    <div dir="rtl" className="min-h-screen pattern-bg flex flex-col">
      <div className="bg-[#1B1A17] text-[#F3EEE4] py-12 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-8 font-['Tajawal'] text-sm">
            <a href="/"><img src="/logo.png" alt="حمورابي" className="h-12 w-auto" /></a>
            <a href="/" className="hover:text-[#AD8A4E] transition">العودة للرئيسية</a>
          </div>
          <h1 className="font-['Tajawal'] font-bold text-4xl mb-2">الشروط والأحكام</h1>
          <div className="w-16 h-[2px] bg-[#AD8A4E]"></div>
        </div>
      </div>

      <div className="flex-1">
        <div className="max-w-2xl mx-auto px-6 py-10">
          <div className="flex flex-wrap gap-2 mb-6">
            <button onClick={function () { setTab('general') }} className={tabButtonClass('general')}>عام</button>
            <button onClick={function () { setTab('lawyers') }} className={tabButtonClass('lawyers')}>للمحامين</button>
            <button onClick={function () { setTab('firms') }} className={tabButtonClass('firms')}>لمكاتب المحاماة</button>
            <button onClick={function () { setTab('customers') }} className={tabButtonClass('customers')}>للعملاء</button>
            <button onClick={function () { setTab('ai') }} className={tabButtonClass('ai')}>إخلاء مسؤولية الذكاء الاصطناعي</button>
          </div>

          <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 font-['Tajawal'] text-sm text-[#4A473F] leading-relaxed space-y-4">
            {tab === 'general' && (
              <div>
                <h2 className="font-bold text-[#1B1A17] text-lg mb-3">الشروط العامة</h2>
                <p>باستخدامك منصة حمورابي، فإنك توافق على الالتزام بهذه الشروط والأحكام. تعمل حمورابي كوسيط تقني يربط بين العملاء والمحامين ومكاتب المحاماة المرخصة في المملكة الأردنية الهاشمية، ولا تُعد طرفاً في أي علاقة تعاقدية قانونية بين العميل والمحامي.</p>
                <p>تحتفظ حمورابي بنسبة 5% من قيمة كل عملية دفع كرسوم خدمة، ويُحوَّل المبلغ المتبقي للمحامي أو المكتب عبر التحويل البنكي أو خدمة CliQ.</p>
                <p>يجوز لحمورابي تعديل هذه الشروط في أي وقت، وسيتم إشعار المستخدمين بأي تغييرات جوهرية.</p>
              </div>
            )}

            {tab === 'lawyers' && (
              <div>
                <h2 className="font-bold text-[#1B1A17] text-lg mb-3">شروط المحامين</h2>
                <p>يقر المحامي المسجل بأنه مرخص لممارسة مهنة المحاماة في الأردن وعضو فعّال في نقابة المحامين الأردنيين، ويتحمل وحده المسؤولية الكاملة عن دقة المعلومات المقدمة وجودة الاستشارات والخدمات القانونية التي يقدمها عبر المنصة.</p>
                <p>يخضع الاشتراك الشهري أو السنوي لرسوم محددة حسب الباقة المختارة، ولا يحق للمحامي استخدام أدوات المنصة (الفواتير، القضايا، المكتبة، إلخ) دون اشتراك فعّال.</p>
                <p>تحتفظ حمورابي بحق تعليق أو إنهاء أي حساب يخالف هذه الشروط أو آداب المهنة.</p>
              </div>
            )}

            {tab === 'firms' && (
              <div>
                <h2 className="font-bold text-[#1B1A17] text-lg mb-3">شروط مكاتب المحاماة</h2>
                <p>يقر مكتب المحاماة بأنه مسجل رسمياً وفقاً للأنظمة الأردنية، ويتحمل مسؤولية التحقق من ترخيص كل محامٍ منضم إلى المكتب عبر المنصة.</p>
                <p>يختار المكتب إظهار أسماء محاميه للعملاء أو إبقاء الأمر مجهولاً وإدارة الإحالات داخلياً، وتُطبَّق نفس نسبة الخدمة (5%) على جميع المعاملات المالية عبر المكتب.</p>
              </div>
            )}

            {tab === 'customers' && (
              <div>
                <h2 className="font-bold text-[#1B1A17] text-lg mb-3">شروط العملاء</h2>
                <p>تتيح حمورابي للعملاء حجز مواعيد واستشارات مع محامين ومكاتب محاماة مسجلة على المنصة. لا تتحمل حمورابي أي مسؤولية عن نتيجة أي استشارة أو تمثيل قانوني، وتقع هذه المسؤولية بالكامل على عاتق المحامي أو المكتب المقدم للخدمة.</p>
                <p>تُدفع رسوم الاستشارة السريعة إلكترونياً عبر المنصة قبل عرض إجابة المحامي، وتخضع سياسة الاسترداد لتقدير المنصة حسب كل حالة.</p>
              </div>
            )}

            {tab === 'ai' && (
              <div>
                <h2 className="font-bold text-[#1B1A17] text-lg mb-3">إخلاء مسؤولية الذكاء الاصطناعي</h2>
                <p>المساعد الذكي المتوفر على المنصة هو أداة آلية تعتمد على الذكاء الاصطناعي، وقد تحتوي إجاباته على أخطاء أو معلومات غير دقيقة. لا يُعد استخدام هذا المساعد بديلاً عن استشارة محامٍ مرخص، ولا تتحمل حمورابي أي مسؤولية قانونية عن أي قرار يُتخذ بناءً على إجاباته.</p>
              </div>
            )}
          </div>

          <p className="font-['Tajawal'] text-xs text-[#4A473F] mt-6 text-center">آخر تحديث: سبتمبر 2026</p>
        </div>
      </div>

      <Footer />
    </div>
  )
}