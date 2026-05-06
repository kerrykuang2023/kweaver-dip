# Issue #167：侧边栏固定常用数字员工 — 逻辑设计

- **Issue**: [kweaver-ai/kweaver-dip#167](https://github.com/kweaver-ai/kweaver-dip/issues/167)
- **目标**: 用户可将常用数字员工固定到侧边栏，一键跳转会话页并切换员工，减少重复选择路径。
- **范围**: DIP Web 主应用侧栏与 dip-hub 用户偏好 API（`user/preferences`）。

---

## 1. 现状梳理

| 能力 | 实现要点 |
|------|----------|
| 会话与员工 | `Home` 提交后 `navigate('/studio/conversation?employee=…')`；`Conversation` 将 `employee` 传给 `DipChatKit` 的 `assignEmployeeValue`。 |
| 侧边栏结构 | `HomeSider` / `AdminSider` 在 `hasStudio` 时渲染 `StudioMenuSection`、工作计划区、历史会话区；结构高度对称，新区域需两处一并接入。 |
| 已有「固定」范式 | `StoreMenuSection` + `usePreferenceStore`：钉住的微应用列表来自 `getApplications()` 过滤 `pinned`，变更走 `PUT …/applications/:key/pinned`，与用户账号绑定、跨设备一致。 |

---

## 2. 功能需求（验收口径）

1. **固定**：在合理场景下可将某数字员工加入「侧边栏固定列表」（入口见第 4 节）。
2. **展示**：在 Studio 侧栏中、与工作计划/历史会话类似的区块展示固定项（图标 + 名称_truncated；折叠侧栏时的表现与现有区块一致）。
3. **切换**：点击某固定项导航到 ` /studio/conversation?employee=<digitalHumanId>`（**新开会话语义**：不带 `sessionKey`，与从首页带员工进入一致；若产品后续要求「保留当前会话仅换员工」，再单独扩需求）。
4. **取消固定**：与钉应用类似，提供取消操作（如 hover 图钉或菜单），移除后列表与存储同步更新。
5. **一致性与清理**：若某 ID 对应员工已被删除或无权限访问，侧栏展示降级（占位或自动移除，见错误处理）；列表顺序稳定（见数据模型）。

---

## 3. 方案对比（持久化）

| 方案 | 优点 | 缺点 |
|------|------|------|
| **A. 后端偏好接口（推荐，与钉应用一致）** | 多设备一致；可审计；与现有 `preferenceStore` 模式统一。 | 需 **dip-hub**（或统一用户偏好服务）增加「数字员工钉选」读写接口；联调周期长。 |
| **B. 仅前端 localStorage（或其它客户端持久化）** | 实现快，不依赖后端发版。 | 换浏览器/清缓存丢失；与钉应用行为不一致；多 Tab 需 storage 事件或统一 store。 |
| **C. 扩展通用用户 KV** | 一次建模，后续其它偏好也可写入。 | 设计/评审成本更高，适合已有或计划中的通用偏好能力。 |

**已定稿**：采用 **方案 A**。dip-hub 提供 **`GET/PUT /api/dip-hub/v1/user/preferences`**，请求/响应体字段 `pinned_digital_human_ids`（有序，服务端最多 **30** 条）；持久化表 **`t_user_preference`**（主键 `user_id`，`content` 为 JSON）。前端 API：`getUserPreferences`、`putUserPreferences`（`web/apps/dip/src/apis/dip-hub/user/preferences.ts`）。

---

## 4. 数据模型

**逻辑模型（与存储无关）**

- `pinned_digital_human_ids: string[]` — 有序列表，前者先显示；**Hub 服务端上限 30**（侧栏展示可自行再截断）。
- 展示所需元数据：`id` + `name` + `icon_id`（或现有 `resolveDigitalHumanIconSrc` 所需字段）；可从 `getDigitalHumanList()` 缓存对齐，固定操作时也可写入快照以减少列表请求。

**校验**

- 固定前校验 ID 仍存在于当前用户可见列表（或接口返回 404 时移除该项）。
- 去重：同一 ID 只保留一份，重复固定幂等。

---

## 5. 模块与职责

1. **状态层**（新建或使用户偏好 store）  
   - `fetchPinned` / `pin` / `unpin` / `reorder`（可选）  
   - 与 `ProtectedRoute` 或登录后首次进入时的初始化策略对齐（参考 `fetchPinnedMicroApps` 的 token 级单飞）。

2. **UI：`PinnedDigitalHumansSection`（命名可按 i18n 调整）**  
   - 视觉与交互参考 `WorkPlanSection` / `HistorySection`：分区标题、列表、`collapsed` 时是否隐藏整块与现有规则一致。  
   - 插入位置建议：在 `StudioMenuSection` 之下、工作计划区之上（常用入口优先）；若产品强调与工作会话并列，可放在历史区之上。

3. **固定入口（可多选，按迭代裁剪）**  
   - **数字员工管理列表**：行内或更多菜单「固定到侧栏」。  
   - **会话/DipChatKit 顶栏**：当前选中员工旁「固定」开关（与 `togglePin` 行为一致）。  
   首期至少一处入口即可满足 issue 字面需求。

4. **路由高亮**  
   - `getSelectedKey` 基于 path 的 `studio-conversation`；固定项点击后不改变 `selectedKey` 逻辑，但可通过 `searchParams` 中 `employee` 与当前项比对做「子项高亮」（**可选增强**；无则仅主菜单高亮会话类路由）。

---

## 6. 错误与边界

- 接口失败：`message.error` 与 `preferenceStore` 现有风格一致。  
- 列表为空：不渲染该分区（与工作计划为空一致）。  
- 折叠侧栏：**不展示**扩展区块或仅展示窄条图标（与 `WorkPlanSection` 在 `collapsed` 行为对齐 —— 当前工作计划区在 `!collapsed` 才渲染，固定区建议同样）。  
- i18n：新增 `sider.pinnedDigitalHumans.*` 等键，中英补齐。

---

## 7. 测试建议

- Store：`pin`/`unpin` 幂等、上限裁剪、失败分支。  
- 组件：点击导航 URL 含正确 `employee`；取消固定后项消失。  
- 与 `HomeSider` + `AdminSider` 各渲染一条 smoke（或单测注入 props）。

---

## 8. 实施顺序建议

1. 定稿持久化方案（A 或 B）与接口契约（若 A）。  
2. 实现 store + `PinnedDigitalHumansSection`。  
3. 接入 `HomeSider` / `AdminSider`。  
4. 增加至少一处「固定」入口并完成 i18n。  
5. 联调 / 回归会话页 `employee` 与 `DipChatKit` 行为。

---

## 9. 自检（spec 完整性）

- 无未决 TBD：持久化在交付前需选定 A/B；若选 B，需在实现 PR 中注明迁移计划。  
- 与 issue 表述一致：固定、侧栏、快速切换。  
- 范围可控：不包含「跨页拖拽排序」等非 issue 要求，**reorder** 为可选。
