import { useEffect, useState } from 'react'
import { parsePlayerProfile } from '../shared/protocol'
import type { PlayerProfile } from '../shared/protocol'

const key = 'cable-player-profile'
const defaultProfile: PlayerProfile = { name: `Гость ${Math.floor(Math.random() * 900) + 100}`, hero: 'fox' }

export function usePlayerProfile() {
  const [profile, setProfile] = useState<PlayerProfile>(() => {
    try { return parsePlayerProfile(JSON.parse(localStorage.getItem(key) ?? 'null')) ?? defaultProfile }
    catch { return defaultProfile }
  })
  useEffect(() => {
    const valid = parsePlayerProfile(profile)
    if (valid) {
      try { localStorage.setItem(key, JSON.stringify(valid)) } catch { /* Игра работает и без локального хранилища. */ }
    }
  }, [profile])
  return [profile, setProfile] as const
}
