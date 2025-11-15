好，这一大坨信息我帮你收敛成一份**给 AI 写代码用的需求文档 + 简单“画板/流程图”**。

下面所有字段名、接口路径、过滤条件我都按你提供的整理好了，你可以直接丢给写代码的 AI。



------





## **0. 目标 & 场景**





> 写一个 **Node.js + TypeScript 常驻脚本**，定时扫描“待执行任务”，

> 并在每个账户**最早任务执行时间的前 3 分钟**，检查该账户是否启用；

> 若未启用，则自动调用接口启用账户。



------





## **1. 运行环境 & 配置项**





脚本运行环境：



- Node.js（建议 18+）
- TypeScript





脚本需要可配置（可用 .env 或 config 文件）：



1. TEAM_ID：团队 ID（示例：500039）
2. JOB_API_TOKEN：任务相关接口的 token
3. ACCOUNT_API_TOKEN：账户相关接口的 token（可能与上面的不同）
4. JOB_LIST_BASE_URL：https://splay-admin.lnkaishi.cn/batch/job/list
5. JOB_DETAIL_BASE_URL：https://splay-admin.lnkaishi.cn/batch/job/detail
6. ACCOUNT_LIST_BASE_URL：https://splay-admin.lnkaishi.cn/tf/account/list
7. ACCOUNT_STATUS_BASE_URL：https://splay-admin.lnkaishi.cn/tf/account/status
8. JOB_LIST_PAGE_SIZE：每次拉取任务数量，默认 500
9. POLL_INTERVAL_MS：周期性拉任务的时间间隔，例如 60 * 1000（1 分钟）
10. CHECK_LEAD_TIME_MINUTES：提前多久检查账户，默认 3
11. ACCOUNT_FILTER_CREATE_USER_NAME：只选 create_user_name 为此值的账户，示例 "小红"
12. ACCOUNT_FILTER_COMPANY_SHORT_NAME：只选 company_short_name 为此值的账户，示例 "虎雨"
13. 时区假设：所有时间按 **Asia/Shanghai****（UTC+8）** 处理。





------





## **2. 对接的外部接口说明**







### **2.1 拉取“待执行任务列表”**





**HTTP**：GET /batch/job/list



示例 cURL：

```
curl --request GET \
  --url 'https://splay-admin.lnkaishi.cn/batch/job/list?team_id=500039&job_id=&status=Waiting&create_by=&start_time=&end_time=&page=1&page_size=500' \
  --header 'token: <JOB_API_TOKEN>'
```

关键点：



- 查询参数：

  

  - team_id：从配置读取
  - status=Waiting：只要“待执行”的任务
  - page：从 1 开始
  - page_size：配置（默认 500）

  

- 返回结构（关键字段）：



```
interface JobListResponse {
  code: number;              // 0 表示成功
  message: string;
  currentTime: number;
  data: {
    list: JobSummary[];
    // ... 还有分页信息等（如有）
  };
}

interface JobSummary {
  id: number;                        // 任务 ID
  is_scheduled: boolean;             // 是否定时任务
  scheduled_execution_time: string;  // "2025/11/15 23:35" 字符串
  create_by: string;
  create_time: string;
  execution_time: string;
  status: "Waiting" | string;
  result: string;
  finish_time: string;
}
```

注意：



- 只关心 status=Waiting 且 is_scheduled=true 且 scheduled_execution_time 不为空的任务。





------





### **2.2 查询任务详情（拿账户）**





**HTTP**：GET /batch/job/detail



示例 cURL：

```
curl --request GET \
  --url 'https://splay-admin.lnkaishi.cn/batch/job/detail?team_id=500039&job_id=500707' \
  --header 'token: <JOB_API_TOKEN>'
```

关键数据结构（简化）：

```
interface JobDetailResponse {
  code: number;
  message: string;
  currentTime: number;
  data: JobDetail;
}

interface JobDetail {
  account_ids: number[]; // 账户 ID 列表（不一定用）
  account_list: AccountItem[];
  // 其他很多 project / advertisement / creative_material 字段，可忽略
}

interface AccountItem {
  id: number;
  ad_account_id: string;      // 广告账户 ID（用于后续查询账户列表）
  ad_account_name: string;
  status: number;             // 1=启用, 2=停用（这里只是附带信息，实际以查询接口为准）
  // ...
}
```

脚本需求：



- 对于每个 JobSummary，调用一次 job/detail 接口；
- 从 data.account_list 中取出所有 ad_account_id（一个任务可能有多个账户）；
- 以 ad_account_id 作为“账户标识”参与后面的分组。





------





### **2.3 查询账户状态**





**HTTP**：GET /tf/account/list



示例 cURL：

```
curl --request GET \
  --url 'https://splay-admin.lnkaishi.cn/tf/account/list?team_id=500039&search_type=2&search_key=1843323896663043&page=1&page_size=10' \
  --header 'Token: <ACCOUNT_API_TOKEN>'
```

说明：



- search_type=2：按 ad_account_id 搜索；
- search_key：就是 JobDetail 里的 ad_account_id；
- page=1&page_size=10 固定即可；
- 请求头使用 token:（与任务接口的 token 一致）。





返回结构（简化）：

```
interface AccountListResponse {
  code: number;
  message: string;
  currentTime: number;
  data: {
    total_count: number;
    total_page: number;
    list: AccountRecord[];
  };
}

interface AccountRecord {
  id: number;                      // 用于启停接口的 id
  ad_account_id: string;
  ad_account_name: string;
  status: number;                  // 1=启用, 2=停用
  create_user_name: string;        // 过滤条件之一
  company_short_name: string;      // 过滤条件之一
  // ...
}
```

业务过滤逻辑：



- 从 data.list 中取 **第一个满足**：

  

  - create_user_name === "小红"（可配置）
  - 且 company_short_name === "虎雨"（可配置）

  

- 如果没有符合条件的记录：

  

  - 记录日志，跳过这个账户（不做启用操作）

  

- 如果找到了记录：

  

  - 若 status === 1 → 已启用 → 只记录日志，不调用启用接口
  - 若 status === 2 → 未启用 → 调用“开启账户接口”

  





------





### **2.4 开启账户接口**





**HTTP**：GET /tf/account/status



示例 cURL：

```
curl --request GET \
  --url 'https://splay-admin.lnkaishi.cn/tf/account/status?team_id=500039&id=633310&status=1' \
  --header 'token: <ACCOUNT_API_TOKEN>'
```

参数：



- team_id：同上配置
- id：选中的 AccountRecord.id
- status=1：启用





返回结构很简单：

```
interface AccountStatusResponse {
  code: number;    // 0 成功
  message: string; // "success"
  // ...
}
```



------





## **3. 核心业务流程（文字 + 流程图）**







### **3.1 高层流程描述**





1. 脚本启动后，每隔 POLL_INTERVAL_MS：

   

   1. 调 /batch/job/list 拉取 **全部** **Waiting** **状态的任务**（支持翻页，直到无更多任务；或只拉第一页先用）。

   2. 过滤出 is_scheduled=true 且有 scheduled_execution_time 的任务。

   3. 对每一个任务，调用 /batch/job/detail，从 account_list 中提取 ad_account_id。

   4. 构建：**账户 → 任务列表** 的映射：

      

      - key：ad_account_id
      - value：该账户对应的所有“待执行任务”的 scheduled_execution_time 列表。

      

   5. 对每个账户：

      

      - 计算该账户的最早执行时间 earliestTime（所有任务中最小的 scheduled_execution_time）。

      - 计算检查时间 checkTime = earliestTime - 3分钟。

      - 如果这个账户**之前已经为某个更早的** **earliestTime** **设置过检查任务**，则比较：

        

        - 如果新的 checkTime 更早 → 更新定时任务（清掉旧的，重新设置）。
        - 否则 → 保留旧的（因为已经会更早检查）。

        

      - 如果是第一次为该账户设置检查任务 → 新建定时任务。

      

   

2. **定时任务触发时（****checkTime** **这个时间点）：**

   

   1. 再次确认该账户当前是否还有“未执行任务”：

      

      - 可以重新拉 job/list + job/detail，确认这个账户仍然有 Waiting 任务（可选增强，防止任务被取消/改时间）。

      

   2. 调 /tf/account/list 查询当前账户记录：

      

      - 按 ad_account_id 查询；
      - 从 list 中选出第一个 create_user_name == 指定值 && company_short_name == 指定值 的记录。

      

   3. 如果匹配不到任何记录：写警告日志，结束。

   4. 如果找到记录：

      

      - status === 1 → 记录“已启用，无需处理”，结束；

      - status === 2 → 调 /tf/account/status 把 status 改成 1：

        

        - 若成功 → 记录“已启用账户 xxx”；
        - 若失败 → 记录错误日志，可考虑重试。

        

      

   





------





### **3.2 流程图（Mermaid）**





> 可以把这一段直接交给支持 Mermaid 的工具渲染成图。

```
flowchart TD

A[启动脚本] --> B[每隔 POLL_INTERVAL_MS 拉取任务列表 /batch/job/list]
B --> C{有 Waiting 任务?}
C -- 否 --> B
C -- 是 --> D[过滤 is_scheduled=true 且有 scheduled_execution_time 的任务]

D --> E[对每个任务调用 /batch/job/detail 获取 account_list.ad_account_id]
E --> F[按 ad_account_id 分组: 账户 -> 任务列表]
F --> G[对每个账户计算最早执行时间 earliestTime]
G --> H[checkTime = earliestTime - 3 分钟]

H --> I{该账户已有 check 任务?}
I -- 否 --> J[创建新的 setTimeout 定时任务在 checkTime 执行]
I -- 是 --> K{新的 checkTime 更早?}
K -- 否 --> L[保持原定时任务]
K -- 是 --> M[取消旧定时任务, 用新的 checkTime 重建]

J --> N[等待定时任务触发]
M --> N
L --> B

N --> O[定时时刻: 调 /tf/account/list 查询账户状态]
O --> P{找到符合 create_user_name & company_short_name 的记录?}
P -- 否 --> Q[记录日志: 无匹配账户, 结束]
P -- 是 --> R{status == 1 ?}
R -- 是 --> S[记录日志: 已启用, 不处理]
R -- 否 --> T[调用 /tf/account/status 启用账户]
T --> U[记录结果日志]
S --> B
Q --> B
U --> B
```



------





## **4. 数据模型建议（给 AI 的结构提示）**







### **4.1 任务相关**



```
type JobId = number;
type AdAccountId = string;

interface WaitingJob {
  jobId: JobId;
  scheduledExecutionTime: Date;
}

interface AccountJobGroup {
  adAccountId: AdAccountId;
  jobs: WaitingJob[];
  earliestExecutionTime: Date;
  checkTime: Date; // earliestExecutionTime - leadTime
}
```



### **4.2 定时任务管理**





使用一个 Map 来管理账户的检查定时器：

```
type TimeoutId = NodeJS.Timeout;

const accountCheckTimers = new Map<AdAccountId, TimeoutId>();
const accountCheckTimes = new Map<AdAccountId, Date>(); // 记录当前已设置的 checkTime
```

逻辑：



- 如果发现新的 checkTime 更早 → clearTimeout(oldTimer) 然后 setTimeout 新的。





------





## **5. 边界情况 & 处理策略**





1. **接口返回** **code != 0**：

   

   - 记录日志（含 URL + 参数 + 返回 message）；
   - 本次轮询该账户 / 该任务跳过，等待下次周期。

   

2. **解析时间失败 / 格式异常**：

   

   - 日志中记录该 taskId，跳过本任务。

   

3. **任务很多时的接口压力 & 并发**：

   

   - 调 /batch/job/detail 时可以做简单并发控制（比如最多 5–10 个同时）。

   

4. **脚本重启**：

   

   - 重启后 accountCheckTimers 都会丢失；
   - 启动时重新执行“一轮拉任务 + 算 earliestTime + 设置 checkTime”，即可恢复调度。

   

5. **多个任务很接近**：

   

   - 因为是按“账户最早任务时间”做提前 3 分钟检查，同一账户多个任务会被合并，避免多次重复启用。

   





------





## **6. 给 AI 的一句话开发任务说明**





> 请使用 Node.js + TypeScript 实现一个常驻脚本，按照以上接口和业务流程：



- > 定期拉取“待执行任务”，

- > 通过任务详情拿到 ad_account_id，按账户分组，

- > 计算每个账户最早执行时间，提前 3 分钟设置检查定时任务，

- > 在检查时查询账户状态，若停用则自动调用启用接口。

