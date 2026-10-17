import { invoke as invokeCouponlyMobile } from './couponlyBackend';
import { getSupabase } from './supabase';

export type StudentRequest = { kind: 'school' | 'restaurant'; name: string; domain: string; email: string; contact: string; phone: string; location?: string };
export function validateStudentRequest(request: StudentRequest): string | null {
  if (request.name.trim().length < 2 || request.name.trim().length > 160) return request.kind === 'school' ? 'Enter the institute name (2–160 characters).' : 'Enter the restaurant name (2–160 characters).';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(request.email.trim()) || request.email.length > 254) return 'Enter a valid contact email.';
  if (request.kind === 'school' && (!/^[a-z\d](?:[a-z\d-]*[a-z\d])?(?:\.[a-z\d](?:[a-z\d-]*[a-z\d])?)+$/i.test(request.domain.trim()) || request.domain.length > 253)) return 'Enter the school email domain, for example university.edu.';
  if (request.kind === 'restaurant' && (!request.location?.trim() || request.location.trim().length > 160)) return 'Enter the restaurant location (1–160 characters).';
  if (request.kind === 'school' && (request.contact.trim().length < 2 || !/^[+\d][\d ()-]{6,39}$/.test(request.phone.trim()))) return 'Enter your name and a valid phone number.';
  if (request.contact.length > 160 || request.phone.length > 40) return 'Please shorten the contact details.';
  return null;
}
export async function submitStudentRequest(request: StudentRequest, id: string) {
  const message = validateStudentRequest(request);
  if (message) throw new Error(message);
  await invokeCouponlyMobile<{ requestId: string }>('submitStudentRequest', { ...request, id, name: request.name.trim(), domain: request.domain.trim().toLowerCase(), email: request.email.trim().toLowerCase(), contact: request.contact.trim(), phone: request.phone.trim() });
}
export type Friend = { id: string; name: string; status: 'pending' | 'accepted'; incoming: boolean };
export type FriendActivity = { id: string; name: string; action: 'saved' | 'redeemed'; vendorId: string; vendorName: string; title: string; createdAt: string };
export type FriendsSnapshot = { friends: Friend[]; activity: FriendActivity[]; shareActivity: boolean };
export async function communityRpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabase().rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}
