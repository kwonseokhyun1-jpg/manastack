/**
 * Cloudflare Worker entry: routes /api/* to the Express app via Node HTTP compat.
 * Static files are served from dist/ via wrangler assets (see wrangler.jsonc).
 */
import http from 'node:http'
import { httpServerHandler } from 'cloudflare:node'
import app from './server/app.mjs'

const server = http.createServer(app)

export default httpServerHandler(server)
