import { WIN_POSITION } from '../game/engine'
import type { HeroId } from '../../shared/protocol'
import { HeroFigure } from './HeroFigure'

export function Rope({ position, playerLabel = 'Вы', opponentLabel = 'Бот', playerHero = 'fox', opponentHero = 'bear', pulling = false }: {
  position: number; playerLabel?: string; opponentLabel?: string
  playerHero?: HeroId; opponentHero?: HeroId; pulling?: boolean
}) {
  const offset = (Math.max(-WIN_POSITION, Math.min(WIN_POSITION, position)) / WIN_POSITION + 1) * 50
  return <section className="rope-panel" aria-label="Положение каната">
    <div className={'tug-stage' + (pulling ? ' tug-stage--pulling' : '')}
      role="img" aria-label={'Канат: ' + position + '. Плюс — к ' + playerLabel + ', минус — к ' + opponentLabel + '.'}>
      <div className="tug-stage__ground" />
      <div className="tug-stage__line" />
      <div className="tug-stage__team tug-stage__team--left" aria-hidden="true"><HeroFigure hero={opponentHero} className="tug-team__figure tug-team__figure--left" /><span>{opponentLabel.toUpperCase()}</span></div>
      <div className="tug-stage__team tug-stage__team--right" aria-hidden="true"><HeroFigure hero={playerHero} className="tug-team__figure tug-team__figure--right" /><span>{playerLabel.toUpperCase()}</span></div>
      <span className="tug-stage__boundary tug-stage__boundary--left" aria-hidden="true">−{WIN_POSITION}</span>
      <span className="tug-stage__boundary tug-stage__boundary--right" aria-hidden="true">+{WIN_POSITION}</span>
      <span className="tug-stage__center" aria-hidden="true" />
      <span className="tug-stage__knot" style={{ left: 12 + offset * .76 + '%' }} aria-hidden="true" />
      <span className="tug-stage__position" aria-hidden="true">{position > 0 ? '+' : ''}{position}</span>
    </div>
  </section>
}
