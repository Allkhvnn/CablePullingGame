// @vitest-environment jsdom
import { StrictMode } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './TrainingApp'
import { QuestionRound } from './components/QuestionRound'
import { questions } from './data/questions'
import { QUESTION_LIMIT, ROUND_DURATION_MS } from './game/engine'

function advance(ms: number) { act(() => vi.advanceTimersByTime(ms)) }
function start() {
  render(<StrictMode><App /></StrictMode>)
  fireEvent.click(screen.getByRole('button', { name: 'Начать игру' }))
  advance(3000)
}
beforeEach(() => vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'performance'] }))
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers() })

describe('Матч в React', () => {
  it('показывает правила и отсчёт 3–2–1 без игровых действий', () => {
    render(<StrictMode><App /></StrictMode>)
    expect(screen.getByRole('heading', { name: 'Правила' })).toBeTruthy()
    expect(vi.getTimerCount()).toBe(0)
    fireEvent.click(screen.getByRole('button', { name: 'Начать игру' }))
    expect(screen.getByText('3', { selector: '.countdown' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Подтвердить' })).toBeNull()
    advance(1000)
    expect(screen.getByText('2', { selector: '.countdown' })).toBeTruthy()
    advance(1000)
    expect(screen.getByText('1', { selector: '.countdown' })).toBeTruthy()
    advance(1000)
    expect(screen.getByRole('timer').textContent).toContain('12')
    expect(vi.getTimerCount()).toBe(1)
  })
  it('требует и ставку, и ответ; подтверждает раунд только один раз', () => {
    start()
    const confirm = screen.getByRole('button', { name: 'Подтвердить' }) as HTMLButtonElement
    expect(confirm.disabled).toBe(true)
    fireEvent.click(screen.getByRole('radio', { name: '3' }))
    expect(confirm.disabled).toBe(true)
    fireEvent.click(screen.getByRole('radio', { name: '56' }))
    expect(confirm.disabled).toBe(false)
    fireEvent.click(confirm)
    fireEvent.click(confirm)
    expect(screen.getByText('Завершено вопросов: 1/12')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Сверяем ответы…' })).toBeTruthy()
    expect(screen.queryByText(/Верный ответ:/)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Следующий вопрос' })).toBeNull()
    advance(900)
    expect(screen.getByText(/Верный ответ:/).textContent).toContain('56')
    expect(screen.getByText('Сила +3')).toBeTruthy()
    advance(2300)
    expect(vi.getTimerCount()).toBe(0)
    advance(ROUND_DURATION_MS * 2)
    expect(screen.getByText('Завершено вопросов: 1/12')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Следующий вопрос' }))
    expect(screen.getByRole('timer').textContent).toContain('12')
    expect(screen.getAllByRole('radio').every(el => !(el as HTMLInputElement).checked)).toBe(true)
  })
  it('тайм-аут не подтверждает выбранный ответ и останавливает таймер', () => {
    start()
    fireEvent.click(screen.getByRole('radio', { name: '1' }))
    fireEvent.click(screen.getByRole('radio', { name: '56' }))
    advance(ROUND_DURATION_MS)
    advance(900)
    expect(screen.getByText(/ВЫ · СПРАВА/)).toBeTruthy()
    expect(screen.getByText(/Время истекло/)).toBeTruthy()
    expect(screen.getByText('Сила 0')).toBeTruthy()
    advance(2300)
    expect(vi.getTimerCount()).toBe(0)
  })
  it('проводит все 12 раундов до результата и полностью сбрасывает реванш', () => {
    // Одинаковая последовательность случайных чисел делает бота предсказуемым.
    vi.spyOn(Math, 'random').mockReturnValue(0)
    start()
    for (let round = 0; round < QUESTION_LIMIT; round++) {
      fireEvent.click(screen.getByRole('button', { name: 'Отдохнуть' }))
      expect(screen.queryByText(/Верный ответ:/)).toBeNull()
      advance(3200)
      expect(screen.getByText(/Верный ответ:/)).toBeTruthy()
      expect(vi.getTimerCount()).toBe(0)
      fireEvent.click(screen.getByRole('button', { name: round === QUESTION_LIMIT - 1 ? 'Показать результат' : 'Следующий вопрос' }))
    }
    expect(screen.getByRole('heading', { name: 'Вы победили!' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Подтвердить' })).toBeNull()
    advance(ROUND_DURATION_MS * 2)
    expect(screen.getByText(/Матч завершён/).textContent).toContain('Сыграно раундов: 12')
    fireEvent.click(screen.getByRole('button', { name: 'Реванш' }))
    expect(screen.getByText('Завершено вопросов: 0/12')).toBeTruthy()
    expect(screen.getByText(/Вы · энергия/).textContent).toContain('5/5')
    expect(screen.getByText(/Бот · энергия/).textContent).toContain('5/5')
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('Канат: 0.')
    expect(screen.getByText('3', { selector: '.countdown' })).toBeTruthy()
    advance(3000)
    expect(screen.getByRole('heading', { name: questions[0]!.text })).toBeTruthy()
    expect(screen.getByRole('timer').textContent).toContain('12')
    expect(screen.getAllByRole('radio').every(el => !(el as HTMLInputElement).checked)).toBe(true)
    expect(vi.getTimerCount()).toBe(1)
  })
  it('очищает таймер при размонтировании', () => {
    const view = render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Начать игру' }))
    expect(vi.getTimerCount()).toBe(1)
    view.unmount()
    expect(vi.getTimerCount()).toBe(0)
    const round = render(<QuestionRound question={questions[0]!} energy={1} onAction={vi.fn()} />)
    expect((screen.getByRole('radio', { name: '2' }) as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByRole('radio', { name: '3' }) as HTMLInputElement).disabled).toBe(true)
    round.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('клик после срока становится тайм-аутом даже до срабатывания интервала', () => {
    const onAction = vi.fn()
    render(<QuestionRound question={questions[0]!} energy={5} onAction={onAction} />)
    fireEvent.click(screen.getByRole('radio', { name: '1' }))
    fireEvent.click(screen.getByRole('radio', { name: '56' }))
    vi.spyOn(performance, 'now').mockReturnValue(ROUND_DURATION_MS + 1)
    fireEvent.click(screen.getByRole('button', { name: 'Подтвердить' }))
    expect(onAction).toHaveBeenCalledExactlyOnceWith({ type: 'timeout' })
    fireEvent.click(screen.getByRole('button', { name: 'Отдохнуть' }))
    expect(onAction).toHaveBeenCalledTimes(1)
  })
})


