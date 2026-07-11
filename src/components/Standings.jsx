import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { getStandings, getTeamsStatus } from '../lib/queries'
import { supabase } from '../lib/supabase'
import PlayerHistory from './PlayerHistory'

// Los 3 equipos favoritos de cada quien: en color si siguen en competencia,
// en gris si ya fueron eliminados. El campeón se resalta en oro (bono +15).
function Favoritos({ ids, teams }) {
  const lista = (ids ?? []).slice(0, 3)
  if (!lista.length) return <span className="w-[4.5rem] shrink-0" />
  return (
    <div className="flex w-[4.5rem] shrink-0 items-center justify-end gap-1">
      {lista.map((id) => {
        const t = teams.teamById[id]
        const fuera = teams.eliminado(id)
        const esCampeon = teams.campeon != null && teams.campeon === id
        return (
          <span
            key={id}
            title={`${t?.name ?? 'Equipo'}${esCampeon ? ' · ¡CAMPEÓN! +15' : fuera ? ' · eliminado' : ' · sigue vivo'}`}
            className={`grid h-5 w-5 shrink-0 place-items-center overflow-hidden rounded-full ring-1 transition sm:h-6 sm:w-6 ${
              esCampeon ? 'ring-2 ring-ambar shadow-[0_0_10px_-1px_rgba(232,180,78,0.9)]'
                : fuera ? 'opacity-30 grayscale ring-linea/60'
                : 'ring-cancha/50'
            }`}
          >
            {t?.flag_url
              ? <img src={t.flag_url} alt="" className="h-full w-full object-cover" />
              : <span className="h-full w-full bg-linea-2" />}
          </span>
        )
      })}
    </div>
  )
}

function Centered({ children }) {
  return <div className="py-20 text-center font-body text-crema/60">{children}</div>
}

function RankBadge({ rank }) {
  const styles = {
    1: 'bg-oro-grad text-petroleo shadow-[0_0_12px_rgba(232,180,78,0.6)]',
    2: 'bg-crema/85 text-petroleo',
    3: 'bg-[#C8902F] text-petroleo',
  }
  const cls = styles[rank] || 'border border-linea text-crema/55'
  return (
    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full font-display text-base ${cls}`}>{rank}</span>
  )
}

const SIN_EQUIPOS = { teamById: {}, eliminado: () => false, campeon: null }

export default function Standings() {
  const [rows, setRows] = useState([])
  const [teams, setTeams] = useState(SIN_EQUIPOS)
  const [state, setState] = useState('loading')
  const [uid, setUid] = useState(null)
  const [selected, setSelected] = useState(null) // { userId, name, isMe }

  useEffect(() => {
    let active = true
    supabase.auth.getUser().then(({ data }) => { if (active) setUid(data?.user?.id ?? null) })

    const load = () =>
      Promise.all([getStandings(), getTeamsStatus()])
        .then(([r, ts]) => { if (active) { setRows(r); setTeams(ts); setState('ready') } })
        .catch((e) => { console.error(e); if (active) setState((s) => (s === 'loading' ? 'error' : s)) })

    load()
    const t = setInterval(load, 60000) // se actualiza sola cada minuto
    return () => { active = false; clearInterval(t) }
  }, [])

  if (state === 'loading') return <Centered>Cargando tabla…</Centered>
  if (state === 'error') return <Centered>No se pudo cargar la tabla.</Centered>

  const total = rows.length
  const marcarUltimos = total >= 7

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <h2 className="font-display text-3xl uppercase tracking-wide">Tabla de posiciones</h2>
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cancha" title="Se actualiza sola" />
      </div>

      {total === 0 ? (
        <Centered>Aún no hay participantes.</Centered>
      ) : (
        <ul className="space-y-2">
          {rows.map((u, i) => {
            const rank = i + 1
            const yo = u.user_id === uid
            const ultimo = marcarUltimos && rank > total - 3
            return (
              <motion.li
                layout
                key={u.user_id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: Math.min(i * 0.04, 0.4) }}
                onClick={() => setSelected({ userId: u.user_id, name: u.full_name, isMe: yo })}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected({ userId: u.user_id, name: u.full_name, isMe: yo }) } }}
                className={`group flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                  rank === 1 ? 'border-ambar/60 bg-ambar/5 shadow-glow-oro hover:border-ambar'
                    : rank <= 3 ? 'border-ambar/25 bg-petroleo-2 hover:border-ambar/50'
                    : ultimo ? 'border-red-500/20 bg-petroleo-2 hover:border-red-500/40'
                    : 'border-linea bg-petroleo-2 hover:border-ambar/40'
                } ${yo ? 'ring-1 ring-ambar/70' : ''}`}
              >
                <RankBadge rank={rank} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-body text-sm text-crema">
                    {u.full_name}{yo && <span className="ml-1 text-ambar/80">(tú)</span>}
                  </p>
                  <p className="font-body text-[11px] text-crema/40">
                    {u.jugados} jugados · {u.aciertos} aciertos
                    {u.bono_campeon ? <span className="text-ambar"> · +15 campeón</span> : ''}
                  </p>
                </div>
                <Favoritos ids={u.favorite_team_ids} teams={teams} />
                <div className="flex flex-col items-end leading-none">
                  <span className="font-display text-2xl tabular text-gilded">{Number(u.total_points)}</span>
                  <span className="mt-1 flex items-center gap-0.5 font-body text-[10px] tabular text-ambar/65" title="Aciertos exactos (criterio de desempate)">
                    <span aria-hidden>★</span> {u.exactos} <span className="text-crema/35">exactos</span>
                  </span>
                </div>
                <span className="font-display text-lg text-crema/25 transition-colors group-hover:text-ambar/70" aria-hidden>›</span>
              </motion.li>
            )
          })}
        </ul>
      )}

      {marcarUltimos && (
        <p className="mt-4 text-center font-body text-[11px] text-crema/35">Podio en dorado · últimos 3 en zona roja</p>
      )}
      {total > 0 && (
        <p className="mt-4 text-center font-body text-[11px] text-crema/35">
          Banderas = los 3 favoritos de cada quien · <span className="text-cancha/70">en color</span> siguen vivos ·{' '}
          <span className="text-crema/50">en gris</span> eliminados · el <span className="text-ambar/70">campeón</span> da +15
        </p>
      )}
      {total > 1 && (
        <p className="mt-2 text-center font-body text-[11px] text-crema/35">
          Empate en puntos: gana quien tenga más <span className="text-ambar/70">★ aciertos exactos</span>
        </p>
      )}
      {total > 0 && (
        <p className="mt-2 text-center font-body text-[11px] text-crema/35">Toca a una persona para ver su historial</p>
      )}

      {selected && (
        <PlayerHistory
          userId={selected.userId}
          name={selected.name}
          isMe={selected.isMe}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}