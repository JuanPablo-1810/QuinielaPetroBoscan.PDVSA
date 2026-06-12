// scripts/reset-password.mjs
// Asigna una clave nueva a un usuario (para cuando se le olvida).
// Uso: node --env-file=.env scripts/reset-password.mjs correo@ejemplo.com NuevaClave123
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('\u2716 Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env')
  process.exit(1)
}

const email   = process.argv[2]
const newPass = process.argv[3]
if (!email || !newPass) {
  console.error('Uso: node --env-file=.env scripts/reset-password.mjs <correo> <nueva_clave>')
  process.exit(1)
}
if (newPass.length < 6) {
  console.error('\u2716 La clave debe tener al menos 6 caracteres.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

// buscar el usuario por correo
const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
if (error) { console.error('\u2716 ' + error.message); process.exit(1) }

const user = data.users.find((u) => (u.email || '').toLowerCase() === email.toLowerCase())
if (!user) { console.error('\u2716 No existe ningún usuario con ese correo.'); process.exit(1) }

const { error: e2 } = await supabase.auth.admin.updateUserById(user.id, { password: newPass })
if (e2) { console.error('\u2716 ' + e2.message); process.exit(1) }

console.log(`\u2713 Clave actualizada para ${email}.`)
console.log(`  Nueva clave: ${newPass}  (pásasela y dile que la cambie luego si quieres)`)
