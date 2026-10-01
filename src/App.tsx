import { lazy, Suspense } from 'react'
import { OnlineGame } from './network/OnlineGame'

const TrainingApp = lazy(() => import('./TrainingApp'))
export default function App() {
  const training = new URLSearchParams(window.location.search).get('mode') === 'training'
  return training ? <Suspense fallback={<p>Загрузка тренировки…</p>}>
    <div className="training-topbar"><a href="/">← Онлайн-матч</a><span>ТРЕНИРОВКА С БОТОМ</span></div>
    <TrainingApp />
  </Suspense> : <OnlineGame />
}
