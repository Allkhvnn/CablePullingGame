import { useEffect, useState } from 'react'

export const COUNTDOWN_SECONDS = 3

export function Countdown({ onComplete }: { onComplete: () => void }) {
  const [seconds, setSeconds] = useState(COUNTDOWN_SECONDS)
  useEffect(() => {
    const deadline = performance.now() + COUNTDOWN_SECONDS * 1000
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline - performance.now()) / 1000))
      setSeconds(remaining)
      if (remaining === 0) {
        window.clearInterval(timer)
        onComplete()
      }
    }, 50)
    return () => window.clearInterval(timer)
  }, [onComplete])
  return <section className="panel" aria-live="polite">
    <h2>Приготовьтесь!</h2>
    <p className="countdown">{seconds || 'Старт!'}</p>
    <p>Вопрос появится после отсчёта.</p>
  </section>
}
