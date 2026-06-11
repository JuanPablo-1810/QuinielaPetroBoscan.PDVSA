import { useCallback, useEffect, useState } from 'react'
import { getMyProfile } from '../lib/queries'
import { supabase } from '../lib/supabase'

export function useProfile(session) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    setLoading(true)
    getMyProfile()
      .then((p) => {
        // Hay sesión guardada pero el perfil no existe (cuenta eliminada):
        // cerramos la sesión fantasma para volver limpio al login.
        if (!p) supabase.auth.signOut()
        setProfile(p)
      })
      .catch((e) => { console.error(e); setProfile(null) })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (session) refresh()
    else { setProfile(null); setLoading(false) }
  }, [session, refresh])

  return { profile, loading, refresh }
}