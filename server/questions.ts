import { randomInt } from 'node:crypto'
import type { Question } from '../src/game/types'

// Этот модуль никогда не импортируется клиентом, даже тренировочным режимом.
const bank: readonly Question[] = [
  { id: 'online-1', text: 'Сколько будет 12 × 3?', options: ['24', '36', '48', '30'], correctAnswer: 1 },
  { id: 'online-2', text: 'Столица Казахстана?', options: ['Алматы', 'Тараз', 'Астана', 'Шымкент'], correctAnswer: 2 },
  { id: 'online-3', text: 'Сколько градусов в прямом угле?', options: ['90', '45', '180', '60'], correctAnswer: 0 },
  { id: 'online-4', text: 'Какая планета известна своими кольцами?', options: ['Марс', 'Венера', 'Меркурий', 'Сатурн'], correctAnswer: 3 },
  { id: 'online-5', text: 'Сколько букв в русском алфавите?', options: ['32', '33', '30', '26'], correctAnswer: 1 },
  { id: 'online-6', text: 'Какой орган перекачивает кровь?', options: ['Лёгкие', 'Печень', 'Сердце', 'Желудок'], correctAnswer: 2 },
  { id: 'online-7', text: 'Сколько будет 144 ÷ 12?', options: ['12', '14', '16', '10'], correctAnswer: 0 },
  { id: 'online-8', text: 'Как называется замёрзшая вода?', options: ['Пар', 'Туман', 'Роса', 'Лёд'], correctAnswer: 3 },
  { id: 'online-9', text: 'Какая единица измеряет электрическое сопротивление?', options: ['Ватт', 'Ом', 'Вольт', 'Ампер'], correctAnswer: 1 },
  { id: 'online-10', text: 'Сколько дней в високосном году?', options: ['365', '364', '366', '360'], correctAnswer: 2 },
  { id: 'online-11', text: 'Какое число является простым?', options: ['7', '9', '15', '21'], correctAnswer: 0 },
  { id: 'online-12', text: 'Какой материк покрыт льдом у Южного полюса?', options: ['Африка', 'Евразия', 'Австралия', 'Антарктида'], correctAnswer: 3 },
]
export function selectQuestions(): Question[] {
  const selected = bank.map(q => ({ ...q, options: [...q.options] as Question['options'] }))
  for (let i = selected.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[selected[i], selected[j]] = [selected[j]!, selected[i]!]
  }
  return selected
}
