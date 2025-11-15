import { appConfig } from './config';
import { logger } from './logger';
import { pollAndSchedule } from './scheduler';

let isPolling = false;

const MIN_POLL_INTERVAL_MS = 1_000;
const pollInterval = Math.max(appConfig.POLL_INTERVAL_MS, MIN_POLL_INTERVAL_MS);

async function runPollingCycle(): Promise<void> {
  if (isPolling) {
    logger.warn('Previous polling cycle still running. Skipping this interval.');
    return;
  }
  isPolling = true;
  try {
    await pollAndSchedule();
  } finally {
    isPolling = false;
  }
}

async function bootstrap(): Promise<void> {
  logger.info(
    `Starting account check service with poll interval of ${Math.round(pollInterval / 1000)}s`
  );
  await runPollingCycle();
  setInterval(runPollingCycle, pollInterval);
}

bootstrap().catch((error) => {
  logger.error('Fatal error during startup', error);
  process.exit(1);
});

const shutdown = (signal: NodeJS.Signals) => {
  logger.info(`Received ${signal}. Exiting.`);
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
