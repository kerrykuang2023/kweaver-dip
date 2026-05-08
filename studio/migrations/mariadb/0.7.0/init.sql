CREATE DATABASE IF NOT EXISTS kweaver DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE kweaver;

CREATE TABLE IF NOT EXISTS t_studio_config (
  id INT NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  kweaver_base_url VARCHAR(255) NULL COMMENT 'KWeaver 服务连接地址',
  openclaw_address VARCHAR(255) NULL COMMENT 'OpenClaw 网关连接地址',
  openclaw_token VARCHAR(255) NULL COMMENT 'OpenClaw 网关 Token',
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='DIP Studio 平台配置';

CREATE TABLE IF NOT EXISTS t_digital_employee (
  id CHAR(36) NOT NULL COMMENT '数字员工 ID，等同于 agentId',
  app_id CHAR(36) NULL COMMENT '数字员工绑定的应用账号 ID',
  kweaver_token VARCHAR(255) NULL COMMENT '数字员工的 KWeaver Token',
  bkn_scope VARCHAR(4096) NULL COMMENT '数字员工的知识范围，逗号隔开的 id 列表',
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE COMMENT '标记数字员工是否被删除',
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='数字员工信息表';
