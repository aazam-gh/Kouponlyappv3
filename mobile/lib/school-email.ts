export const SCHOOL_EMAIL_MESSAGE = 'Use your @rajagiri.edu.in email address. Kouponly is free for Rajagiri students.';
export const isSchoolEmail = (email: string) => /^[^@\s]+@rajagiri\.edu\.in$/i.test(email.trim());

// Explicit exceptions are for approved mobile accounts outside the Rajagiri domain.
const MOBILE_ACCOUNT_EMAIL_EXCEPTIONS = new Set([
  'info@kouponly.in',
  'pauljasonthykatt@gmail.com',
  'sabinjsshaji2002@gmail.com',
]);
export const canCreateMobileAccount = (email: string) =>
  isSchoolEmail(email) || MOBILE_ACCOUNT_EMAIL_EXCEPTIONS.has(email.trim().toLowerCase());
