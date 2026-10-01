import type { HeroId, PlayerProfile } from '../../shared/protocol'
import { parsePlayerProfile } from '../../shared/protocol'
import { HeroFigure } from './HeroFigure'

const heroes: { id: HeroId; label: string; title: string }[] = [
  { id: 'fox', label: 'Лис', title: 'Смелый стратег' },
  { id: 'bear', label: 'Медведь', title: 'Крепкий соперник' },
  { id: 'owl', label: 'Сова', title: 'Мудрый игрок' },
  { id: 'cat', label: 'Кот', title: 'Ловкий игрок' },
]

export function ProfilePicker({ profile, onChange }: { profile: PlayerProfile; onChange: (value: PlayerProfile) => void }) {
  const invalidName = !parsePlayerProfile(profile)
  return <section className="panel profile-card" aria-label="Ваш персонаж">
    <span className="section-kicker">ВАШ ПЕРСОНАЖ</span>
    <h2>Кто выйдет на арену?</h2>
    <label className="profile-name-label" htmlFor="player-name">Имя игрока</label>
    <input id="player-name" autoComplete="nickname" maxLength={18} value={profile.name} aria-invalid={invalidName}
      onChange={event => onChange({ ...profile, name: event.target.value })} placeholder="Как вас зовут?" />
    <p className={'profile-hint' + (invalidName ? ' profile-hint--invalid' : '')}>
      {invalidName ? 'Введите имя: буквы, цифры, пробел, дефис или подчёркивание.' : 'До 18 символов: буквы, цифры, пробел, дефис.'}
    </p>
    <div className="hero-options" role="group" aria-label="Выберите героя">
      {heroes.map(hero => <button type="button" key={hero.id}
        className={'hero-option hero-option--' + hero.id + (profile.hero === hero.id ? ' is-selected' : '')}
        aria-pressed={profile.hero === hero.id}
        onClick={() => onChange({ ...profile, hero: hero.id })}>
        <HeroFigure hero={hero.id} className="hero-option__figure" />
        <strong>{hero.label}</strong><span>{hero.title}</span>
      </button>)}
    </div>
  </section>
}
