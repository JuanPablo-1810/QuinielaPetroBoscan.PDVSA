import { createContext, useContext, useState, useCallback } from 'react'
import TeamHistory from '../components/TeamHistory'

// Permite abrir el historial de un equipo desde cualquier parte de la app
// (tarjetas de partido, bracket, tabla de grupos) sin pasar props a mano.
const TeamViewContext = createContext(() => {})

export function useTeamView() {
  return useContext(TeamViewContext)
}

export function TeamViewProvider({ children }) {
  const [team, setTeam] = useState(null)
  const openTeam = useCallback((t) => { if (t && t.id != null) setTeam(t) }, [])

  return (
    <TeamViewContext.Provider value={openTeam}>
      {children}
      {team && <TeamHistory team={team} onClose={() => setTeam(null)} />}
    </TeamViewContext.Provider>
  )
}
