import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { chdir } from 'process'

const __dirname = dirname(fileURLToPath(import.meta.url))
chdir(join(__dirname, 'frontend'))

const { createServer } = await import('./frontend/node_modules/vite/dist/node/index.js')

const server = await createServer({
  root: join(__dirname, 'frontend'),
  server: { port: 5173 },
})

await server.listen()
server.printUrls()
