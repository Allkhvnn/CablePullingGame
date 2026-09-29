import { WIN_POSITION } from '../game/engine'

export function Rope({ position }: { position: number }) {
  const offset = (Math.max(-WIN_POSITION, Math.min(WIN_POSITION, position)) / WIN_POSITION + 1) * 50
  return <section className="rope-panel" aria-label="Положение каната">
    <div className="rope-labels"><span>Бот: −{WIN_POSITION}</span><span>Центр: 0</span><span>Вы: +{WIN_POSITION}</span></div>
    <div className="rope-track" role="img" aria-label={`Канат: ${position}. Плюс — к игроку, минус — к боту.`}>
      <span className="rope-center" />
      <span className="rope-marker" style={{ left: `${offset}%` }} />
    </div>
    <p>Положение: <strong>{position > 0 ? '+' : ''}{position}</strong> · Плюс — к вам, минус — к боту.</p>
  </section>
}
