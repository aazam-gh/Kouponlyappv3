import { invoke } from './couponlyBackend';

export type ContactMessage = { name: string; email: string; message: string };

export function validateContactMessage(input: ContactMessage): string | null {
  if (input.name.trim().length < 2 || input.name.trim().length > 100) return 'Enter your name (2–100 characters).';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email.trim()) || input.email.length > 254) return 'Enter a valid email address.';
  if (input.message.trim().length < 10 || input.message.trim().length > 4000) return 'Enter a message (10–4,000 characters).';
  return null;
}

export async function sendContactMessage(input: ContactMessage) {
  const error = validateContactMessage(input);
  if (error) throw new Error(error);
  return invoke<{ success: true }>('sendContactMessage', {
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    message: input.message.trim(),
  });
}
