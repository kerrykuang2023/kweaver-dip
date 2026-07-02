-- fix_studio_070_digital_employee_dm8.sql  (达梦 / DM8 版)
-- Same studio 0.7.0 upgrade gap as MariaDB, but DM8 syntax.
-- DM8 does NOT reliably support "ADD COLUMN IF NOT EXISTS", so this file is NOT blindly idempotent:
-- CHECK FIRST, then run only the ALTERs for columns that are missing.
--
-- Column defs taken verbatim from studio/migrations/dm8/0.7.0/init.sql.

USE kweaver;

-- 1) CHECK what already exists (run these SELECTs first):
--   SELECT COLUMN_NAME FROM ALL_TAB_COLUMNS
--     WHERE TABLE_NAME='T_DIGITAL_EMPLOYEE' AND COLUMN_NAME IN ('APP_ID','BKN_SCOPE','IS_DELETED');
--   (DM8 usually stores unquoted identifiers in UPPER CASE.)

-- 2) Add only the missing columns (skip any the check above already listed):
ALTER TABLE t_digital_employee ADD COLUMN app_id CHAR(36) NULL;
ALTER TABLE t_digital_employee ADD COLUMN bkn_scope VARCHAR(4096 char) NULL;
ALTER TABLE t_digital_employee ADD COLUMN is_deleted TINYINT DEFAULT 0 NOT NULL;

COMMENT ON COLUMN t_digital_employee.app_id IS '数字员工绑定的应用账号 ID';
COMMENT ON COLUMN t_digital_employee.bkn_scope IS '数字员工的知识范围，逗号隔开的 id 列表';
COMMENT ON COLUMN t_digital_employee.is_deleted IS '标记数字员工是否被删除';

-- 3) Index on app_id (skip if it already exists):
CREATE INDEX idx_t_digital_employee_app_id ON t_digital_employee (app_id);

-- 4) Create any missing 0.7.0 tables (CREATE TABLE IF NOT EXISTS is a no-op if present):
CREATE TABLE IF NOT EXISTS t_studio_config (
    id INT IDENTITY(1,1) NOT NULL,
    kweaver_base_url VARCHAR(255 char) NULL,
    openclaw_address VARCHAR(255 char) NULL,
    openclaw_token VARCHAR(255 char) NULL,
    CLUSTER PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS t_studio_user_preference (
    user_id VARCHAR(255) NOT NULL,
    pinned_digital_human_ids TEXT NOT NULL DEFAULT '[]',
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CLUSTER PRIMARY KEY (user_id)
);
CREATE TABLE IF NOT EXISTS t_studio_account_token (
    f_id VARCHAR(255) NOT NULL,
    f_type VARCHAR(16) NOT NULL,
    f_token TEXT NOT NULL,
    CLUSTER PRIMARY KEY (f_id)
);

-- Verify:
--   SELECT COLUMN_NAME FROM ALL_TAB_COLUMNS WHERE TABLE_NAME='T_DIGITAL_EMPLOYEE' AND COLUMN_NAME='APP_ID';
