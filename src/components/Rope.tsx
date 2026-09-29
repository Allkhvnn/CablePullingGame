import { WIN_POSITION } from '../game/engine'

export function Rope({ position, playerLabel = 'Вы', opponentLabel = 'Бот' }: { position: number; playerLabel?: string; opponentLabel?: string }) {
  const offset = (Math.max(-WIN_POSITION, Math.min(WIN_POSITION, position)) / WIN_POSITION + 1) * 50
  return <section className="rope-panel" aria-label="Положение каната">
    <div className="rope-labels"><span>{opponentLabel}: −{WIN_POSITION}</span><span>Центр: 0</span><span>{playerLabel}: +{WIN_POSITION}</span></div>
    <div className="rope-track" role="img" aria-label={`Канат: ${position}. Плюс — к игроку, минус — к боту.`}>
      <span className="rope-center" />
      <span className="rope-marker" style={{ left: `${offset}%` }} />
    </div>
    <p>Положение: <strong>{position > 0 ? '+' : ''}{position}</strong> · Плюс — {playerLabel}, минус — {opponentLabel}.</p>
  </section>
}
