<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/992d5f50-38d1-4783-be28-83f1b6aeaee4

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Keep the local Supabase dev values in [.env.dev](.env.dev). The Vite config reads that file and maps `SUPABASE_PROJECT_URL` to `VITE_SUPABASE_URL` and `SUPABASE_ANON_PUBLIC_KEY` to `VITE_SUPABASE_ANON_KEY`.
3. Set the `GEMINI_API_KEY` in [.env.local](.env.local) or [.env.dev](.env.dev) if you want Gemini features enabled locally.
4. Run the app:
   `npm run dev`
