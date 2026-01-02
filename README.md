# PortionPal

## Project info

This repository contains the PortionPal web app (React + Vite + TypeScript).

## How can I edit this code?

There are several ways of editing your application.

## Development

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## 📚 Documentation

API documentation tersedia di folder `docs/`. Untuk generate dokumentasi:

```bash
# Generate dokumentasi HTML
npm run docs

# Generate dengan watch mode (auto-reload)
npm run docs:watch
```

Buka `docs/index.html` di browser untuk melihat dokumentasi lengkap. Dokumentasi di-generate dari JSDoc comments menggunakan TypeDoc.

Lihat `docs/README.md` untuk informasi lebih lanjut tentang dokumentasi.

## Deployment

Build and deploy to Firebase Hosting:

```
npm run build
firebase deploy --only hosting
```

## Notes

- Supabase URL and ANON key are provided via `.env.local`.
- Edge Functions read secrets from Supabase: `PROJECT_URL`, `SERVICE_ROLE_KEY`, `OPENAI_API_KEY`.

Security & deployment notes:

- Use `.env.local` (or environment variables in your hosting provider) to set the following keys. See `.env.local.example` in the repo for required names.
- Do NOT commit secrets (service role key or OpenAI key) to the repository. Keep them in your hosting/env settings.
- In production, set `ALLOWED_ORIGIN` to your frontend domain (do not leave `*`).
- Edge functions in this repo now require a valid Supabase access token (Bearer) and apply a simple rate limit. Configure `RATE_MAX_PER_WINDOW` and `RATE_WINDOW_MS` via env.

If you are deploying to Supabase Edge Functions, add these secrets using `supabase secrets set` (or use your hosting provider's secret manager). The Edge Functions expect:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `ALLOWED_ORIGIN` (optional but recommended in production)
- `ENV` (set to `production` in production)
- `RATE_WINDOW_MS` (default: 60000 = 1 minute)
- `RATE_MAX_PER_WINDOW` (default: 10 requests per window)

This repo also contains `.env.local.example` with a starter template for local development.

## Database Migration

Repo ini menyertakan migration SQL untuk tabel rate-limiting:

1. Jalankan migration untuk membuat tabel `rate_limits`:
   ```bash
   # Jika menggunakan Supabase CLI
   supabase db push

   # Atau terapkan manual via Supabase Dashboard > SQL Editor:
   # Copy isi file migrations/20251101_add_rate_limits.sql dan jalankan
   ```

2. Pastikan tabel `rate_limits` sudah dibuat dengan kolom:
   - `user_id` (uuid)
   - `window_start` (timestamptz)
   - `request_count` (integer)

## Storage Setup

Aplikasi menggunakan Supabase Storage bucket `user-images` untuk menyimpan foto makanan:

1. Buat bucket `user-images` di Supabase Dashboard > Storage.
2. Atur policy bucket:
   - **Public bucket**: semua orang bisa melihat gambar (gunakan `getPublicUrl`).
   - **Private bucket** (direkomendasikan): hanya user yang login bisa akses. Set `VITE_PRIVATE_STORAGE=true` di `.env.local` agar aplikasi menggunakan signed URLs.

3. (Opsional) Tambahkan lifecycle policy untuk menghapus gambar lama otomatis (misal hapus setelah 30 hari).
