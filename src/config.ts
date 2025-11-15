import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

loadEnv();

const boolSchema = z
  .preprocess((value) => {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      return value === 1;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['1', 'true', 'yes', 'y'].includes(normalized)) {
        return true;
      }
      if (['0', 'false', 'no', 'n'].includes(normalized)) {
        return false;
      }
    }
    return undefined;
  }, z.boolean())
  .default(true);

const configSchema = z.object({
  // Team identifier shared by every endpoint
  TEAM_ID: z.coerce.number().int().positive(),
  // Shared token for job + account APIs
  API_TOKEN: z.string().min(1, 'API_TOKEN is required'),
  // Full URL for /batch/job/list
  JOB_LIST_BASE_URL: z.string().url(),
  // Full URL for /batch/job/detail
  JOB_DETAIL_BASE_URL: z.string().url(),
  // Full URL for /tf/account/list
  ACCOUNT_LIST_BASE_URL: z.string().url(),
  // Full URL for /tf/account/status
  ACCOUNT_STATUS_BASE_URL: z.string().url(),
  // Page size when pulling waiting jobs
  JOB_LIST_PAGE_SIZE: z.coerce.number().int().positive().default(500),
  // How often to poll job/list in ms
  POLL_INTERVAL_MS: z.coerce.number().int().positive().default(60_000),
  // Minutes before earliest task to run account check
  CHECK_LEAD_TIME_MINUTES: z.coerce.number().positive().default(3),
  // Account filter: create_user_name
  ACCOUNT_FILTER_CREATE_USER_NAME: z.string().min(1),
  // Account filter: company_short_name
  ACCOUNT_FILTER_COMPANY_SHORT_NAME: z.string().min(1),
  // Max concurrency when fetching job/detail
  JOB_DETAIL_MAX_CONCURRENCY: z.coerce.number().int().positive().default(5),
  // Whether to re-confirm account still has Waiting jobs at trigger time
  ENABLE_ACCOUNT_RECHECK: boolSchema,
  // Minimum log level to print
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info')
});

export type AppConfig = z.infer<typeof configSchema>;

export const appConfig: AppConfig = configSchema.parse(process.env);
