-- fix_studio_070_digital_employee.sql
-- Repairs the studio 0.7.0 upgrade gap on a DB upgraded from 0.6.x by image overlay.
--
-- Cause: studio 0.7.0 ships its schema only in migrations/mariadb/0.7.0/init.sql using
--   CREATE TABLE IF NOT EXISTS, with no 0.6->0.7 ALTER script. On an upgrade where
--   t_digital_employee already exists (without the 0.7.0 columns), IF NOT EXISTS is a no-op,
--   so app_id / bkn_scope / is_deleted are never added -> "Unknown column 'app_id'".
--
-- Symptoms fixed:
--   * Install built-in digital employee -> INSERT INTO t_digital_employee(... app_id ...) -> 502
--   * List / query digital employees    -> SELECT ... app_id ... -> Unknown column 'app_id'
--   * "Failed to query application accounts" if t_studio_account_token (new in 0.7.0) is missing
--
-- MariaDB: ADD COLUMN/INDEX IF NOT EXISTS make this idempotent (safe to re-run).
-- For 达梦/DM8 use studio/migrations/dm8/0.7.0/init.sql definitions instead (no IF NOT EXISTS;
-- check with SELECT before ALTER).

USE kweaver;

-- 1) Add the columns 0.7.0 introduced to the pre-existing digital-employee table.
ALTER TABLE t_digital_employee
  ADD COLUMN IF NOT EXISTS app_id     CHAR(36)      NULL COMMENT '数字员工绑定的应用账号 ID' AFTER id,
  ADD COLUMN IF NOT EXISTS bkn_scope  VARCHAR(4096) NULL COMMENT '数字员工的知识范围，逗号隔开的 id 列表',
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE COMMENT '标记数字员工是否被删除';

ALTER TABLE t_digital_employee
  ADD INDEX IF NOT EXISTS idx_t_digital_employee_app_id (app_id);

-- 2) Create any 0.7.0 tables that a partial/absent init left missing (no-op if already there).
CREATE TABLE IF NOT EXISTS t_studio_config (
  id INT NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  kweaver_base_url VARCHAR(255) NULL COMMENT 'KWeaver 服务连接地址',
  openclaw_address VARCHAR(255) NULL COMMENT 'OpenClaw 网关连接地址',
  openclaw_token VARCHAR(255) NULL COMMENT 'OpenClaw 网关 Token',
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='DIP Studio 平台配置';

CREATE TABLE IF NOT EXISTS t_studio_user_preference (
  user_id VARCHAR(255) NOT NULL COMMENT '用户ID（与登录主体一致，OAuth subject 等可能长于 36）',
  pinned_digital_human_ids JSON NOT NULL DEFAULT ('[]') COMMENT '侧栏钉选数字员工 ID 列表',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Studio 用户偏好表';

CREATE TABLE IF NOT EXISTS t_studio_account_token (
  f_id VARCHAR(255) NOT NULL COMMENT '主键；f_type=user 时为平台 userId；f_type=app 时为 appId（全表唯一）',
  f_type VARCHAR(16) NOT NULL COMMENT 'app：应用账号；user：用户代理 PAT',
  f_token TEXT NOT NULL COMMENT '访问 BKN 的令牌串',
  PRIMARY KEY (f_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='按主体（用户或应用）存储的 KWeaver/BKN 访问令牌';

-- Verify:
--   SHOW COLUMNS FROM t_digital_employee LIKE 'app_id';   -- expect 1 row
