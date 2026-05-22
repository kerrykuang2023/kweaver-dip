---
name: auth-manager
version: "1.3.5"
user-invocable: true
description: >-
  数据权限管理技能：支持资源权限查询与权限申请。
  先判定“查询权限”还是“申请权限”，再按资源类型执行对应接口。
  当用户提出“申请权限”、“查是否有权限”、“给某资源授权”时使用。
metadata:
  openclaw:
    skillKey: auth-manager
allowed-tools: Bash(curl *), Bash(kweaver call *)
argument-hint: [权限需求描述，可包含 resource_type/resource_id/resource_name/applicant_id/applicant_name/applicant_account]
---

# 数据权限管理

> **渐进式加载**: [核心概念](./core/core.md) → [认证与 Token](./references/authentication.md) → [申请人发现](./references/applicant-discovery.md) → [资源发现](./references/resource-discovery.md) → [部门查询（独立）](./references/department-discovery.md) → [用户组查询（独立）](./references/group-discovery.md) → [用户组成员查询（独立）](./references/group-members-discovery.md) → [应用账户查询（独立）](./references/app-account-discovery.md) → [管理控制台用户搜索（独立）](./references/console-user-search.md) → [用户角色查询（独立）](./references/user-role-discovery.md) → [申请参考](./references/auth-apply.md) → [查询参考](./references/auth-query.md) → [数字员工查询（独立）](./references/digital-human-discovery.md) → [行列规则接口（独立）](./references/data-model-row-column-rules.md)
> **文档指南**: [README.md](./README.md) · **共享约束**: [core/core-constraints.md](./core/core-constraints.md)

本 skill 是权限管理统一入口，负责**意图识别、参数校验、接口路由**；HTTP 字段与示例在 `references/`，枚举清单在 `resources/`。

## 核心能力

| 能力 | 说明 | API 端点 |
|------|------|----------|
| 资源发现 | 当缺 `resource_id` 时按名称检索候选资源并回填 ID | 见 [`references/resource-discovery.md`](references/resource-discovery.md) |
| 申请人发现 | 当缺 `applicant_id` 时按用户名/账号检索候选并回填 ID | 见 [`references/applicant-discovery.md`](references/applicant-discovery.md) |
| 部门查询 | 查询指定成员可见部门列表，支撑按部门检索前置定位 | 见 [`references/department-discovery.md`](references/department-discovery.md) |
| 用户组查询 | 按关键词分页检索用户组 | 见 [`references/group-discovery.md`](references/group-discovery.md) |
| 用户组成员查询 | 按用户组查询成员列表 | 见 [`references/group-members-discovery.md`](references/group-members-discovery.md) |
| 应用账户查询 | 分页检索应用账户（app） | 见 [`references/app-account-discovery.md`](references/app-account-discovery.md) |
| 数字员工查询 | 查询数字员工列表与详情，支撑 `digital_employee` 检索 | 见 [`references/digital-human-discovery.md`](references/digital-human-discovery.md) |
| 管理控制台用户搜索 | 支持全量/按部门搜索用户，支撑申请人定位 | 见 [`references/console-user-search.md`](references/console-user-search.md) |
| 用户角色查询 | 支持按用户查角色、按角色查成员 | 见 [`references/user-role-discovery.md`](references/user-role-discovery.md) |
| 行列规则接口 | 查询 `data_model` 视图行列规则增删改查 | 见 [`references/data-model-row-column-rules.md`](references/data-model-row-column-rules.md) |
| 权限查询 | 批量校验是否具备所列操作 | `/api/auth-service/v1/data-resource/operations` |
| 权限申请 | 申请资源操作权限 | `/api/auth-service/v1/data-auth/apply` |
| 资源类型 | 校验 `resource_type` / `object_type` | [`resources/resource.md`](resources/resource.md) |
| 操作枚举 | 校验 `auth_operations` / `action` | [`resources/operations.md`](resources/operations.md) |
| 访问者类型 | 校验申请人 / `subject` 类型 | [`resources/accessors.md`](resources/accessors.md) |

## 技能入参

技能接受以下入参，大模型在调用技能时建议按此结构传递：

```json
{
  "query": "用户权限诉求（必须）",
  "context": "补充上下文，可包含资源ID、申请人、时间等（可选）"
}
```

### 入参说明

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `query` | string | **是** | **第一优先级**：识别「查询权限」或「申请权限」 |
| `context` | string | 否 | 填充 `resource_id`、`resource_name`、`resource_type`、`applicant_id`、`applicant_name`、`applicant_account`、`resources`、`action` 等，**不替代** `query` 的意图判定 |

### 入参使用场景总览

| 场景 | `query` | `context` |
|------|---------|-----------|
| 申请某类资源权限（数据视图 / 知识网络 / 行列规则等） | ✅ 须体现「申请 / 授权 / 开通」等 | ✅ 建议含 `resource_type` + (`resource_id` 或 `resource_name`) + (`applicant_id` 或 `applicant_name`/`applicant_account`) + 操作列表 |
| 批量查询是否具备指定操作 | ✅ 须体现「查询权限 / 是否可查 / 能否操作」等 | ✅ 建议含 (`resources` 或 `resource_name`) + `object_type` + 待校验 `action` |
| 仅澄清枚举（读文档） | ✅ 说明查阅目的 | 可选 |

### 入参职责区分

**重要**：不得混用职责。

| 入参 | 职责 |
|------|------|
| `query` | **意图路由**：只用于判定走申请还是查询（及是否属于本 skill） |
| `context` | **字段补齐**：提供调用接口所需的结构化信息，不改变 `query` 已确定的入口 |

### 使用优先级

1. **`query`** 始终必填，决定流程入口。  
2. **`context`** 在缺参时补齐；不得单独凭 `context` 反转 `query` 的「申请 / 查询」判定。  
3. **缺 `resource_id` 时先做资源发现**：通过资源检索接口获取候选并回填 ID（见 [`references/resource-discovery.md`](references/resource-discovery.md)）。  
4. **申请分支缺 `applicant_id` 时先做申请人发现**：通过用户名/账号检索接口获取候选并回填 ID（见 [`references/applicant-discovery.md`](references/applicant-discovery.md)）。  
5. 枚举与硬约束以 [`core/core-constraints.md`](core/core-constraints.md) 为准。

## 前置条件

- 可用的 **`Authorization: Bearer <access_token>`**（获取与携带方式见 **[references/authentication.md](./references/authentication.md)**）
- 可访问的 auth-service（如 `http://127.0.0.1:8155`）
- 请求头 `Content-Type: application/json`

**摘要**：用 **`kweaver call`** 时，可 **`kweaver auth login`** 从磁盘凭据自动带 Token；也可设置 **`KWEAVER_TOKEN` + `KWEAVER_BASE_URL`** 用环境变量静态 Token（CI 常用）。用 **`curl`/Postman/脚本** 时把 Token 放进 **`Authorization: Bearer …`** 或读自定义变量（详见上文链接）。

## 关键约束

> **详细约束（单一事实来源）**: [core/core-constraints.md](./core/core-constraints.md)

1. **先意图、后请求**：必须先完成步骤二「独立安全拦截 · 写操作」与「查询 vs 申请」判定及参数校验，再发 HTTP。  
2. **枚举原值**：`resource_type`、`auth_operations`、`applicant_type` 等与文档及 `enum.go` 一致，禁止同义词。  
3. **类型匹配**：操作码必须与资源类型可搭配。  
4. **行列规则**：`data_view_row_column_rule` 的 `row_rules` 须对照 [examples/row-rules.md](./examples/row-rules.md)。  
5. **申请前先查**：申请分支在提交 `/data-auth/apply` 前，需先按 [references/auth-query.md](./references/auth-query.md) 校验申请人是否已具备目标操作；若已具备则直接返回“无需申请”。  
6. **鉴权失败重试**：所有接口遇到 `401/403/Unauthorized/token expired` 时，必须先刷新 token，再重试原请求 **1 次**。  
7. **防死循环**：每个接口请求最多 2 次（首次 + 重试一次）；二次失败后立即返回原始错误，不得继续循环。  
8. **失败处理**：须保留接口原始错误信息，不得假称成功。  
9. **进度硬约束**：每完成门禁或分支内任一步，须立即输出一次「任务进度清单」；当前步未输出进度前**不得**进入下一步；失败即停，不得将后续步骤标为已完成。  
10. **写操作与安全拦截**：步骤二（意图识别）内**最先**执行「独立安全拦截 · 写操作」全条（见下文 **§1) 意图识别**）。命中业务数据写操作硬拦截，或敏感初检触发且**未能**满足「治理写操作例外」与放行语义时，须**立即终止**全流程，不得进入查询/申请分支及任何 HTTP；不得代用户生成或解释如何执行 DML、DDL、停机或可类比写指令；触发拦截时不得假称已放行。

## 门禁机制（必须先执行）

本节步骤一～三在上下文已校验时可跳过**重复执行**（如 Token 仍有效），但**不可跳过**进度输出；步骤四起不得省略。

### 0) Token 预检（每次回答前必须执行）→ **步骤一**

- **跳过条件（上下文已校验）**：当前对话上下文中，已有可复核的等价结论（例如前文已成功 `kweaver auth whoami` / `kweaver auth status` 显示 `active` 且未过期）。满足时**不得**重复登录，但必须本步输出进度：**「步骤一（Token 预检）：已跳过（上下文已校验）」**或 **「已校验通过（复用上下文）」**，并**一句**指明依据。  
- **非跳过**：先执行 `kweaver auth status`。  
- 若状态为 `active`：继续后续流程。  
- 若不可用（过期/缺失/401）：按 [`references/authentication.md`](./references/authentication.md) 的“预检与刷新标准流程”先刷新再继续。  
- 若使用 `KWEAVER_TOKEN` 静态凭据：不支持 refresh 换发，失效时需替换新 token。  
- 若 Token 缺失或过期且无法刷新：立即停止，提示用户登录或替换 Token。

### 0.1) 接口统一鉴权重试（所有接口）

- 适用于本技能下所有 HTTP 接口（申请、查询、资源发现、申请人发现、数字员工、行列规则 CRUD）。  
- 若首次调用返回 `401/403/Unauthorized/token expired`：先执行 token 刷新，再按**同参数**重试原请求一次。  
- 重试后仍失败：立即停止并返回原始错误。  
- 严禁无上限重试；必须显式维护“已重试一次”状态，防止死循环。

### 1) 意图识别 → **步骤二**

目标：在查询/申请分流前完成安全拦截，并判定流程入口。

- **写操作与安全拦截（必须在本节内最先执行，先于模糊澄清、查询/申请分流及其它任何路由）**  
  下列为本 skill **独立安全拦截 · 写操作** 规则：在权限治理与行列规则治理域内界定敏感字面初检、治理写操作例外与业务数据写操作硬拦截。  
  - **独立前置**：写操作与安全拦截为**独立前置规则**；须在**任意**模糊澄清、查询 vs 申请分流及 HTTP 调度**之前**完成拦截判定。  
  - **检测范围**：对用户本轮**全部表述**进行检测，含 `query`、`context`、补充说明、粘贴的 SQL/命令片段、多轮合并后的当前任务描述。  
  - **敏感英文关键字**（**大小写不敏感**）：须按**独立英文词**匹配 `\b…\b`（避免 `alternative` 误命中 `alter`），并**额外**将连续写法 `insertinto` 视为命中（不分词）。完整清单——删/破坏/撤销类：`delete`、`drop`、`rm`、`del`、`remove`、`truncate`、`clear`、`purge`、`erase`、`destroy`、`cancel`、`unset`、`discard`、`shutdown`；改类：`update`、`alter`、`modify`、`edit`、`change`、`revise`、`rewrite`、`replace`、`set`、`rename`；增/建/导入类：`insert`、`add`、`create`、`new`、`append`、`import`、`save`。推荐正则（`i` 忽略大小写）：`(?i)(\b(delete|drop|rm|del|remove|truncate|clear|purge|erase|destroy|cancel|unset|discard|shutdown|update|alter|modify|edit|change|revise|rewrite|replace|set|rename|insert|add|create|new|append|import|save)\b|insertinto)`。  
  - **敏感中文**（**子串命中**用于初检；**不**表示本入口可执行任意删改增或 DDL/停机）：删/清空类：`删除`、`移除`、`清空`、`清空数据`、`清除`、`销毁`、`作废`、`撤销`、`卸掉`、`删掉`、`剔除`；改类：`修改`、`更新`、`编辑`、`变更`、`改动`、`修订`、`改写`、`替换`、`重命名`、`调整`；增/导入类：`新增`、`添加`、`新建`、`插入`、`追加`、`导入`、`创建`、`保存`；DDL/运维与权限类：`建表`、`删表`、`改表`、`授权`、`回收权限`、`索引`、`库表`、`停机`。**说明**：子串命中**不单独**决定拦截；是否与放行语义冲突以**整体治理意图判定**为准。  
  - **治理写操作例外（意图优先于字面）**：若本轮表述在敏感英文词或敏感中文子串层面触发初检，但**整体可明确归类**为下列**本 skill 治理域**内操作，则**放行**，可进入后续查询/申请分流与 HTTP：  
    - **权限治理（读）**：查询是否具备权限、能否操作、权限校验、`effect` 判断等 → 查询分支。  
    - **权限治理（写）**：申请/授权/开通/续期资源操作权限（含 `data_query`、`view_detail`、`rule_apply` 等），走 `/data-auth/apply` → 申请分支。  
    - **行列规则治理**：对 `data_view_row_column_rule` / `data-view-row-column-rules` 的**规则对象**做创建、更新、删除或列表/详情查询（见 [`references/data-model-row-column-rules.md`](references/data-model-row-column-rules.md)）；整句主体为**规则**而非业务表行记录。  
    - **发现与组织检索（读）**：资源发现、申请人发现、部门/用户组/应用账户/控制台用户/角色/数字员工等检索。  
    做意图判定时须排除**明确的**业务数据删改、裸 DML/DDL、停机或破坏性指令主体；若整体意图歧义大到无法可信归类为上述治理域，按「命中后的强制行为」处理，不得放行。**但若命中下条「写操作硬拦截」，不得依据本条放行。**  
  - **写操作硬拦截（优于治理写操作例外）**：凡用户诉求可归为对**业务数据、业务记录、库表数据行**或等价对象执行 **删除操作** 或 **更新操作**（含同义：删掉/去掉/清除某条记录并不可恢复、就地改写或覆盖记录/字段主体、批量改数、灌数入库等），**一律拦截**，**不适用**「治理写操作例外」；明确要求执行 **`DELETE` / `UPDATE` / `INSERT` / `TRUNCATE` DML** 或可类比写语句的，同等处理；**建表 / 删表 / 改表**（非行列**规则**对象）、**停机**、**回收权限**（本 skill 主流程未提供对应接口时按越界处理）亦按硬拦截。**不因**句中出现「申请」「查询」「授权」「规则」等词而放行上述业务数据写操作。**不触发本条**、仍可经「治理写操作例外」的典型情形：全句仅为权限查询/申请/规则 CRUD/发现检索，且「删除」「更新」仅出现在**规则名、权限操作名、审计对象名**等名词性固定业务用词中（如「删除规则」「更新规则配置」指行列规则对象），且整句**无**执行业务记录删改或裸 DML 的义务或指令语气。  
  - **放行语义**：用户诉求**整体**可明确归类为上述治理域之一（含经「治理写操作例外」覆盖的敏感字面情形）、且**未**命中「写操作硬拦截」时，方可继续本节后续分流。  
  - **命中后的强制行为**：当命中「写操作硬拦截」，或敏感初检触发且**未能**满足「治理写操作例外」与放行语义（含：明确要求变更业务数据、裸 DDL/DML、停机、破坏性命令，或整体意图无法可信归类为治理域），**立即停止**门禁与编排，**不得**进入步骤三及查询/申请分支；输出简短**安全拒答**：说明本入口**仅支持权限治理与行列规则治理**，不协助直接变更业务数据、裸 DML/DDL、停机或破坏性命令；业务数据变更请通过数据治理、工单或 DBA/数据负责人流程处理；**不得**提供可执行的删改语句、绕过方式或逐步操作指南。  
  - **进度**：触发拦截时须输出「**独立安全拦截已触发 · 流程终止**」，不得将后续步骤标记为已完成。经「治理写操作例外」放行时，须输出「**独立安全拦截：敏感字面已识读，治理域意图放行**」后再进入后续模糊澄清与查询/申请分流。触发拦截时不得假称已放行。

- **查询权限**：检查是否有权、是否具备某些操作 → **查询分支**。  
- **申请权限**：授权、申请、开通 → **申请分支**。  
- 同轮两者皆有时先澄清顺序，**默认先查后申**。  
- 仅查阅枚举/文档、不涉及 HTTP 时：在进度中标注 **「阶段：文档查阅」**，可不走查询/申请分支 HTTP。  
- 诉求不在本 skill 范围（如工商企业问数、纯组织详情而无权限语义、或命中上文业务数据写操作硬拦截）时：在进度中标注 **「阶段：范围外」**或 **「阶段：安全拦截」**，说明边界并停止，不得假走权限接口。

### 2) 参数校验 → **步骤三**

- **申请**最小集：`resource_type`、`applicant_type`、`auth_operations`、`expired_at` + (`resource_id` 或 `resource_name`) + (`applicant_id` 或 `applicant_name`/`applicant_account`)。  
- **查询**最小集：`action` + (`resources` 或 (`resource_name` + `object_type`))。  
- 缺参则补齐，**禁止臆造** ID 或枚举。

### 2.1) applicant 存在性校验（实现对齐）

- 仅当 `applicant_id` 与**当前用户 ID 不一致**时执行存在性校验。  
- `applicant_type=digital_employee`：通过 `GET /api/dip-studio/v1/digital-human/{id}` 校验。  
- 其他 `applicant_type`：通过 user-management / authorization 相关接口校验。  
- 校验失败时必须停止后续申请并返回原始错误。

### 2.2) 申请前权限预检（新增）

- 仅适用于**申请分支**，且在 `resource_id`、`applicant_id`、`auth_operations` 补齐后执行。  
- 使用 `/api/auth-service/v1/data-resource/operations` 按同资源、同操作、同申请人进行预检（`subject=applicant`）。  
- 若预检结果对目标操作全部 `effect=true`：直接返回“该用户已具备权限，无需重复申请”。  
- 若存在 `effect=false`：继续调用 `/api/auth-service/v1/data-auth/apply` 发起申请。

### 3) 路由到分支 → **步骤四**

- 完成步骤一～三后，根据意图进入 **查询分支** 或 **申请分支**（见下文「子流程衔接」与「任务进度清单」）。  
- 不得在步骤四之前调用 `POST …/data-resource/operations` 或 `POST …/data-auth/apply`。

## 子流程衔接（序号连续）

- 总入口固定执行 **步骤一～四**（Token 预检 → 意图识别 → 参数校验 → 路由到分支）。  
- 路由到 **查询分支** 时，继续执行 **步骤 5～9**（见「任务进度清单（阶段：查询）」及 [`references/auth-query.md`](./references/auth-query.md)）。  
- 路由到 **申请分支** 时，继续执行 **步骤 5～12**（见「任务进度清单（阶段：申请）」及 [`references/auth-apply.md`](./references/auth-apply.md)）。  
- **动态编号规则**：令 **S** 为进入当前分支前已完成的最后一步编号（通常为 4），分支内全局步号为 **第 S+1 步 至 第 S+N 步**。  
- 子流程内引用「第 N 步」均以该连续编号为准；禁止跳步、并步、倒序。

### 查询分支（步骤 5～9）

5. **资源发现（按需）**：缺 `resources[].object_id` 时，按 [references/resource-discovery.md](./references/resource-discovery.md) 检索并回填；多候选须澄清。  
6. **枚举与类型校验**：核对 `object_type`、`action` 与 [resources/resource.md](resources/resource.md)、[resources/operations.md](resources/operations.md)。  
7. **构造查询请求体**：按 [references/auth-query.md](./references/auth-query.md) 组装 `resources`、`action`；可选 `subject`。  
8. **调用权限查询接口**：`POST /api/auth-service/v1/data-resource/operations`；失败即停，保留原始错误。  
9. **总结交付**：返回各资源 `effect`、最小口径（资源 ID/类型、操作列表、访问者），标注 **流程完成**。

### 申请分支（步骤 5～12）

5. **资源发现（按需）**：缺 `resource_id` 时，按 [references/resource-discovery.md](./references/resource-discovery.md) 检索并回填。  
6. **申请人发现（按需）**：缺 `applicant_id` 时，按 [references/applicant-discovery.md](./references/applicant-discovery.md) 检索并回填。  
7. **数字员工发现（按需）**：`applicant_type=digital_employee` 且仅有名称时，按 [references/digital-human-discovery.md](./references/digital-human-discovery.md) 确认 ID。  
8. **行列规则校验（按需）**：`resource_type=data_view_row_column_rule` 时，对照 [examples/row-rules.md](./examples/row-rules.md) 校验 `row_rules` / `resource_attributes`。  
9. **applicant 存在性校验（按需）**：`applicant_id` 与当前用户不一致时执行（见上文 **2.1**）。  
10. **申请前权限预检**：按 [references/auth-query.md](./references/auth-query.md) 校验目标操作；全部 `effect=true` 则返回「无需申请」并标注 **流程完成**。  
11. **构造并调用申请接口**：按 [references/auth-apply.md](./references/auth-apply.md) 组装并 `POST …/data-auth/apply`；失败即停，保留原始错误。  
12. **总结交付**：返回申请结果（成功/失败、申请单信息或原始错误）、所用资源与操作口径，标注 **流程完成**。

## 进度显示规范（必须执行）

- 总入口与查询/申请分支统一使用 **连续步骤编号** 展示进度。  
- 每完成一步，**立即**输出一次进度，不得仅在最后汇总时输出。  
- 进度输出须包含：**阶段名称**、**当前已完成步骤**、**下一步计划**。  
- 若当前步骤尚未输出进度，**不得进入下一步**。  
- 缺步、跳步或步骤失败时，**立即停止**并说明原因；不得将失败后的步骤标为已完成。  
- 分支结束时须在清单中标注最后一步「已完成」，并追加 **「流程完成」**。  
- 步骤一、二复用上下文时，以及进入查询/申请分支后，均继续使用同一模板（更新「已完成 / 待完成 / 进行中」状态）。

推荐模板：

```text
## 📋 任务进度清单（阶段：总控制台）
- [x] 已完成 · 步骤N（步骤名称）
- [ ] 待完成 · 步骤N+1（步骤名称）
```

## 标准进度输出示例

```text
## 📋 任务进度清单（阶段：查询）
- [x] 已完成 · 步骤5（资源发现）
- [x] 已完成 · 步骤6（枚举与类型校验）
- [ ] 进行中 · 步骤7（构造查询请求体）
- [ ] 待完成 · 步骤8（调用权限查询接口）
- [ ] 待完成 · 步骤9（总结交付）
```

```text
## 📋 任务进度清单（阶段：申请）
- [x] 已完成 · 步骤5（资源发现）
- [x] 已完成 · 步骤6（申请人发现）
- [ ] 进行中 · 步骤10（申请前权限预检）
- [ ] 待完成 · 步骤11（构造并调用申请接口）
- [ ] 待完成 · 步骤12（总结交付）
```

## 路由规则

### 1) 资源发现（缺 ID 时必走）

- `data_view`：`GET /api/mdl-data-model/v1/data-views?name=<resource_name>`。  
- `knowledge_network`：`GET /api/bkn-backend/v1/knowledge-networks?name_pattern=<resource_name>&offset=0&limit=20`。  
- 多候选时必须澄清目标资源；单候选可自动回填 `resource_id`。  

### 2) 申请人发现（申请缺 `applicant_id` 时必走）

- 优先按账号精确匹配：`GET /api/user-management/v1/account-match?account=<applicant_account>`。  
- 兜底按用户名搜索：`GET /api/user-management/v1/search-in-org-tree?keyword=<applicant_name>&type=user&role=<role>&offset=0&limit=20`。  
- 多候选时必须澄清目标申请人；单候选可自动回填 `applicant_id`。  
- 若回填后的 `applicant_id` 与当前用户一致，可跳过存在性校验并继续申请流程。  

### 2.1) 管理控制台用户搜索（全量 / 按部门）

- 接口：`GET /api/user-management/v1/console/search-users/{fields}`。  
- `name` **非必填**；可使用 `department_id`、`account`、`code` 等条件检索。  
- `role` 为**必填 query 参数**，且服务端会校验当前 token 用户是否拥有该角色。  
- `department_id` 缺失或 `-1`（未分配组）时，仅 `super_admin/sys_admin/sec_admin/audit_admin` 可用。  
- 详细规则见 [references/console-user-search.md](./references/console-user-search.md)。

### 2.2) 用户角色查询（按用户 / 按角色）

- 按用户查角色：`GET /api/user-management/v1/users/{user_ids}/{fields}`（`fields` 包含 `roles`，且 query 必填 `role`）。  
- 按角色查成员：`GET /api/user-management/v1/role-members/{roles}`。  
- 角色值需使用原始英文 code（`super_admin/sys_admin/audit_admin/sec_admin/org_manager/org_audit/normal_user`）。  
- 详细规则见 [references/user-role-discovery.md](./references/user-role-discovery.md)。

### 2.3) 组织对象检索（部门 / 用户组 / 应用账户）

- 部门查询：`GET /api/user-management/v1/management/department-members/{member_id}/departments`。  
- 用户组查询：`GET /api/user-management/v1/management/groups`。  
- 用户组成员：`GET /api/user-management/v1/management/group-members/{group_id}`。  
- 应用账户查询：`GET /api/user-management/v1/apps`。  
- 适用场景：当申请人定位依赖组织结构或组成员上下文时，先检索再回填候选对象。  
- 详细规则见 [references/department-discovery.md](./references/department-discovery.md)、[references/group-discovery.md](./references/group-discovery.md)、[references/group-members-discovery.md](./references/group-members-discovery.md)、[references/app-account-discovery.md](./references/app-account-discovery.md)。

### 3) 数字员工查询（独立检索）

- 列表：`GET /api/dip-studio/v1/digital-human`。  
- 详情：`GET /api/dip-studio/v1/digital-human/{id}`。  
- 当 `applicant_type=digital_employee` 且仅有名称时，先查询候选再确认 ID。  

### 4) 权限申请（`/data-auth/apply`）

- 支持的 `resource_type`：见 [resources/resource.md](resources/resource.md)。  
- `resource_id`、`auth_operations` 为数组；`expired_at` 为秒级时间戳。  
- `data_view_row_column_rule`：必填 `resource_attributes`；`row_rules` 见 [examples/row-rules.md](./examples/row-rules.md)。  
- `data_view`：可传 `apply_type`（可为空字符串）。

### 5) 权限查询（`/data-resource/operations`）

- 请求体：`resources`、`action`；可选 `subject`。  
- `object_type` / `action` 取值见 [resources/resource.md](resources/resource.md)、[resources/operations.md](resources/operations.md)。  
- `effect` 语义见 [references/auth-query.md](./references/auth-query.md)。

## 文档结构

```text
auth-manager/
├── README.md                   # 文档指南与分层索引
├── SKILL.md                    # 本文件 - 主入口
├── core/
│   ├── core.md                 # 核心概念 (L1)
│   └── core-constraints.md     # 共享约束（单一事实来源）
├── references/                 # HTTP 模板与示例 (L2)
│   ├── authentication.md       # Token 获取与 Authorization 携带
│   ├── applicant-discovery.md  # 用户名/账号到 applicant_id 的检索与回填
│   ├── resource-discovery.md   # 资源名到 resource_id 的检索与回填
│   ├── department-discovery.md # 部门查询（独立）
│   ├── group-discovery.md      # 用户组查询（独立）
│   ├── group-members-discovery.md # 用户组成员查询（独立）
│   ├── app-account-discovery.md # 应用账户查询（独立）
│   ├── console-user-search.md  # 管理控制台用户搜索（全量/按部门）
│   ├── user-role-discovery.md  # 用户角色查询（按用户/按角色）
│   ├── digital-human-discovery.md # 数字员工列表/详情查询（独立）
│   ├── data-model-row-column-rules.md # data_model 视图行列规则增删改查（独立）
│   ├── auth-apply.md           # 申请接口模板
│   └── auth-query.md           # 查询接口模板
├── resources/
│   ├── resource.md
│   ├── operations.md
│   └── accessors.md
└── examples/
    └── row-rules.md
```

## 渐进式加载指南

```text
用户请求
    │
    ├─ 仅需了解能力与端点 ──▶ core/core.md
    │
    ├─ Token / Bearer / kweaver CLI ──▶ references/authentication.md
    │
    ├─ 缺申请人ID（用户名/账号补齐） ──▶ references/applicant-discovery.md
    │
    ├─ 缺资源ID（资源名补齐） ──▶ references/resource-discovery.md
    │
    ├─ 查部门 / 组 / 组成员 / 应用账户 ──▶ references/department-discovery.md, references/group-discovery.md, references/group-members-discovery.md, references/app-account-discovery.md
    │
    ├─ 查全部用户 / 按部门查用户 ──▶ references/console-user-search.md
    │
    ├─ 查询用户角色 / 角色成员 ──▶ references/user-role-discovery.md
    │
    ├─ 申请权限 / 构造 apply 体 ──▶ references/auth-apply.md + resources/*
    │
    ├─ 批量查询是否可操作 ──▶ references/auth-query.md + resources/*
    │
    ├─ 搜索数字员工（独立） ──▶ references/digital-human-discovery.md
    │
    ├─ 查询行列规则 CRUD（独立） ──▶ references/data-model-row-column-rules.md
    │
    ├─ 行列规则 row_rules ──▶ examples/row-rules.md + core/core-constraints.md
    │
    └─ 争议或完整门禁 ──▶ SKILL.md + core/core-constraints.md
```

## 快速导航

| 文档 | 用途 |
|------|------|
| [README.md](./README.md) | 分层阅读指南 |
| [core/core.md](./core/core.md) | 核心概念与快速参考 (L1) |
| [core/core-constraints.md](./core/core-constraints.md) | **共享约束**（与实现对齐） |
| [references/authentication.md](./references/authentication.md) | **Token 获取**、`Bearer` 与 `kweaver call` 自动注入 |
| [references/applicant-discovery.md](./references/applicant-discovery.md) | 用户名/账号到 `applicant_id` 的检索与回填 |
| [references/resource-discovery.md](./references/resource-discovery.md) | 资源名到 `resource_id` 的检索与回填 |
| [references/department-discovery.md](./references/department-discovery.md) | 部门查询（独立） |
| [references/group-discovery.md](./references/group-discovery.md) | 用户组查询（独立） |
| [references/group-members-discovery.md](./references/group-members-discovery.md) | 用户组成员查询（独立） |
| [references/app-account-discovery.md](./references/app-account-discovery.md) | 应用账户查询（独立） |
| [references/console-user-search.md](./references/console-user-search.md) | 管理控制台用户搜索（全量/按部门） |
| [references/user-role-discovery.md](./references/user-role-discovery.md) | 用户角色查询（按用户/按角色） |
| [references/digital-human-discovery.md](./references/digital-human-discovery.md) | 数字员工列表与详情查询（独立） |
| [references/data-model-row-column-rules.md](./references/data-model-row-column-rules.md) | data_model 视图行列规则增删改查（独立） |
| [references/auth-apply.md](./references/auth-apply.md) | 权限申请 HTTP 模板 |
| [references/auth-query.md](./references/auth-query.md) | 权限批量校验 HTTP 模板 |
| [resources/resource.md](./resources/resource.md) | `resource_type` / `object_type` |
| [resources/operations.md](./resources/operations.md) | `auth_operations` / `action` |
| [resources/accessors.md](./resources/accessors.md) | 申请人 / 访问者类型 |
| [examples/row-rules.md](./examples/row-rules.md) | `row_rules` 示例 |
| `idrm-go-common/rest/authorization/enum.go` | 枚举源码 |

## 📋 任务进度清单（阶段：总控制台）

- [ ] 待完成 · 步骤一（Token 预检；若上下文已校验可跳过重复命令，须仍勾选并注明「已跳过（上下文已校验）」或等价表述）
- [ ] 待完成 · 步骤二（意图识别：**独立安全拦截 · 写操作（最先）**、查询 vs 申请；同轮双意图时澄清，默认先查后申；范围外/安全拦截/文档查阅须标注阶段）
- [ ] 待完成 · 步骤三（参数校验：申请/查询最小集；缺参补齐，禁止臆造）
- [ ] 待完成 · 步骤四（路由到分支并衔接连续编号）

## 📋 任务进度清单（阶段：查询）

- [ ] 待完成 · 步骤5（资源发现，按需）
- [ ] 待完成 · 步骤6（枚举与类型校验）
- [ ] 待完成 · 步骤7（构造查询请求体）
- [ ] 待完成 · 步骤8（调用权限查询接口）
- [ ] 待完成 · 步骤9（总结交付）

## 📋 任务进度清单（阶段：申请）

- [ ] 待完成 · 步骤5（资源发现，按需）
- [ ] 待完成 · 步骤6（申请人发现，按需）
- [ ] 待完成 · 步骤7（数字员工发现，按需）
- [ ] 待完成 · 步骤8（行列规则校验，按需）
- [ ] 待完成 · 步骤9（applicant 存在性校验，按需）
- [ ] 待完成 · 步骤10（申请前权限预检）
- [ ] 待完成 · 步骤11（构造并调用申请接口）
- [ ] 待完成 · 步骤12（总结交付）

## 典型调用

```text
/auth-manager 给用户申请 data_view 的 data_query 权限
/auth-manager 申请 knowledge_network 的查询与详情权限
/auth-manager 给某 data_view 申请行列规则权限（rule_apply）
/auth-manager 检查某个 data_view 是否具备 view_detail 权限
/auth-manager 查询“销售订单明细视图”当前用户是否有 data_query（未提供资源ID）
/auth-manager 给账号 zhangsan 开通“销售订单明细视图”的 data_query 权限（未提供用户ID）
/auth-manager 查询某个部门下的用户并按账号筛选
/auth-manager 根据角色查询成员用户（super_admin,sys_admin）
/auth-manager 查询应用账户列表（app）并定位目标账户
```

## 示例：未提供资源ID也可查询权限

```text
用户输入：
/auth-manager 查询“销售订单明细视图”我是否有 data_query 权限

技能执行（对应「阶段：查询」进度清单）：
1) 步骤一～四：Token 预检 → 意图=查询 → 参数校验 → 路由查询分支
2) 步骤5：发现缺少 resources[].object_id，触发资源发现
3) 调用 GET /api/mdl-data-model/v1/data-views?name=销售订单明细视图
4) 若仅 1 个候选：回填 object_id，构造 resources=[{object_id, object_type=data_view}]
5) 步骤6～8：枚举校验 → 构造请求体 → POST …/data-resource/operations，action=["data_query"]
6) 步骤9：返回 effect=true/false，标注流程完成
```

## 示例：按用户名补齐用户ID后授权

```text
用户输入：
/auth-manager 给账号 zhangsan 开通“销售订单明细视图”的 data_query 权限

技能执行（对应「阶段：申请」进度清单）：
1) 步骤一～四：Token 预检 → 意图=申请 → 参数校验 → 路由申请分支
2) 步骤5：发现缺少 resource_id，触发资源发现并回填 resource_id
3) 步骤6：发现缺少 applicant_id，调用 GET /api/user-management/v1/account-match?account=zhangsan
4) 回填 applicant_id 与 applicant_name（若缺失）
5) 步骤10：申请前权限预检（subject=applicant）
6) 步骤11～12：构造 apply 体 → POST …/data-auth/apply → 返回申请结果，标注流程完成
```
