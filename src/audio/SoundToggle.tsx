export function SoundToggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return <button className="sound-toggle" type="button" onClick={onToggle}
    aria-label={enabled ? 'Выключить звук' : 'Включить звук'} aria-pressed={enabled}
    title={enabled ? 'Выключить звук' : 'Включить звук'}>
    <span aria-hidden="true">{enabled ? '♪' : '♪̸'}</span> Звук {enabled ? 'вкл.' : 'выкл.'}
  </button>
}
