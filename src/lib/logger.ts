import pino from 'pino'

const streams: pino.StreamEntry[] = [{ stream: process.stdout }]

// LOG_FILE が明示的に設定されている場合のみファイルにも出力する。
// 本番は stdout のみ（docker logs で収集）。bind mount 時の権限問題を避けるため。
if (process.env.LOG_FILE) {
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const logFile = `${process.env.LOG_FILE}.${today}.log`
  streams.push({ stream: pino.destination({ dest: logFile, sync: false, mkdir: true }) })
}

export const logger = pino(
  { level: process.env.LOG_LEVEL ?? 'info', timestamp: pino.stdTimeFunctions.isoTime },
  pino.multistream(streams)
)
