'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '../../lib/supabase'

type Lawyer = {
  id: number
  full_name: string
  bio: string
  city: string
  address: string
  years_experience: number
  consultation_fee: number
  photo_url: string | null
  specialty_id: number
  bar_certificate_number: string
  phone: string
  email: string
}

type Specialty = {
  id: number
  name_ar: string
}

type Review = {
  id: number
  rating: number
  comment: string
  created_at: string
}

export default function LawyerDetailPage() {
  const params = useParams()
  const lawyerId = Number(params.id)

  const [lawyer, setLawyer] = useState<Lawyer | null>(null)
  const [specialty, setSpecialty] = useState<Specialty | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    async function loadData() {
      const lawyerResult = await supabase
        .from('lawyers')
        .select('*')
        .eq('id', lawyerId)
        .single()

      if (lawyerResult.data) {
        setLawyer(lawyerResult.data)

        const specialtyResult = await supabase
          .from('specialties')
          .select('*')
          .eq('id', lawyerResult.data.specialty_id)
          .single()

        setSpecialty(specialtyResult.data)
      }

      const reviewsResult = await supabase
        .from('reviews')
        .select('*')
        .eq('lawyer_id', lawyerId)
        .order('created_at', { ascending: false })

      setReviews(reviewsResult.data || [])
      setLoading(false)
    }

    loadData()
  }, [lawyerId])

  if (loading) {
    return (
      <div dir="rtl" className="min-h-screen bg-[#F3EEE4] flex items-center justify-center">
        <p className="font-['Tajawal'] text-[#4A473F]">جاري التحميل...</p>
      </div>
    )
  }

  if (!lawyer) {
    return (
      <div dir="rtl" className="min-h-screen bg-[#F3EEE4] flex items-center justify-center">
        <p className="font-['Tajawal'] text-[#4A473F]">لم يتم العثور على هذا المحامي</p>
      </div>
    )
  }

  let averageRating = 0
  for (let i = 0; i < reviews.length; i++) {
    averageRating = averageRating + reviews[i].rating
  }
  if (reviews.length > 0) {
    averageRating = averageRating / reviews.length
  }

  return (
    <div dir="rtl" className="min-h-screen bg-[#F3EEE4]">
      <div className="bg-[#1B1A17] text-[#F3EEE4] py-14 px-6">
        <div className="max-w-4xl mx-auto flex items-center gap-6">
          <div className="w-24 h-24 rounded-full bg-[#F3EEE4] flex items-center justify-center text-[#1B1A17] font-['Amiri'] text-4xl flex-shrink-0">
            {lawyer.full_name.charAt(0)}
          </div>
          <div>
            <h1 className="font-['Amiri'] text-3xl md:text-4xl mb-2">{lawyer.full_name}</h1>
            <p className="font-['Tajawal'] text-[#AD8A4E] mb-2">{specialty ? specialty.name_ar : ''}</p>
            {reviews.length > 0 && (
              <div className="flex items-center gap-1">
                <svg className="w-4 h-4 text-[#AD8A4E]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                <span className="font-['Tajawal'] text-sm">{averageRating.toFixed(1)}</span>
                <span className="font-['Tajawal'] text-sm text-[#D8D2C4]">({reviews.length} تقييم)</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2">
          <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-6">
            <h2 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mb-3">نبذة</h2>
            <p className="font-['Tajawal'] text-[#4A473F] leading-relaxed">{lawyer.bio}</p>
          </div>

          <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 mb-6">
            <h2 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mb-3">التفاصيل</h2>
            <div className="grid grid-cols-2 gap-4 font-['Tajawal'] text-sm">
              <div>
                <p className="text-[#4A473F] mb-1">رقم النقابة</p>
                <p className="text-[#1B1A17] font-medium">{lawyer.bar_certificate_number}</p>
              </div>
              <div>
                <p className="text-[#4A473F] mb-1">سنوات الخبرة</p>
                <p className="text-[#1B1A17] font-medium">{lawyer.years_experience}</p>
              </div>
              <div>
                <p className="text-[#4A473F] mb-1">المدينة</p>
                <p className="text-[#1B1A17] font-medium">{lawyer.city}</p>
              </div>
              <div>
                <p className="text-[#4A473F] mb-1">العنوان</p>
                <p className="text-[#1B1A17] font-medium">{lawyer.address}</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-[#D8D2C4] rounded-lg p-6">
            <h2 className="font-['Tajawal'] font-bold text-lg text-[#1B1A17] mb-4">التقييمات</h2>
            {reviews.length === 0 && (
              <p className="font-['Tajawal'] text-sm text-[#4A473F]">لا توجد تقييمات بعد</p>
            )}
            {reviews.map(function (review) {
              return (
                <div key={review.id} className="border-b border-[#D8D2C4] last:border-0 py-4 first:pt-0">
                  <div className="flex items-center gap-1 mb-2">
                    <svg className="w-4 h-4 text-[#AD8A4E]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    <span className="font-['Tajawal'] text-sm font-medium text-[#1B1A17]">{review.rating}/5</span>
                  </div>
                  <p className="font-['Tajawal'] text-sm text-[#4A473F]">{review.comment}</p>
                </div>
              )
            })}
          </div>
        </div>

        <div>
          <div className="bg-white border border-[#D8D2C4] rounded-lg p-6 sticky top-6">
            <p className="font-['Tajawal'] text-sm text-[#4A473F] mb-1">رسوم الاستشارة</p>
            <p className="font-['Tajawal'] font-bold text-2xl text-[#1B1A17] mb-6">{lawyer.consultation_fee} د.أ</p>

            <button className="w-full py-3 bg-[#1B1A17] text-[#F3EEE4] rounded-md font-['Tajawal'] font-medium hover:bg-[#AD8A4E] transition mb-3">
              حجز موعد
            </button>
            <button className="w-full py-3 border border-[#1B1A17] text-[#1B1A17] rounded-md font-['Tajawal'] font-medium hover:bg-[#1B1A17] hover:text-[#F3EEE4] transition">
              تواصل للاستشارة
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}