// Jordanian courts for the case file: category → court type → location.
// Sources: نظام تشكيل محاكم الصلح والبداية وتحديد الصلاحية المكانية لمحاكم
// الصلح والبداية والاستئناف (2005) and the Sharia courts directory in
// دائرة قاضي القضاة's 2023 statistical report. Anything missing can be typed
// in with «أخرى».

export type LocationGroup = { group: string; items: string[] }
export type CourtType = { name: string; locations: (string | LocationGroup)[] }
export type CourtCategory = { name: string; types: CourtType[] }

export const OTHER = 'أخرى'

const SULH = [
  'عمان', 'شمال عمان', 'جنوب عمان', 'شرق عمان', 'غرب عمان', 'سحاب', 'الجيزة', 'الموقر', 'ناعور',
  'السلط', 'الشونة الجنوبية', 'دير علا', 'عين الباشا',
  'الزرقاء', 'الرصيفة', 'الأزرق',
  'مادبا', 'ذيبان',
  'إربد', 'الرمثا', 'الكورة', 'بني كنانة', 'الأغوار الشمالية', 'بني عبيد', 'المزار الشمالي', 'الطيبة',
  'المفرق', 'البادية الشمالية', 'الرويشد',
  'جرش', 'عجلون',
  'الكرك', 'المزار الجنوبي', 'القصر', 'الأغوار الجنوبية', 'عي',
  'الطفيلة',
  'معان', 'الجفر', 'البتراء', 'الشوبك', 'الحسينية',
  'العقبة', 'القويرة',
]

const BIDAYA = [
  'عمان', 'الزرقاء', 'الرصيفة', 'إربد', 'الرمثا', 'السلط', 'مادبا', 'المفرق', 'جرش', 'عجلون',
  'الكرك', 'الطفيلة', 'معان', 'العقبة',
]

const GOVERNORATES = [
  'العاصمة (عمان)', 'الزرقاء', 'إربد', 'البلقاء', 'مادبا', 'المفرق', 'جرش', 'عجلون', 'الكرك', 'الطفيلة', 'معان', 'العقبة',
]

const SHARIA_FIRST = [
  'عمان', 'عمان — المنطقة الوسطى', 'عمان — المنطقة الشرقية', 'عمان — المنطقة الجنوبية', 'وادي السير', 'صويلح',
  'ناعور', 'سحاب', 'الموقر', 'الجيزة',
  'الزرقاء', 'الرصيفة', 'الأزرق', 'الهاشمية',
  'إربد', 'الرمثا', 'الكورة', 'بني كنانة', 'الشونة الشمالية', 'المزار الشمالي', 'الطيبة', 'الوسطية', 'بني عبيد',
  'السلط', 'دير علا', 'عين الباشا', 'الشونة الجنوبية', 'زي', 'ماحص', 'العارضة',
  'مادبا', 'ذيبان',
  'المفرق', 'صبحا', 'الرويشد', 'بلعما', 'الخالدية',
  'جرش', 'عجلون', 'كفرنجة',
  'الكرك', 'القصر', 'المزار الجنوبي', 'غور الصافي', 'عي',
  'الطفيلة', 'بصيرا', 'الحسا',
  'معان', 'البتراء', 'الشوبك', 'الحسينية', 'الجفر',
  'العقبة', 'القويرة',
  'القدس',
]

export const COURTS: CourtCategory[] = [
  {
    name: 'نظامية',
    types: [
      { name: 'صلح', locations: SULH },
      { name: 'بداية', locations: BIDAYA },
      { name: 'استئناف', locations: ['عمان', 'إربد', 'معان'] },
      { name: 'تمييز', locations: ['عمان'] },
      {
        name: 'دائرة التنفيذ',
        locations: [
          { group: 'تنفيذ محاكم البداية', items: BIDAYA.map(function (l) { return 'تنفيذ بداية ' + l }) },
          { group: 'تنفيذ محاكم الصلح', items: SULH.map(function (l) { return 'تنفيذ صلح ' + l }) },
        ],
      },
      {
        name: 'الادعاء العام',
        locations: [
          { group: 'النيابة العامة لدى المحاكم', items: ['عمان', 'شمال عمان', 'جنوب عمان', 'شرق عمان', 'غرب عمان'].concat(BIDAYA.slice(1)).map(function (l) { return 'مدعي عام ' + l }) },
          {
            group: 'النيابات المتخصصة',
            items: [
              'نيابة محكمة الجنايات الكبرى',
              'مدعي عام حماية الأسرة والأحداث',
              'مدعي عام الجرائم الإلكترونية',
              'مدعي عام هيئة النزاهة ومكافحة الفساد',
              'النيابة العامة الضريبية',
              'النيابة العامة الجمركية',
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'خاصة',
    types: [
      { name: 'الجنايات الكبرى', locations: ['عمان'] },
      { name: 'أمن الدولة', locations: ['عمان'] },
      { name: 'العسكرية', locations: ['المحكمة العسكرية — عمان'] },
      { name: 'الشرطة', locations: ['محكمة الشرطة — عمان'] },
      { name: 'الإدارية', locations: ['عمان'] },
      { name: 'الإدارية العليا', locations: ['عمان'] },
      { name: 'الأحداث', locations: GOVERNORATES },
      { name: 'الجمارك', locations: ['الجمارك البدائية — عمان', 'الجمارك الاستئنافية — عمان'] },
      { name: 'الضريبة', locations: ['بداية ضريبة الدخل — عمان', 'استئناف ضريبة الدخل — عمان'] },
      { name: 'البلديات', locations: ['محكمة أمانة عمان الكبرى'] },
      { name: 'الدستورية', locations: ['عمان'] },
    ],
  },
  {
    name: 'شرعية',
    types: [
      { name: 'المحكمة الشرعية', locations: SHARIA_FIRST },
      { name: 'الاستئناف الشرعية', locations: ['عمان', 'إربد', 'معان', 'القدس'] },
      { name: 'العليا الشرعية', locations: ['عمان'] },
    ],
  },
]

// Lawyers outside Jordan: general court levels, location typed in.
export const COURT_TYPES_ABROAD = ['محكمة الدرجة الأولى', 'محكمة الاستئناف', 'المحكمة العليا', 'محكمة متخصصة']

export function typesOf(category: string): CourtType[] {
  const found = COURTS.find(function (c) { return c.name === category })
  return found ? found.types : []
}

export function locationsOf(category: string, type: string): (string | LocationGroup)[] {
  const found = typesOf(category).find(function (t) { return t.name === type })
  return found ? found.locations : []
}

// Every location of a court type as one flat list.
export function flatLocations(category: string, type: string): string[] {
  const out: string[] = []
  locationsOf(category, type).forEach(function (l) {
    if (typeof l === 'string') out.push(l)
    else l.items.forEach(function (i) { out.push(i) })
  })
  return out
}

// How a court reads on a card: «بداية — إربد», «دائرة التنفيذ — تنفيذ صلح غرب عمان».
export function courtText(type: string | null, location: string | null) {
  const parts = [type, location].filter(function (p) { return p && p.trim() })
  return parts.join(' — ')
}

// Case statuses (also the Kanban columns), in order.
export const CASE_STATUSES = ['منظورة', 'مفصولة', 'قيد التنفيذ', 'موقوفة', 'منفذة ومنتهية', 'مسقطة', 'متروكة']
export const OPEN_STATUSES = ['منظورة', 'قيد التنفيذ', 'موقوفة']
export const SUSPENSION_TYPES = ['وقف قضائي', 'وقف بالتراضي', 'وقف السير']
