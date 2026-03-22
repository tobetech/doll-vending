import { createClient } from '@supabase/supabase-js'

/**
 * ตอน `next build` (เช่น Vercel) ถ้ายังไม่ได้ตั้ง NEXT_PUBLIC_* ตัวแปรจะว่าง
 * และ createClient('', '') จะ throw "supabaseUrl is required" — ใช้ placeholder
 * ให้ build ผ่านได้ (แอปจริงต้องตั้งค่าใน Vercel → Environment Variables)
 */
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
  'https://build-placeholder.supabase.co'
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.build-placeholder'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
