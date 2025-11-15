import { appConfig } from './config';
import { logger } from './logger';
import { fetchJobDetail, fetchWaitingJobs } from './services/jobService';
import { findTargetAccount, enableAccount } from './services/accountService';
import { AccountJobGroup, JobSummary, WaitingJob } from './types';
import { formatDateTime, minutesBefore, millisUntil, parseScheduledTime } from './time';
import { runWithConcurrency } from './utils/concurrency';

type TimerEntry = {
  timeoutId: NodeJS.Timeout;
  checkTime: Date;
  earliestExecutionTime: Date;
  jobs: WaitingJob[];
};

const accountTimers = new Map<string, TimerEntry>();

export async function pollAndSchedule(): Promise<void> {
  try {
    const waitingJobs = await fetchWaitingJobs();
    const accountGroups = await buildAccountJobGroups(waitingJobs);

    logger.info(`Scheduling checks for ${accountGroups.length} accounts`);
    applySchedules(accountGroups);
  } catch (error) {
    logger.error('Polling and scheduling failed', error);
  }
}

async function buildAccountJobGroups(jobs: JobSummary[]): Promise<AccountJobGroup[]> {
  const accountJobs = new Map<string, WaitingJob[]>();
  const concurrency = appConfig.JOB_DETAIL_MAX_CONCURRENCY;

  await runWithConcurrency(jobs, concurrency, async (job) => {
    const scheduledTime = parseScheduledTime(job.scheduled_execution_time);
    if (!scheduledTime) {
      logger.warn(`Skipping job ${job.id} due to invalid scheduled_execution_time`);
      return;
    }

    const detail = await fetchJobDetail(job.id);
    if (!detail) {
      return;
    }

    const jobEntry: WaitingJob = { jobId: job.id, scheduledExecutionTime: scheduledTime };
    detail.account_list.forEach((account) => {
      if (!account.ad_account_id) {
        return;
      }
      const existing = accountJobs.get(account.ad_account_id);
      if (existing) {
        existing.push(jobEntry);
      } else {
        accountJobs.set(account.ad_account_id, [jobEntry]);
      }
    });
  });

  const leadMinutes = appConfig.CHECK_LEAD_TIME_MINUTES;
  const groups: AccountJobGroup[] = [];

  for (const [adAccountId, jobsList] of accountJobs.entries()) {
    if (!jobsList.length) {
      logger.warn(`Account ${adAccountId} has no waiting jobs after grouping, skipping.`);
      continue;
    }
    jobsList.sort(
      (a, b) => a.scheduledExecutionTime.getTime() - b.scheduledExecutionTime.getTime()
    );
    const [firstJob] = jobsList;
    if (!firstJob) {
      continue;
    }
    const earliestExecutionTime = firstJob.scheduledExecutionTime;
    const checkTime = minutesBefore(earliestExecutionTime, leadMinutes);
    groups.push({
      adAccountId,
      jobs: jobsList,
      earliestExecutionTime,
      checkTime
    });
  }

  return groups;
}

function applySchedules(groups: AccountJobGroup[]): void {
  const currentAccounts = new Set<string>();

  groups.forEach((group) => {
    currentAccounts.add(group.adAccountId);
    const existing = accountTimers.get(group.adAccountId);
    if (existing && existing.checkTime <= group.checkTime) {
      logger.debug(
        `Existing timer for account ${group.adAccountId} is earlier (${formatDateTime(
          existing.checkTime
        )}), skipping update`
      );
      return;
    }

    if (existing) {
      clearTimeout(existing.timeoutId);
    }

    const delay = millisUntil(group.checkTime);
    const timeoutId = setTimeout(() => {
      handleAccountCheck(group.adAccountId).catch((error) => {
        logger.error(`Account check for ${group.adAccountId} failed`, error);
      });
    }, delay);

    accountTimers.set(group.adAccountId, {
      timeoutId,
      checkTime: group.checkTime,
      earliestExecutionTime: group.earliestExecutionTime,
      jobs: group.jobs
    });

    logger.info(
      `Scheduled account ${group.adAccountId} check at ${formatDateTime(
        group.checkTime
      )} (earliest job ${formatDateTime(group.earliestExecutionTime)})`
    );
  });

  const accountsToRemove: string[] = [];
  for (const accountId of accountTimers.keys()) {
    if (!currentAccounts.has(accountId)) {
      accountsToRemove.push(accountId);
    }
  }

  accountsToRemove.forEach((accountId) => {
    const entry = accountTimers.get(accountId);
    if (entry) {
      clearTimeout(entry.timeoutId);
      accountTimers.delete(accountId);
      logger.info(
        `Cleared scheduled check for account ${accountId} because no waiting jobs were found`
      );
    }
  });
}

async function handleAccountCheck(adAccountId: string): Promise<void> {
  const timerEntry = accountTimers.get(adAccountId);
  if (timerEntry) {
    accountTimers.delete(adAccountId);
  }

  logger.info(`Executing account check for ${adAccountId}`);

  if (appConfig.ENABLE_ACCOUNT_RECHECK) {
    const stillWaiting = await confirmAccountHasWaitingJobs(adAccountId);
    if (!stillWaiting) {
      logger.info(
        `Account ${adAccountId} no longer has waiting jobs. Skipping enablement logic.`
      );
      return;
    }
  }

  const accountRecord = await findTargetAccount(adAccountId);
  if (!accountRecord) {
    return;
  }

  if (accountRecord.status === 1) {
    logger.info(`Account ${adAccountId} is already enabled.`);
    return;
  }

  const result = await enableAccount(accountRecord.id);
  if (result) {
    logger.info(`Successfully enabled account ${adAccountId} (id=${accountRecord.id}).`);
  } else {
    logger.error(`Failed to enable account ${adAccountId} (id=${accountRecord.id}).`);
  }
}

async function confirmAccountHasWaitingJobs(adAccountId: string): Promise<boolean> {
  const waitingJobs = await fetchWaitingJobs();
  for (const job of waitingJobs) {
    const detail = await fetchJobDetail(job.id);
    if (!detail) {
      continue;
    }
    if (detail.account_list.some((account) => account.ad_account_id === adAccountId)) {
      return true;
    }
  }
  return false;
}
