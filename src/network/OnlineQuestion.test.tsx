// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { OnlineQuestion } from './OnlineQuestion'

afterEach(cleanup)
const question = { id: '1', text: 'Вопрос?', options: ['A', 'B', 'C', 'D'] as const }
it('не рассчитывает ход локально и блокирует повторную отправку до ответа сервера', () => {
  const send = vi.fn(() => true)
  render(<OnlineQuestion question={question} energy={2} disabled={false} submitted={false} onAction={send} />)
  expect((screen.getByRole('radio', { name: '3' }) as HTMLInputElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('radio', { name: '2' }))
  fireEvent.click(screen.getByRole('radio', { name: 'B' }))
  fireEvent.click(screen.getByRole('button', { name: 'Подтвердить' }))
  fireEvent.click(screen.getByRole('button', { name: 'Отдохнуть' }))
  expect(send).toHaveBeenCalledExactlyOnceWith({ type: 'answer', answer: 1, bet: 2 })
  expect(screen.getByText('Отправляем ход…')).toBeTruthy()
})
it('не разрешает ход на паузе или если сервер уже принял действие', () => {
  const send = vi.fn(() => true)
  const view = render(<OnlineQuestion question={question} energy={5} disabled submitted={false} onAction={send} />)
  fireEvent.click(screen.getByRole('button', { name: 'Отдохнуть' }))
  expect(send).not.toHaveBeenCalled()
  view.rerender(<OnlineQuestion question={question} energy={5} disabled={false} submitted onAction={send} />)
  fireEvent.click(screen.getByRole('button', { name: 'Отдохнуть' }))
  expect(send).not.toHaveBeenCalled()
})
