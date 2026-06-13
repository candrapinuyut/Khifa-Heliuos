import { defineConfig } from 'vite'

export default defineConfig({
  // main.ts boots with top-level await (fetch works.json before building the scene)
  build: { target: 'es2022' },
})
