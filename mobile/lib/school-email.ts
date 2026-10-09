export const SCHOOL_EMAIL_MESSAGE = 'Use your @rajagiri.edu.in email address. Kouponly is free for Rajagiri students.';
export const isSchoolEmail = (email: string) => /^[^@\s]+@rajagiri\.edu\.in$/i.test(email.trim());
