import { isSchoolEmail } from '../lib/school-email';
it('accepts only the exact school domain, ignoring case and surrounding whitespace', () => {
  expect(isSchoolEmail(' Student@Rajagiri.edu.in ')).toBe(true);
  for (const email of ['student@gmail.com', 'student@rajagiri.edu.in.attacker.com', 'student@sub.rajagiri.edu.in', '@rajagiri.edu.in', 'student@@rajagiri.edu.in', 'student x@rajagiri.edu.in']) expect(isSchoolEmail(email)).toBe(false);
});
