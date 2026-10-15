'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { REMEMBER_ME_COOKIE } from '@/utils/supabase/remember-me'

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()

  // The next sign-in on this browser makes its own choice.
  ;(await cookies()).delete(REMEMBER_ME_COOKIE)

  revalidatePath('/', 'layout')
  redirect('/login')
}
