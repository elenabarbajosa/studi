import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const signupSchema = z
  .object({
    email: z.string().email("Enter a valid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(72, "Password must be at most 72 characters"),
    confirmPassword: z.string(),
    username: z
      .string()
      .min(3, "Username must be at least 3 characters")
      .max(24, "Username must be at most 24 characters")
      .regex(
        /^[a-z0-9_]+$/,
        "Use lowercase letters, numbers, and underscores only",
      ),
    displayName: z
      .string()
      .min(1, "Display name is required")
      .max(48, "Display name must be at most 48 characters"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const profileSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(24, "Username must be at most 24 characters")
    .regex(
      /^[a-z0-9_]+$/,
      "Use lowercase letters, numbers, and underscores only",
    ),
  display_name: z
    .string()
    .min(1, "Display name is required")
    .max(48, "Display name must be at most 48 characters"),
  bio: z.string().max(280, "Bio must be at most 280 characters").optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
