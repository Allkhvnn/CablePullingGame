import type { HeroId } from '../../shared/protocol'

const colors: Record<HeroId, { body: string; face: string; detail: string }> = {
  fox: { body: '#ed8b4a', face: '#ffc791', detail: '#9e4c35' },
  bear: { body: '#8f6caa', face: '#c9a4da', detail: '#634c7e' },
  owl: { body: '#5b9bb4', face: '#b9dce8', detail: '#346e87' },
  cat: { body: '#e7ad56', face: '#ffe0a6', detail: '#9d672f' },
}

export function HeroFigure({ hero, className = '', mood = 'normal' }: {
  hero: HeroId; className?: string; mood?: 'normal' | 'happy' | 'sad'
}) {
  const color = colors[hero]
  return <svg className={className} viewBox="0 0 110 110" fill="none" aria-hidden="true">
    <ellipse cx="55" cy="105" rx="37" ry="4" fill="#173d36" opacity=".18" />
    <path d="M45 73 37 98M65 73l8 25" stroke={color.detail} strokeWidth="11" strokeLinecap="round" />
    <path d="M35 62 19 72M75 62l16 10" stroke={color.body} strokeWidth="12" strokeLinecap="round" />
    <circle cx="19" cy="72" r="6" fill={color.face} /><circle cx="91" cy="72" r="6" fill={color.face} />
    <path d="M33 57c0-12 10-20 22-20s22 8 22 20v29H33V57Z" fill={color.body} />
    <path d="M42 49h26v23H42z" fill={color.face} opacity=".28" />
    {hero === 'fox' && <><path d="M24 32 31 4l18 12M86 32 79 4 61 16" fill={color.body} stroke={color.detail} strokeWidth="2" /><path d="M31 16 34 29l10-8M79 16 76 29l-10-8" fill={color.face} /></>}
    {hero === 'bear' && <><circle cx="32" cy="19" r="13" fill={color.body} /><circle cx="78" cy="19" r="13" fill={color.body} /><circle cx="32" cy="19" r="6" fill={color.face} /><circle cx="78" cy="19" r="6" fill={color.face} /></>}
    {hero === 'owl' && <><path d="M24 33 27 8l17 12M86 33 83 8 66 20" fill={color.body} /><path d="M41 12c5-9 10-10 14-4 4-6 9-5 14 4" stroke={color.detail} strokeWidth="5" strokeLinecap="round" /></>}
    {hero === 'cat' && <><path d="M25 31 28 5l19 14M85 31 82 5 63 19" fill={color.body} stroke={color.detail} strokeWidth="2" /><path d="M31 14 33 28l10-7M79 14 77 28l-10-7" fill={color.face} /></>}
    <ellipse cx="55" cy="39" rx="32" ry="29" fill={color.body} />
    <ellipse cx="55" cy="49" rx="22" ry="16" fill={color.face} />
    {hero === 'owl' ? <><circle cx="43" cy="36" r="10" fill="#fff" /><circle cx="67" cy="36" r="10" fill="#fff" />
      {mood === 'happy' ? <><path d="M38 37q5-5 10 0M62 37q5-5 10 0" stroke="#243e47" strokeWidth="2.5" strokeLinecap="round" /></>
        : <><circle cx="45" cy="37" r="4" fill="#243e47" /><circle cx="65" cy="37" r="4" fill="#243e47" /></>}
      <path d="m55 45-6 7h12l-6-7Z" fill="#edac57" />
      {mood === 'sad' && <path d="M48 56q7-5 14 0" stroke={color.detail} strokeWidth="2" strokeLinecap="round" />}</>
      : <>{mood === 'happy'
        ? <><path d="M40 37q4-5 8 0M62 37q4-5 8 0" stroke="#27383b" strokeWidth="2.5" strokeLinecap="round" /></>
        : <><ellipse cx="44" cy="36" rx="3" ry="4" fill="#27383b" /><ellipse cx="66" cy="36" rx="3" ry="4" fill="#27383b" /></>}
        <path d="m51 48 4 3 4-3-4-2-4 2Z" fill={color.detail} />
        <path d={mood === 'sad' ? 'M48 59q7-7 14 0' : mood === 'happy' ? 'M47 54q8 10 16 0' : 'M48 55q7 6 14 0'}
          stroke={color.detail} strokeWidth="2" strokeLinecap="round" /></>}
    {hero === 'cat' && <><path d="M36 49 24 47M36 54 24 56M74 49l12-2M74 54l12 2" stroke={color.detail} strokeWidth="2" strokeLinecap="round" /></>}
  </svg>
}
