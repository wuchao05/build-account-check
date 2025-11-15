import { httpClient } from '../httpClient';
import { logger } from '../logger';
import { appConfig } from '../config';
import { JobDetail, JobDetailResponse, JobListResponse, JobSummary } from '../types';

const jobListParams = {
  job_id: '',
  create_by: '',
  start_time: '',
  end_time: ''
};

export async function fetchWaitingJobs(): Promise<JobSummary[]> {
  const { JOB_LIST_BASE_URL, TEAM_ID, JOB_LIST_PAGE_SIZE, API_TOKEN } = appConfig;
  const waitingJobs: JobSummary[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const params = {
      ...jobListParams,
      team_id: TEAM_ID,
      status: 'Waiting',
      page,
      page_size: JOB_LIST_PAGE_SIZE
    };

    let response: JobListResponse;
    try {
      ({ data: response } = await httpClient.get<JobListResponse>(JOB_LIST_BASE_URL, {
        params,
        headers: { token: API_TOKEN }
      }));
    } catch (error) {
      logger.error(`Failed to fetch job list page ${page}`, error);
      throw error;
    }

    if (response.code !== 0 || !response.data) {
      logger.warn(
        `Job list API returned non-zero code (${response.code}) for page ${page}: ${response.message}`
      );
      throw new Error(`job/list failed with code ${response.code}`);
    }

    const list = response.data.list ?? [];
    const filtered = list.filter(
      (job) => job.status === 'Waiting' && job.is_scheduled && job.scheduled_execution_time
    );
    waitingJobs.push(...filtered);

    if (list.length < JOB_LIST_PAGE_SIZE) {
      hasMore = false;
    } else {
      page += 1;
    }
  }

  logger.debug(`Fetched ${waitingJobs.length} waiting scheduled jobs`);
  return waitingJobs;
}

export async function fetchJobDetail(jobId: number): Promise<JobDetail | null> {
  const { JOB_DETAIL_BASE_URL, TEAM_ID, API_TOKEN } = appConfig;
  let response: JobDetailResponse;

  try {
    ({ data: response } = await httpClient.get<JobDetailResponse>(JOB_DETAIL_BASE_URL, {
      params: { team_id: TEAM_ID, job_id: jobId },
      headers: { token: API_TOKEN }
    }));
  } catch (error) {
    logger.error(`Failed to fetch job detail for job ${jobId}`, error);
    return null;
  }

  if (response.code !== 0 || !response.data) {
    logger.warn(
      `Job detail API returned non-zero code (${response.code}) for job ${jobId}: ${response.message}`
    );
    return null;
  }

  const { account_list: accountList = [] } = response.data;
  if (!accountList.length) {
    logger.warn(`Job ${jobId} detail returned empty account list`);
    return null;
  }

  return response.data;
}
