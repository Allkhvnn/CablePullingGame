import type { CSSProperties } from 'react'
import { WIN_POSITION } from '../game/engine'
import type { HeroId } from '../../shared/protocol'
import { HeroFigure } from './HeroFigure'

export type HeroReaction = 'celebrate' | 'stumble' | null

export function Rope({ position, playerLabel = 'Вы', opponentLabel = 'Бот', playerHero = 'fox', opponentHero = 'bear', pulling = false, pullDelta = 0, leftReaction = null, rightReaction = null }: {
  position: number; playerLabel?: string; opponentLabel?: string
  playerHero?: HeroId; opponentHero?: HeroId; pulling?: boolean; pullDelta?: number
  leftReaction?: HeroReaction; rightReaction?: HeroReaction
}) {
  const offset = (Math.max(-WIN_POSITION, Math.min(WIN_POSITION, position)) / WIN_POSITION + 1) * 50
  const knotLeft = 12 + offset * .76 + '%'
  const teamShift = Math.max(-WIN_POSITION, Math.min(WIN_POSITION, position)) * 1.8
  const direction = pulling && pullDelta !== 0 ? (pullDelta > 0 ? ' tug-stage--pull-right' : ' tug-stage--pull-left') : ''
  return <section className="rope-panel" aria-label="Положение каната">
    <div className={'tug-stage' + direction}
      style={{ '--tug-shift': teamShift + 'px' } as CSSProperties}
      role="img" aria-label={'Канат: ' + position + '. Плюс — к ' + playerLabel + ', минус — к ' + opponentLabel + '.'}>
      <div className="tug-stage__ground" />
      <div className="tug-stage__line" />
      <div className="tug-stage__motion tug-stage__motion--left" aria-hidden="true" />
      <div className="tug-stage__motion tug-stage__motion--right" aria-hidden="true" />
      <div className={'tug-stage__team tug-stage__team--left' + (leftReaction ? ' tug-stage__team--' + leftReaction : '')} aria-hidden="true">
        <HeroFigure hero={opponentHero} mood={leftReaction === 'celebrate' ? 'happy' : leftReaction === 'stumble' ? 'sad' : 'normal'} className="tug-team__figure tug-team__figure--left" />
        {leftReaction && <span className="tug-stage__reaction">{leftReaction === 'celebrate' ? '★' : '!'}</span>}
        <span className="tug-stage__label">{opponentLabel.toUpperCase()}</span>
      </div>
      <div className={'tug-stage__team tug-stage__team--right' + (rightReaction ? ' tug-stage__team--' + rightReaction : '')} aria-hidden="true">
        <HeroFigure hero={playerHero} mood={rightReaction === 'celebrate' ? 'happy' : rightReaction === 'stumble' ? 'sad' : 'normal'} className="tug-team__figure tug-team__figure--right" />
        {rightReaction && <span className="tug-stage__reaction">{rightReaction === 'celebrate' ? '★' : '!'}</span>}
        <span className="tug-stage__label">{playerLabel.toUpperCase()}</span>
      </div>
      <span className="tug-stage__boundary tug-stage__boundary--left" aria-hidden="true">−{WIN_POSITION}</span>
      <span className="tug-stage__boundary tug-stage__boundary--right" aria-hidden="true">+{WIN_POSITION}</span>
      <span className="tug-stage__center" aria-hidden="true" />
      <span className="tug-stage__knot" style={{ left: knotLeft }} aria-hidden="true" />
      <span className="tug-stage__impact" style={{ left: knotLeft }} aria-hidden="true" />
      <span className="tug-stage__position" style={{ left: knotLeft }} aria-hidden="true">{position > 0 ? '+' : ''}{position}</span>
    </div>
  </section>
}
