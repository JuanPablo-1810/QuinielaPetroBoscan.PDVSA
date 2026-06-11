import { createClient } from '@supabase/supabase-js'

export const VITE_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
export const VITE_SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const missingEnv = !VITE_SUPABASE_URL || !VITE_SUPABASE_ANON_KEY

if (missingEnv) {
  console.warn(
    '[Quiniela] Falta configurar VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY en las variables de entorno (Netlify).'
  )
}

export const supabase = createClient(VITE_SUPABASE_URL ?? '', VITE_SUPABASE_ANON_KEY ?? '')
