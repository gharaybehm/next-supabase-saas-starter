/** This app's base URL with no trailing slash (Supabase's redirect allow-list matches exactly). */
export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '')
}
