## Build Account Check Service

常驻脚本，按照需求文档自动拉取待执行任务、按账户聚合最早执行时间，并在提前 `CHECK_LEAD_TIME_MINUTES` 分钟时检查/自动启用广告账户。

### 快速开始

1. `cp .env.example .env` 并补齐接口地址、token 等配置。
2. `pnpm install`
3. 开发模式：`pnpm dev`（ts-node，方便实时查看日志）
4. 生产模式：
   ```bash
   pnpm build
   pnpm start
   ```

### 主要配置（全部来源于 `.env`）

| key | 说明 |
| --- | --- |
| `TEAM_ID` | 团队 ID，所有接口共用 |
| `API_TOKEN` | 同域名接口共用 token（job + account） |
| `JOB_LIST_BASE_URL`/`JOB_DETAIL_BASE_URL` | `/batch/job/list` & `/batch/job/detail` 完整 URL |
| `ACCOUNT_LIST_BASE_URL`/`ACCOUNT_STATUS_BASE_URL` | `/tf/account/list` & `/tf/account/status` 完整 URL |
| `JOB_LIST_PAGE_SIZE` | 每次拉取任务数量，默认 500 |
| `POLL_INTERVAL_MS` | 轮询间隔，默认 60s |
| `CHECK_LEAD_TIME_MINUTES` | 提前检查分钟数，默认 3 |
| `JOB_DETAIL_MAX_CONCURRENCY` | 拉取 job/detail 的并发上限，默认 5 |
| `ACCOUNT_FILTER_CREATE_USER_NAME` / `ACCOUNT_FILTER_COMPANY_SHORT_NAME` | 账户过滤条件 |
| `ENABLE_ACCOUNT_RECHECK` | 定时触发时再次确认账户是否仍有 Waiting 任务，默认启用 |
| `LOG_LEVEL` | `debug`/`info`/`warn`/`error` |

### 核心实现概览

- `scheduler.ts`: 周期性拉取待执行任务，调用 job/detail 得到账户列表，并为每个账户计算最早执行时间、设置定时器。重复拉取时只会更新更早的检查时间，且会清理已无任务的账户。
- `services/jobService.ts`: 封装 `/batch/job/list` 与 `/batch/job/detail`，处理分页、过滤、错误日志。
- `services/accountService.ts`: 负责查询账户 (`/tf/account/list`) 与调用启用接口 (`/tf/account/status`)。
- `time.ts`/`utils/concurrency.ts`: 提供东八区时间处理、简单并发控制等工具。
- 定时器触发时会（可配置）再次确认该账户是否仍存在未执行任务，避免误操作；随后查询账户状态，若停用则自动调用启用接口。

运行中所有关键动作都会打印带时间戳的日志，便于排查问题。`SIGINT`/`SIGTERM` 会被捕获，方便脚本优雅退出。
