import { functions } from '@/firebase/config'
import { httpsCallable } from 'firebase/functions'

export type HoldingStatus = 'active' | 'disabled'
export type HoldingRole = 'owner' | 'viewer'
export type HoldingRange = '7d' | '30d' | '90d'

export interface HoldingVendorSummary {
  id: string
  name: string
  nameAr?: string | null
  email?: string | null
  status?: string | null
  vendorType?: string | null
  profilePicture?: string | null
  activeOffers: number
}

export interface HoldingGroupUserSummary {
  uid: string
  email: string
  displayName: string
  role: HoldingRole
  status: HoldingStatus
}

export interface HoldingGroupSummary {
  id: string
  name: string
  status: HoldingStatus
  vendorIds: string[]
  users: HoldingGroupUserSummary[]
  createdAt?: string | null
  updatedAt?: string | null
}

export interface HoldingProfile {
  uid: string
  groupId: string
  groupName: string
  role: HoldingRole
  status: HoldingStatus
  vendorIds: string[]
  vendors: HoldingVendorSummary[]
}

export interface HoldingTotals {
  totalRevenue: number
  totalRedemptions: number
  totalDiscount: number
  pendingTransactions: number
  activeOffers: number
}

export interface HoldingChartPoint {
  date: string
  redemptions: number
  revenue: number
}

export interface HoldingVendorBreakdown {
  vendorId: string
  vendorName: string
  totalRevenue: number
  totalRedemptions: number
  totalDiscount: number
  pendingTransactions: number
  activeOffers: number
}

export interface HoldingDashboardData {
  groupId: string
  groupName: string
  totals: HoldingTotals
  chartData: HoldingChartPoint[]
  vendors: HoldingVendorBreakdown[]
}

export interface HoldingTransaction {
  id: string
  vendorId: string | null
  vendorName: string
  userId: string | null
  type: string
  status: string
  totalAmount: number
  discountAmount: number
  discountType?: string | null
  discountValue?: number | null
  finalAmount: number
  createdAt: string | null
  createdAtMillis: number
  pin?: string | null
  offerId?: string | null
  cashbackAmount?: number | null
  creatorCashbackAmount?: number | null
  creatorCode?: string | null
  creatorCodeOwnerId?: string | null
  creatorUid?: string | null
  redemptionCardAmount?: number | null
  remainingAmount?: number | null
}

export async function listHoldingGroups() {
  const callable = httpsCallable<unknown, { groups: HoldingGroupSummary[] }>(functions, 'listHoldingGroups')
  return (await callable({})).data.groups
}

export async function createHoldingGroup(input: { name: string; vendorIds: string[] }) {
  const callable = httpsCallable<typeof input, { groupId: string; success: boolean }>(functions, 'createHoldingGroup')
  return (await callable(input)).data
}

export async function updateHoldingGroup(input: {
  groupId: string
  name?: string
  status?: HoldingStatus
  vendorIds?: string[]
}) {
  const callable = httpsCallable<typeof input, { success: boolean }>(functions, 'updateHoldingGroup')
  return (await callable(input)).data
}

export async function createHoldingGroupUser(input: {
  groupId: string
  email: string
  password: string
  displayName: string
  role: HoldingRole
}) {
  const callable = httpsCallable<typeof input, { uid: string; success: boolean }>(functions, 'createHoldingGroupUser')
  return (await callable(input)).data
}

export async function disableHoldingGroupUser(uid: string) {
  const callable = httpsCallable<{ uid: string }, { success: boolean }>(functions, 'disableHoldingGroupUser')
  return (await callable({ uid })).data
}

export async function deleteHoldingGroupUser(uid: string) {
  const callable = httpsCallable<{ uid: string }, { success: boolean }>(functions, 'deleteHoldingGroupUser')
  return (await callable({ uid })).data
}

export async function getMyHoldingProfile() {
  const callable = httpsCallable<unknown, HoldingProfile>(functions, 'getMyHoldingProfile')
  return (await callable({})).data
}

export async function getHoldingDashboard(range: HoldingRange) {
  const callable = httpsCallable<{ range: HoldingRange }, HoldingDashboardData>(functions, 'getHoldingDashboard')
  return (await callable({ range })).data
}

export async function listHoldingTransactions(input: {
  pageSize: number
  cursor?: string | null
  vendorId?: string
}) {
  const callable = httpsCallable<typeof input, { transactions: HoldingTransaction[]; nextCursor: string | null }>(
    functions,
    'listHoldingTransactions',
  )
  return (await callable(input)).data
}

export async function getHoldingTransaction(transactionId: string) {
  const callable = httpsCallable<{ transactionId: string }, { transaction: HoldingTransaction }>(
    functions,
    'getHoldingTransaction',
  )
  return (await callable({ transactionId })).data.transaction
}
