import { httpClient } from "../httpClient";
import { logger } from "../logger";
import { appConfig } from "../config";
import {
  AccountListResponse,
  AccountRecord,
  AccountStatusResponse,
} from "../types";

export async function findTargetAccount(
  adAccountId: string
): Promise<AccountRecord | undefined> {
  const {
    ACCOUNT_LIST_BASE_URL,
    TEAM_ID,
    API_TOKEN,
    ACCOUNT_FILTER_COMPANY_SHORT_NAME,
    ACCOUNT_FILTER_CREATE_USER_NAME,
  } = appConfig;

  let response: AccountListResponse;
  try {
    ({ data: response } = await httpClient.get<AccountListResponse>(
      ACCOUNT_LIST_BASE_URL,
      {
        params: {
          team_id: TEAM_ID,
          search_type: 2,
          search_key: adAccountId,
          page: 1,
          page_size: 10,
        },
        headers: { token: API_TOKEN },
      }
    ));
  } catch (error) {
    logger.error(`Failed to fetch account list for ${adAccountId}`, error);
    return undefined;
  }

  if (response.code !== 0 || !response.data) {
    logger.warn(
      `Account list API returned non-zero code (${response.code}) for ${adAccountId}: ${response.message}`
    );
    return undefined;
  }

  const record = response.data.list.find((item) => {
    const userName = item.create_user_name ?? "";
    const matchesCreateUser = ACCOUNT_FILTER_CREATE_USER_NAME.some((keyword) =>
      userName.includes(keyword)
    );
    return (
      matchesCreateUser &&
      item.company_short_name === ACCOUNT_FILTER_COMPANY_SHORT_NAME
    );
  });

  if (!record) {
    logger.warn(
      `No account matches filters for ad_account_id=${adAccountId}. Expected create_user_name to include one of ${ACCOUNT_FILTER_CREATE_USER_NAME.join(
        ", "
      )} and company_short_name=${ACCOUNT_FILTER_COMPANY_SHORT_NAME}`
    );
  }

  return record;
}

export async function enableAccount(accountId: number): Promise<boolean> {
  const { ACCOUNT_STATUS_BASE_URL, TEAM_ID, API_TOKEN } = appConfig;
  let response: AccountStatusResponse;

  try {
    ({ data: response } = await httpClient.get<AccountStatusResponse>(
      ACCOUNT_STATUS_BASE_URL,
      {
        params: {
          team_id: TEAM_ID,
          id: accountId,
          status: 1,
        },
        headers: { token: API_TOKEN },
      }
    ));
  } catch (error) {
    logger.error(`Failed to enable account id=${accountId}`, error);
    return false;
  }

  if (response.code !== 0) {
    logger.error(
      `Enable account id=${accountId} failed with code ${response.code}: ${response.message}`
    );
    return false;
  }

  return true;
}
