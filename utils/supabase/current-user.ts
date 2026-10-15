import { cache } from 'react'
import { createClient } from '@/utils/supabase/server'

/**
 * The signed-in user, verified with Supabase Auth once per request. A page
 * that calls getTenantActor, getTenants and its layout would otherwise make
 * one Auth round trip each. Memoised for a server render; a server action
 * gets one call per action.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})
