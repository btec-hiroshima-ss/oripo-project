import pino from 'pino'

const LOG_BASE = process.env.LOG_FILE ?? '/var/log/app/app'
const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
const LOG_FILE = `${LOG_BASE}.${today}.log`

export const logger = pino(
  { level: process.env.LOG_LEVEL ?? 'info' },
  pino.multistream([
    { stream: process.stdout },
    { stream: pino.destination({ dest: LOG_FILE, sync: false, mkdir: true }) },
  ])
)
