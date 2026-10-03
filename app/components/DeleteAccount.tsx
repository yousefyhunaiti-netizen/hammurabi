'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'

const fileBuckets = ['case-files', 'wakalah-files', 'library-files', 'post-images', 'license-files']

// "Delete my account" for customers, lawyers and firms: removes the
// account's own files, then the database deletes the account's data and login.
export default function DeleteAccount() {
  const supabase = createClient()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    setError('')

    if (confirmText.trim() !== 'حذف') {
      setError('اكتب كلمة «حذف» للتأكيد')
      return
    }

    setDeleting(true)

    const userResult = await supabase.auth.getUser()
    const user = userResult.data.user

    if (!user) {
      setDeleting(false)
      setError('يرجى تسجيل الدخول مرة أخرى')
      return
    }

    // 1. the account's own files
    for (let i = 0; i < fileBuckets.length; i++) {
      const bucket = fileBuckets[i]
      const listResult = await supabase.storage.from(bucket).list(user.id, { limit: 1000 })
      const paths = (listResult.data || []).map(function (f) { return user.id + '/' + f.name })
      if (paths.length > 0) {
        await supabase.storage.from(bucket).remove(paths)
      }
    }

    // 2. the account's data and login
    const deleteResult = await supabase.rpc('delete_my_account')

    if (deleteResult.error) {
      setDeleting(false)
      setError('تعذر حذف الحساب، حاول مرة أخرى أو تواصل معنا')
      return
    }

    await supabase.auth.signOut()
    router.push('/')
  }

  if (!open) {
    return (
      <div className="text-center mt-6">
        <button onClick={function () { setOpen(true) }} className="font-['Tajawal'] text-sm text-[#7A2E2E] hover:underline">حذف الحساب</button>
      </div>
    )
  }

  return (
    <div className="bg-white border-2 border-[#7A2E2E] rounded-lg p-6 mt-6">
      <h2 className="font-['Tajawal'] font-bold text-lg text-[#7A2E2E] mb-2">حذف الحساب نهائياً</h2>
      <p className="font-['Tajawal'] text-sm text-[#4A473F] leading-relaxed mb-4">
        سيتم حذف حسابك وجميع بياناتك نهائياً ولا يمكن التراجع عن ذلك. يشمل ذلك معلوماتك ومواعيدك واستشاراتك، وللمحامين والمكاتب أيضاً: القضايا والملفات والفواتير والوكالات والمنشورات والرسائل. المواعيد القادمة مع العملاء تُلغى تلقائياً.
      </p>
      <label className="block font-['Tajawal'] text-xs text-[#4A473F] mb-1">للتأكيد، اكتب كلمة «حذف»</label>
      <input
        type="text"
        value={confirmText}
        onChange={function (e) { setConfirmText(e.target.value) }}
        className="w-full px-3 py-2 mb-3 bg-[#F3EEE4] border border-[#D8D2C4] rounded-md font-['Tajawal'] text-sm text-[#1B1A17]"
      />
      {error && <p className="font-['Tajawal'] text-sm text-[#7A2E2E] mb-3">{error}</p>}
      <div className="flex gap-2">
        <button onClick={function () { setOpen(false); setConfirmText(''); setError('') }} disabled={deleting} className="flex-1 py-2.5 bg-[#F3EEE4] text-[#4A473F] rounded-md font-['Tajawal'] text-sm disabled:opacity-60">إلغاء</button>
        <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2.5 bg-[#7A2E2E] text-white rounded-md font-['Tajawal'] text-sm disabled:opacity-60">
          {deleting ? 'جاري الحذف...' : 'حذف الحساب نهائياً'}
        </button>
      </div>
    </div>
  )
}
