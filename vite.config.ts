import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Для небольшого набора тестов достаточно одного рабочего процесса.
  test: { maxWorkers: 1 },
})
