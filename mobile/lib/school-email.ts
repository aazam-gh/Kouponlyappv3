export const SCHOOL_EMAIL_MESSAGE = 'Use your @rajagiri.edu.in email address. Kouponly is free for Rajagiri students.';
export const isSchoolEmail = (email: string) => /^[^@\s]+@rajagiri\.edu\.in$/i.test(email.trim());

// One company-owned account is allowlisted for internal mobile QA. Keep normal
// student eligibility tied to the Rajagiri domain via isSchoolEmail().
export const INTERNAL_MOBILE_TEST_EMAIL = 'info@kouponly.in';
export const canCreateMobileAccount = (email: string) =>
  isSchoolEmail(email) || email.trim().toLowerCase() === INTERNAL_MOBILE_TEST_EMAIL;
