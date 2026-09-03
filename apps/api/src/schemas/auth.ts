import { z } from 'zod';

// All auth request bodies are validated with Zod before any field
// touches the DB — see brain.md §5.

export const RegisterSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required.')
    .max(254, 'Email must not exceed 254 characters.')
    .email('Must be a valid email address.')
    .toLowerCase()
    .trim(),
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters.')
    .max(100, 'Name must be 100 characters or fewer.')
    .trim()
    .refine((val) => !/^\d+$/.test(val), {
      message: 'Name cannot be numbers only. Please use your real name or letters.',
    })
    .refine((val) => /[a-zA-Z]/.test(val), {
      message: 'Name must contain at least one letter.',
    }),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .max(72, 'Password must not exceed 72 characters.')
    .refine((val) => /[A-Z]/.test(val), {
      message: 'Password must contain at least one uppercase letter.',
    })
    .refine((val) => /[a-z]/.test(val), {
      message: 'Password must contain at least one lowercase letter.',
    })
    .refine((val) => /[0-9]/.test(val), {
      message: 'Password must contain at least one number.',
    })
    .refine((val) => /[^a-zA-Z0-9]/.test(val), {
      message: 'Password must contain at least one special character.',
    }),
});

export const LoginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required.')
    .max(254, 'Email must not exceed 254 characters.')
    .email('Must be a valid email address.')
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(1, 'Password is required.')
    .max(72, 'Password must not exceed 72 characters.'),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
