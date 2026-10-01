import { WIN_POSITION } from '../game/engine'

function TugTeam({ side }: { side: 'left' | 'right' }) {
  return <svg className={`tug-team__figure tug-team__figure--${side}`} viewBox="0 0 110 95" fill="none" aria-hidden="true">
    <ellipse cx="55" cy="89" rx="48" ry="5" fill="#20382c" fillOpacity=".13" />
    <path d="M55 50 37 83M55 50 78 83" stroke="currentColor" strokeWidth="12" strokeLinecap="round" />
    <path d="M55 44 25 52M55 44 79 52" stroke="currentColor" strokeWidth="11" strokeLinecap="round" />
    <path d="M41 35c0-8 6-14 14-14s14 6 14 14v21H41V35Z" fill="currentColor" />
    <circle cx="55" cy="16" r="13" fill="#f3c49e" />
    <path d="M42 13c3-13 21-16 27-2-8-3-14 0-20-3l-7 5Z" fill="#3a332d" />
    <circle cx="60" cy="17" r="1.5" fill="#493d34" />
    <circle cx="25" cy="52" r="6" fill="#f3c49e" />
    <circle cx="79" cy="52" r="6" fill="#f3c49e" />
  </svg>
}

export function Rope({ position, playerLabel = 'Вы', opponentLabel = 'Бот', pulling = false }: {
  position: number; playerLabel?: string; opponentLabel?: string; pulling?: boolean
}) {
  const offset = (Math.max(-WIN_POSITION, Math.min(WIN_POSITION, position)) / WIN_POSITION + 1) * 50
  return <section className="rope-panel" aria-label="Положение каната">
    <div className={'tug-stage' + (pulling ? ' tug-stage--pulling' : '')}
      role="img" aria-label={'Канат: ' + position + '. Плюс — к ' + playerLabel + ', минус — к ' + opponentLabel + '.'}>
      <div className="tug-stage__ground" />
      <div className="tug-stage__line" />
      <div className="tug-stage__team tug-stage__team--left" aria-hidden="true"><TugTeam side="left" /><span>{opponentLabel.toUpperCase()}</span></div>
      <div className="tug-stage__team tug-stage__team--right" aria-hidden="true"><TugTeam side="right" /><span>{playerLabel.toUpperCase()}</span></div>
      <span className="tug-stage__boundary tug-stage__boundary--left" aria-hidden="true">−{WIN_POSITION}</span>
      <span className="tug-stage__boundary tug-stage__boundary--right" aria-hidden="true">+{WIN_POSITION}</span>
      <span className="tug-stage__center" aria-hidden="true" />
      <span className="tug-stage__knot" style={{ left: 12 + offset * .76 + '%' }} aria-hidden="true" />
      <span className="tug-stage__position" aria-hidden="true">{position > 0 ? '+' : ''}{position}</span>
    </div>
  </section>
}
