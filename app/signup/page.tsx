'use client'

import { useState } from 'react'
import { createClient } from '../lib/supabase'

export default function SignupPage() {
  const [userType, setUserType] = useState<'customer' | 'lawyer'>('customer')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  const supabase = createClient()

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      setMessage('خطأ: ' + error.message)
      return
    }

    const userId = data.user?.id

    if (userType === 'customer') {
      await supabase.from('customers').insert({
        user_id: userId,
        full_name: fullName,
        email: email,
        phone: phone,
      })
    } else {
      await supabase.from('lawyers').insert({
        user_id: userId,
        full_name: fullName,
        email: email,
        phone: phone,
        is_approved: false,
        is_active: false,
      })
    }

    setMessage('تم إنشاء الحساب بنجاح! تفقد بريدك الإلكتروني للتأكيد.')
  }

  return (
    <div dir="rtl" style={{ maxWidth: '400px', margin: '50px auto', fontFamily: 'sans-serif' }}>
      <h1>إنشاء حساب</h1>

      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={() => setUserType('customer')}
          style={{ fontWeight: userType === 'customer' ? 'bold' : 'normal', marginLeft: '10px' }}
        >
          عميل
        </button>
        <button
          onClick={() => setUserType('lawyer')}
          style={{ fontWeight: userType === 'lawyer' ? 'bold' : 'normal' }}
        >
          محامي
        </button>
      </div>

      <form onSubmit={handleSignup}>
        <div style={{ marginBottom: '10px' }}>
          <input
            type="text"
            placeholder="الاسم الكامل"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            style={{ width: '100%', padding: '8px' }}
          />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <input
            type="email"
            placeholder="البريد الإلكتروني"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%', padding: '8px' }}
          />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <input
            type="tel"
            placeholder="رقم الهاتف"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            style={{ width: '100%', padding: '8px' }}
          />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <input
            type="password"
            placeholder="كلمة المرور"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: '8px' }}
          />
        </div>
        <button type="submit" style={{ width: '100%', padding: '10px', background: 'black', color: 'white' }}>
          إنشاء حساب
        </button>
      </form>

      {message && <p style={{ marginTop: '15px' }}>{message}</p>}
    </div>
  )
}
