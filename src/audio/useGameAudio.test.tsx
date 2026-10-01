// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useGameAudio } from './useGameAudio'

const oscillatorCount = vi.fn()

class FakeAudioContext {
  state = 'running'
  currentTime = 0
  destination = {}
  createOscillator() {
    oscillatorCount()
    return { type: '', frequency: { value: 0 }, connect: () => ({ connect: () => {} }), start: () => {}, stop: () => {} }
  }
  createGain() {
    return { gain: { setValueAtTime: () => {}, linearRampToValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} }, connect: () => {} }
  }
  close() { return Promise.resolve() }
  resume() { return Promise.resolve() }
}

beforeEach(() => {
  window.localStorage.clear()
  oscillatorCount.mockClear()
  vi.stubGlobal('AudioContext', FakeAudioContext)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it('plays a round event once despite repeated server updates, and respects mute across mounts', () => {
  const first = renderHook(() => useGameAudio())
  act(() => { first.result.current.unlock(); first.result.current.playOnce('round-1', 'pull') })
  act(() => first.result.current.playOnce('round-1', 'pull'))
  expect(oscillatorCount).toHaveBeenCalledTimes(2)

  act(() => first.result.current.toggle())
  expect(first.result.current.enabled).toBe(false)
  act(() => first.result.current.playOnce('round-2', 'win'))
  expect(oscillatorCount).toHaveBeenCalledTimes(2)
  first.unmount()

  const second = renderHook(() => useGameAudio())
  expect(second.result.current.enabled).toBe(false)
})
