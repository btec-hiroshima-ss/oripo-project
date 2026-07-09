import pino from 'pino'

const LOG_FILE = process.env.LOG_FILE ?? '/var/log/app/app.log'

export const logger = pino(
  { level: process.env.LOG_LEVEL ?? 'info' },
  pino.multistream([
    { stream: process.stdout },
    { stream: pino.destination({ dest: LOG_FILE, sync: false, mkdir: true }) },
  ])
)
