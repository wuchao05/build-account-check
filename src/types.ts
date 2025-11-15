export interface ApiResponse<T> {
  code: number;
  message: string;
  currentTime?: number;
  data?: T;
}

export interface JobSummary {
  id: number;
  is_scheduled: boolean;
  scheduled_execution_time?: string;
  create_by?: string;
  create_time?: string;
  execution_time?: string;
  status: string;
  result?: string;
  finish_time?: string;
}

export interface JobListData {
  list: JobSummary[];
  page?: number;
  page_size?: number;
  total?: number;
  total_page?: number;
}

export type JobListResponse = ApiResponse<JobListData>;

export interface AccountItem {
  id: number;
  ad_account_id: string;
  ad_account_name?: string;
  status?: number;
}

export interface JobDetail {
  account_ids?: number[];
  account_list: AccountItem[];
}

export type JobDetailResponse = ApiResponse<JobDetail>;

export interface AccountRecord {
  id: number;
  ad_account_id: string;
  ad_account_name?: string;
  status: number;
  create_user_name?: string;
  company_short_name?: string;
}

export interface AccountListData {
  total_count?: number;
  total_page?: number;
  list: AccountRecord[];
}

export type AccountListResponse = ApiResponse<AccountListData>;

export type AccountStatusResponse = ApiResponse<Record<string, never>>;

export interface WaitingJob {
  jobId: number;
  scheduledExecutionTime: Date;
}

export interface AccountJobGroup {
  adAccountId: string;
  jobs: WaitingJob[];
  earliestExecutionTime: Date;
  checkTime: Date;
}
