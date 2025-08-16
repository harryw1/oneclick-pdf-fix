// Temporarily disabled middleware to fix infinite loading
// import { updateSession } from '@/utils/supabase/middleware'

export async function middleware(request: any) {
  // Skip middleware for now
  return
}

export const config = {
  matcher: [],
}