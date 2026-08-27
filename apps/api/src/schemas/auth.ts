import { z } from 'zod';

// All auth request bodies are validated with Zod before any field
// touches the DB — see brain.md §5.

export const RegisterSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required.')
    .email('Must be a valid email address.')
    .toLowerCase()
    .trim(),
  name: z
    .string()
    .min(1, 'Name cannot be empty.')
    .max(100, 'Name must be 100 characters or fewer.')
    .trim(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.'),
});

export const LoginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required.')
    .email('Must be a valid email address.')
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(1, 'Password is required.'),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
