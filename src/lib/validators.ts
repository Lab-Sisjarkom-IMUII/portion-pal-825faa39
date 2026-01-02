/**
 * Centralized Input Validation Schemas
 * 
 * Using Zod for type-safe validation across the application
 */

import { z } from "zod";

// ====== Auth Validators ======

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { message: "Email harus diisi" })
    .email({ message: "Format email tidak valid" }),
  password: z
    .string()
    .min(6, { message: "Password minimal 6 karakter" })
    .max(100, { message: "Password maksimal 100 karakter" }),
});

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, { message: "Nama minimal 2 karakter" })
      .max(100, { message: "Nama maksimal 100 karakter" })
      .regex(/^[a-zA-Z\s]+$/, { message: "Nama hanya boleh huruf dan spasi" }),
    email: z
      .string()
      .trim()
      .min(1, { message: "Email harus diisi" })
      .email({ message: "Format email tidak valid" })
      .max(255, { message: "Email terlalu panjang" }),
    password: z
      .string()
      .min(6, { message: "Password minimal 6 karakter" })
      .max(100, { message: "Password maksimal 100 karakter" })
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
        message: "Password harus mengandung huruf besar, huruf kecil, dan angka",
      }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Password tidak sama",
    path: ["confirmPassword"],
  });

// ====== Goal Validators ======

export const goalFormSchema = z
  .object({
    goal_type: z.enum(["lose_weight", "reduce_calories"], {
      errorMap: () => ({ message: "Pilih jenis tujuan" }),
    }),
    age: z
      .number()
      .int({ message: "Usia harus bilangan bulat" })
      .min(10, { message: "Usia minimal 10 tahun" })
      .max(120, { message: "Usia maksimal 120 tahun" }),
    gender: z.enum(["male", "female"], {
      errorMap: () => ({ message: "Pilih jenis kelamin" }),
    }),
    height: z
      .number()
      .min(100, { message: "Tinggi badan minimal 100 cm" })
      .max(250, { message: "Tinggi badan maksimal 250 cm" })
      .positive({ message: "Tinggi badan harus positif" }),
    weight: z
      .number()
      .min(30, { message: "Berat badan minimal 30 kg" })
      .max(300, { message: "Berat badan maksimal 300 kg" })
      .positive({ message: "Berat badan harus positif" }),
    activity: z.enum(["sedentary", "moderate", "active"], {
      errorMap: () => ({ message: "Pilih tingkat aktivitas" }),
    }),
    target_time: z
      .string()
      .trim()
      .min(1, { message: "Target waktu harus diisi" })
      .regex(/^\d+\s*(hari|minggu|bulan|tahun|day|week|month|year|h|w|m|y)?$/i, { 
        message: "Format target waktu tidak valid. Contoh: '1 bulan', '3 bulan', '6 bulan', '1 tahun'" 
      }),
    target_weight: z
      .number()
      .min(30, { message: "Target berat badan minimal 30 kg" })
      .max(300, { message: "Target berat badan maksimal 300 kg" })
      .positive({ message: "Target berat badan harus positif" })
      .optional(),
  })
  .refine(
    (data) => {
      if (data.goal_type === "lose_weight") {
        return data.target_weight !== undefined;
      }
      return true;
    },
    {
      message: "Target berat badan harus diisi untuk tujuan menurunkan berat badan",
      path: ["target_weight"],
    }
  )
  .refine(
    (data) => {
      if (data.goal_type === "lose_weight" && data.target_weight) {
        return data.target_weight < data.weight;
      }
      return true;
    },
    {
      message: "Target berat badan harus lebih kecil dari berat badan saat ini",
      path: ["target_weight"],
    }
  );

// ====== Image Upload Validators ======

export const imageFileSchema = z
  .instanceof(File, { message: "File harus berupa gambar" })
  .refine(
    (file) => {
      const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
      return validTypes.includes(file.type);
    },
    {
      message: "Format file tidak didukung. Gunakan: JPG, JPEG, PNG, atau WEBP",
    }
  )
  .refine(
    (file) => {
      const maxSizeMB = 10;
      const sizeMB = file.size / (1024 * 1024);
      return sizeMB <= maxSizeMB;
    },
    {
      message: "Ukuran file terlalu besar. Maksimal 10MB",
    }
  )
  .refine(
    (file) => {
      return file.size > 0;
    },
    {
      message: "File tidak boleh kosong",
    }
  );

// ====== Profile Validators ======

export const profileUpdateSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, { message: "Nama minimal 2 karakter" })
    .max(100, { message: "Nama maksimal 100 karakter" })
    .regex(/^[a-zA-Z\s]+$/, { message: "Nama hanya boleh huruf dan spasi" })
    .optional(),
  email: z
    .string()
    .trim()
    .email({ message: "Format email tidak valid" })
    .optional(),
});

// ====== Utility Functions ======

/**
 * Validate and parse number from string input
 */
export function parseNumberInput(value: string, fieldName: string): number {
  const parsed = Number(value);
  if (isNaN(parsed)) {
    throw new Error(`${fieldName} harus berupa angka`);
  }
  return parsed;
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  return z.string().email().safeParse(email).success;
}

/**
 * Validate file size
 */
export function isValidFileSize(file: File, maxSizeMB: number): boolean {
  const sizeMB = file.size / (1024 * 1024);
  return sizeMB <= maxSizeMB;
}

/**
 * Validate file type
 */
export function isValidFileType(
  file: File,
  allowedTypes: string[]
): boolean {
  return allowedTypes.includes(file.type);
}

// ====== Type Exports ======

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type GoalFormInput = z.infer<typeof goalFormSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

