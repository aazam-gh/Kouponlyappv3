import { searchVendors } from '../lib/vendor-search';
import { safeWebUrl } from '../lib/vendor-links';
import { validateStudentRequest } from '../lib/student-community';
import type { Deal } from '../lib/data';

const vendors = [
  { id: 1, name: 'Marina Cafe', category: 'Food', keywords: 'coffee waterfront', description: 'Student lunches' },
  { id: 2, name: 'Museum Kitchen', category: 'Food', keywords: 'dessert', description: 'Dinner', place: 'Marina' },
  { id: 3, name: 'Palm Gym', category: 'Fitness', keywords: 'weights', description: 'Memberships' },
] as Deal[];
it('narrows live name matches and searches remembered category and details', () => {
  expect(searchVendors(vendors, 'M').map(v => v.id)).toEqual([1, 2]);
  expect(searchVendors(vendors, 'Mar').map(v => v.id)).toEqual([1]);
  expect(searchVendors(vendors, 'food waterfront').map(v => v.id)).toEqual([1]);
  expect(searchVendors(vendors, 'fitness').map(v => v.id)).toEqual([3]);
  expect(searchVendors([...vendors, { id: 4, name: 'Food Corner', category: 'Food' } as Deal], 'Food').map(v => v.id)).toEqual([1, 2, 4]);
  expect(searchVendors(vendors, '  ')).toEqual([]);
  expect(searchVendors(vendors, 'no such vendor')).toEqual([]);
});
it('opens only valid web and Instagram links', () => {
  expect(safeWebUrl('example.com')).toBe('https://example.com/');
  expect(safeWebUrl('@marina_cafe', true)).toBe('https://www.instagram.com/marina_cafe/');
  expect(safeWebUrl('https://instagram.com.evil.example/name', true)).toBeUndefined();
  expect(safeWebUrl('javascript:alert(1)')).toBeUndefined();
  expect(safeWebUrl('https://user:password@example.com')).toBeUndefined();
});
it('requires institute and domain details but allows optional restaurant contact details', () => {
  const request = { kind: 'school' as const, name: 'Marina University', domain: 'students.marina.edu', email: 'student@marina.edu', contact: 'Student Name', phone: '+919876543210' };
  expect(validateStudentRequest(request)).toBeNull();
  expect(validateStudentRequest({ ...request, contact: '' })).toContain('name');
  expect(validateStudentRequest({ ...request, phone: '' })).toContain('phone');
  expect(validateStudentRequest({ ...request, kind: 'restaurant', location: '' })).toContain('location');
  expect(validateStudentRequest({ ...request, domain: 'student@marina.edu' })).toContain('domain');
  expect(validateStudentRequest({ ...request, email: 'bad' })).toContain('email');
  expect(validateStudentRequest({ ...request, kind: 'restaurant', domain: '', name: 'Marina Cafe', location: 'Kochi', contact: '', phone: '' })).toBeNull();
  expect(validateStudentRequest({ ...request, kind: 'restaurant', name: '' })).toContain('restaurant');
});
