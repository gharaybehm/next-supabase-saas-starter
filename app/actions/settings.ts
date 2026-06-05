'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { routing, LOCALE_COOKIE, type Locale } from '@/i18n/routing'

export async function setLocale(locale: string) {
  if (!routing.locales.includes(locale as Locale)) {
    return { error: 'Invalid locale' }
  }

  const cookieStore = await cookies()
  cookieStore.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: false,
  })

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()

  const data = {
    full_name: formData.get('full_name') as string,
    phone: formData.get('phone') as string,
  }

  const { error } = await supabase.auth.updateUser({ data })
  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return { success: 'Profile updated successfully' }
}

export async function updatePassword(formData: FormData) {
  const supabase = await createClient()

  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirm_password') as string

  if (password !== confirmPassword) return { error: 'Passwords do not match' }
  if (password.length < 6) return { error: 'Password must be at least 6 characters' }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: error.message }

  return { success: 'Password updated successfully' }
}
