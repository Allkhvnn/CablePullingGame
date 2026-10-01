import { useCallback, useEffect, useRef, useState } from 'react'

type Cue = 'tick' | 'submit' | 'pull' | 'win' | 'lose' | 'draw'
const preferenceKey = 'cable-pulling-sound'

const notes: Record<Cue, Array<[number, number, number]>> = {
  tick: [[520, 0, .08]],
  submit: [[600, 0, .07], [850, .075, .11]],
  pull: [[180, 0, .22], [125, .13, .25]],
  win: [[523, 0, .13], [659, .14, .13], [784, .28, .22]],
  lose: [[350, 0, .17], [245, .17, .24]],
  draw: [[440, 0, .13], [440, .17, .13]],
}

export function useGameAudio() {
  const [enabled, setEnabled] = useState(() => {
    try { return window.localStorage.getItem(preferenceKey) !== 'off' } catch { return true }
  })
  const context = useRef<AudioContext | null>(null)
  const played = useRef(new Set<string>())

  useEffect(() => {
    try { window.localStorage.setItem(preferenceKey, enabled ? 'on' : 'off') } catch { /* private browsing */ }
  }, [enabled])
  useEffect(() => () => { void context.current?.close(); context.current = null }, [])

  const unlock = useCallback(() => {
    if (!enabled || typeof window.AudioContext !== 'function') return
    try {
      context.current ??= new window.AudioContext()
      if (context.current.state === 'suspended') void context.current.resume().catch(() => {})
    } catch { /* audio is optional */ }
  }, [enabled])

  const play = useCallback((cue: Cue) => {
    const audio = context.current
    if (!enabled || !audio) return
    try {
      for (const [frequency, delay, duration] of notes[cue]) {
        const oscillator = audio.createOscillator()
        const gain = audio.createGain()
        oscillator.type = cue === 'pull' ? 'triangle' : 'sine'
        oscillator.frequency.value = frequency
        gain.gain.setValueAtTime(.0001, audio.currentTime + delay)
        gain.gain.linearRampToValueAtTime(cue === 'pull' ? .045 : .055, audio.currentTime + delay + .015)
        gain.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + delay + duration)
        oscillator.connect(gain).connect(audio.destination)
        oscillator.start(audio.currentTime + delay)
        oscillator.stop(audio.currentTime + delay + duration)
      }
    } catch { /* unsupported audio must never interrupt the match */ }
  }, [enabled])

  const playOnce = useCallback((key: string, cue: Cue) => {
    if (played.current.has(key)) return
    played.current.add(key)
    play(cue)
  }, [play])

  const toggle = useCallback(() => {
    if (!enabled && typeof window.AudioContext === 'function') {
      try {
        context.current ??= new window.AudioContext()
        if (context.current.state === 'suspended') void context.current.resume().catch(() => {})
      } catch { /* audio is optional */ }
    }
    setEnabled(!enabled)
  }, [enabled])

  return { enabled, unlock, play, playOnce, toggle }
}
