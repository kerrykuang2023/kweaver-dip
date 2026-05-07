CREATE DATABASE IF NOT EXISTS kweaver DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE `kweaver`;

CREATE TABLE IF NOT EXISTS `t_studio_user_preference` (
    `user_id` VARCHAR(50) NOT NULL COMMENT '用户ID',
    `pinned_digital_human_ids` JSON NOT NULL DEFAULT ('[]') COMMENT '侧栏钉选数字员工 ID 列表',
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Studio 用户偏好表';

CREATE TABLE IF NOT EXISTS t_digital_employee (
  id CHAR(36) NOT NULL COMMENT '数字员工 ID，等同于 agentId',
  kweaver_token VARCHAR(255) NULL COMMENT '数字员工的 KWeaver Token',
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='数字员工信息表';
