import { queryOptions } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type AdminStudent = {
  id: string; name: string; email: string; city: string | null; phone: string | null
  createdAt: string; emailVerifiedAt: string | null; eligible: boolean
  inviteCode: string | null; referralRefreshes: number; referralLimit: number
  invitedFriends: number; consumedThisMonth: number
  couponMonth: { startsAt: string; endsAt: string; roundNumber: number; usedOffers: number } | null
}
type Result = {
  total: number; students: AdminStudent[]
  savedItems?: { id: string; type: string; title: string; vendorId: string | null; savedAt: string }[]
  referrals?: { id: string; email: string | null; status: string; reason: string | null; createdAt: string }[]
}
export const adminStudentsQuery = (search = '', page = 1, pageSize = 10, userId?: string) => queryOptions({
  queryKey: ['admin-students', search, page, pageSize, userId],
  queryFn: async () => {
    const { data, error } = await supabase.rpc('kouponly_admin_students', {
      p_search: search, p_offset: (page - 1) * pageSize, p_limit: pageSize, p_user_id: userId ?? null,
    })
    if (error) throw error
    return data as Result
  },
  retry: false,
})
