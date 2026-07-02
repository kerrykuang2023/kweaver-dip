# 数字员工 `Unknown column 'app_id'` 修复说明

## 一、现象
从 **0.6.x 覆盖升级到 0.7.0** 后，用 admin 操作数字员工报错：

- 新建 / 查询数字员工 → `Unknown column 'app_id' in 'SELECT'`
- 安装预置数字员工（**数据分析员 / BKN Creator**）→ `Unknown column 'app_id' in 'INSERT INTO'`，界面 **502 Bad Gateway**
- 绑定应用账户 → `DipStudio.UpstreamServiceError: Failed to query application accounts`，加载失败

## 二、原因
studio 0.7.0 给 `t_digital_employee` 表新增了 `app_id` 等列，但**升级脚本打包有缺陷**：

- 0.7.0 只提供了 `migrations/mariadb/0.7.0/init.sql`，里面用的是 `CREATE TABLE IF NOT EXISTS`；
- **没有** 0.6→0.7 的 `ALTER` 升级脚本。

结果：**全新安装**没问题（建表时就带 app_id）；但**升级安装**时 `t_digital_employee` 已存在，`IF NOT EXISTS` 整段跳过，**app_id 永远加不上** → 上述报错。

> 报错是 `Unknown column`（不是 `Table doesn't exist`），说明**表在、列缺**，补列即可，不动数据。

### 谁会中招 / 一句话判定

`app_id` 这行是**后来就地补进 init.sql 的**（5-13），且没写 ALTER 升级脚本。所以"有没有 app_id"取决于**建库那一刻镜像里 baked 的 init 是哪版**，跟"全新装 / 升级装"标签关系不大：

| 情形 | 是否中招 | 说明 |
| --- | --- | --- |
| **正式 0.7.0（2026-05-22 发布）全新装** | 否 | 空库建表，init 已含 app_id |
| **早期 0.7.0 构建（5-13 前的 nightly/镜像）全新装** | 是 | 当时 init 无 app_id；之后换新镜像也修不回（表已存在，`IF NOT EXISTS` 跳过） |
| **从 0.6.x 升级 / 存量库** | 是 | 表已存在，`IF NOT EXISTS` 跳过（已确认的客户情形） |

**一旦建错，重装新镜像也救不回，只能手动补列（本脚本）。** 不确定属于哪种，直接查一句：

```sql
USE kweaver;
SHOW COLUMNS FROM t_digital_employee LIKE 'app_id';
-- 有 1 行 = 正常；无输出 = 中招，跑本脚本
```

## 三、脚本做什么
`fix_digital_employee_appid.sh` 一次性：

1. 自动定位 MariaDB pod；
2. 给 `t_digital_employee` 补列 `app_id` / `bkn_scope` / `is_deleted` + 索引；
3. 补建 0.7.0 可能缺的新表（`t_studio_config` / `t_studio_user_preference` / `t_studio_account_token`）；
4. 验证 `app_id` 已存在。

**只做加列/加表（additive），不改不删任何已有数据。全部 `IF NOT EXISTS`，可重复执行。**

## 四、前置
- 能访问集群的 `kubectl`（非 k8s 用 `--direct`）；
- MariaDB **root 密码**（或对应库有 DDL 权限的账号）；
- studio 的库名，默认 `kweaver`（以你们部署为准，用 `--db` 覆盖）。

## 五、执行
把脚本传到能跑 `kubectl` 的机器（一般是部署节点）：

```bash
chmod +x fix_digital_employee_appid.sh
./fix_digital_employee_appid.sh
```
自动找 pod、提示输密码、确认后执行、最后打印验证结果。

常用变体：
```bash
./fix_digital_employee_appid.sh -n kweaver --pod mariadb-0        # 手动指定命名空间/pod
MARIADB_ROOT_PASSWORD=xxxx ./fix_digital_employee_appid.sh -y     # 非交互全自动
./fix_digital_employee_appid.sh --direct "mysql -h 127.0.0.1 -P 3306"   # docker compose / 裸机
./fix_digital_employee_appid.sh --db <库名>                       # 库名不是 kweaver 时
```

## 六、验证
脚本末尾会自动查。也可手动确认：
```bash
kubectl exec -i -n <ns> <mariadb-pod> -- \
  env MYSQL_PWD=<密码> mysql -uroot kweaver -e "SHOW COLUMNS FROM t_digital_employee LIKE 'app_id';"
# 输出 1 行 = 修好
```
然后回 DIP 界面：安装 数据分析员 / BKN Creator 不再 502；绑定应用账户列表能正常加载。

## 七、风险与回滚
- 风险低：只加列/加表，不触碰已有数据；`app_id` 允许 NULL，历史行不受影响。
- 若确需回退：`ALTER TABLE t_digital_employee DROP COLUMN app_id, DROP COLUMN bkn_scope, DROP COLUMN is_deleted;`（一般不需要）。
- 建议执行前对该库做一次 `mysqldump` 备份（几秒钟，图安心）。

## 八、注意
1. **达梦 / DM8**：不支持 `ADD COLUMN IF NOT EXISTS` 语法。请参照 `studio/migrations/dm8/0.7.0/init.sql` 的列定义，先 `SELECT` 判断再 `ALTER`。
2. **可能不止 studio 一处**：整版覆盖升级如果也漏跑了其它组件的 0.7.0 迁移（gbkn / hub / dsg / workflow 等），后续可能冒出别的 `Unknown column`。同套路：哪个组件报错，就补跑它 `migrations/.../0.7.0/` 的升级脚本。
3. **根治**：这是平台升级脚本打包缺陷。长期应在 `studio/migrations/mariadb/0.7.0/`（及 dm8）补一个幂等的 `01-*.sql` 升级脚本，让所有升级部署自动带上，无需手动跑本脚本。
