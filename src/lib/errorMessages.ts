/**
 * Centralized Error Messages
 * 
 * This file contains all user-facing error messages used throughout the application.
 * This ensures consistency and makes it easier to maintain and translate messages.
 */

export const ErrorMessages = {
  // Authentication Errors
  auth: {
    loginFailed: "Login gagal",
    loginFailedDescription: "Email atau password salah",
    loginSuccess: "Login berhasil! ✨",
    loginSuccessDescription: "Selamat datang kembali di PortionPal",
    registerFailed: "Terjadi kesalahan",
    registerFailedDescription: "Silakan coba lagi",
    registerSuccess: "Akun berhasil dibuat! 🎉",
    registerSuccessDescription: "Silakan login untuk melanjutkan",
    googleAuthFailed: "Google login gagal",
    googleSignupFailed: "Google signup gagal",
    sessionInvalid: "Sesi tidak valid, silakan login kembali",
    sessionInvalidDescription: "Anda harus login untuk melakukan analisis gambar.",
    userNotFound: "User tidak ditemukan",
    logoutFailed: "Logout gagal",
    logoutSuccess: "Logout berhasil",
    logoutSuccessDescription: "Sampai jumpa lagi! 👋",
    pleaseLogin: "Harap login",
    pleaseLoginDescription: "Anda harus login untuk melakukan analisis gambar.",
  },

  // Validation Errors
  validation: {
    invalidInput: "Input tidak valid",
    invalidInputDescription: "Silakan periksa kembali input Anda",
    emailAlreadyRegistered: "Email sudah terdaftar",
    emailAlreadyRegisteredDescription: "Silakan login atau gunakan email lain",
  },

  // Data Operations
  data: {
    loadFailed: "Gagal memuat data",
    loadFailedDescription: "Silakan coba lagi",
    saveFailed: "Gagal menyimpan",
    saveFailedDescription: "Terjadi kesalahan saat menyimpan data",
    saveSuccess: "Data tersimpan",
    saveSuccessDescription: "Data berhasil disimpan",
    deleteFailed: "Gagal menghapus",
    deleteFailedDescription: "Terjadi kesalahan saat menghapus data",
    notFound: "Data tidak ditemukan",
    databaseError: "Gagal menyimpan ke database",
  },

  // Image/Analysis Errors
  image: {
    noImage: "Tidak ada gambar",
    noImageDescription: "Silakan upload gambar terlebih dahulu",
    analysisFailed: "Gagal Menganalisis",
    analysisFailedDescription: "Terjadi kesalahan saat menganalisis gambar",
    analysisSuccess: "Analisis Selesai! 🎉",
    compressionFailed: "Gagal mengompres gambar",
    uploadFailed: "Gagal mengupload gambar",
  },

  // Goal Errors
  goal: {
    loadFailed: "Gagal memuat data sebelumnya",
    calculateFailed: "Gagal menghitung goal",
    saveSuccess: "Goal berhasil disimpan! AI telah menghitung rekomendasi untukmu.",
    calculateSuccessLocal: "🎯 Goal berhasil dihitung! Menggunakan perhitungan lokal karena OpenAI sedang sibuk.",
    calculateSuccessStandard: "🎯 Goal berhasil dihitung! Menggunakan perhitungan standar.",
    warning: "⚠️ {message}",
  },

  // Profile Errors
  profile: {
    saveNameFailed: "Gagal menyimpan",
    saveNameFailedDescription: "Terjadi kesalahan saat menyimpan nama",
    saveNameSuccess: "Nama tersimpan",
    saveNameSuccessDescription: "Perubahan nama berhasil disimpan",
  },

  // General Errors
  general: {
    error: "Terjadi kesalahan",
    errorDescription: "Silakan coba lagi",
    networkError: "Koneksi internet bermasalah",
    networkErrorDescription: "Pastikan koneksi internet stabil dan coba lagi",
    unknownError: "Terjadi kesalahan yang tidak diketahui",
    tryAgain: "Silakan coba lagi",
    contactSupport: "Jika masalah berlanjut, silakan hubungi support",
  },

  // Success Messages
  success: {
    saved: "Tersimpan! 💾",
    savedDescription: "Data berhasil disimpan",
    deleted: "Dihapus",
    deletedDescription: "Data berhasil dihapus",
    updated: "Diperbarui",
    updatedDescription: "Data berhasil diperbarui",
  },
} as const;

/**
 * Get error message with optional description
 */
export function getErrorMessage(
  category: keyof typeof ErrorMessages,
  key: string,
  description?: boolean
): string {
  const categoryMessages = ErrorMessages[category] as Record<string, string | { [key: string]: string }>;
  const message = categoryMessages[key];
  
  if (typeof message === 'string') {
    return message;
  }
  
  if (description && typeof message === 'object' && 'Description' in message) {
    return message.Description as string;
  }
  
  return message as unknown as string;
}

/**
 * Format error message with variables
 */
export function formatErrorMessage(
  template: string,
  variables: Record<string, string | number>
): string {
  let message = template;
  for (const [key, value] of Object.entries(variables)) {
    message = message.replace(`{${key}}`, String(value));
  }
  return message;
}

