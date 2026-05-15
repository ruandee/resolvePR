// Neon HTTP client — designed for serverless (Vercel, Edge).
// Uses plain HTTPS, no persistent connections, no WebSocket setup needed.
// Pool would hang in serverless because it needs persistent WebSocket connections.

import { neon } from '@neondatabase/serverless'

const url = process.env.DATABASE_URL

// sql() is null when DATABASE_URL isn't set — routes fall back to Go proxy.
export const sql = url ? neon(url) : null
