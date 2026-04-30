"""OEM 配置数据库 Schema。"""

CREATE_OEM_CONFIG_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS `t_oem_config` (
    `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `language` VARCHAR(32) NOT NULL COMMENT '语言标识',
    `theme` VARCHAR(32) NOT NULL COMMENT '主题色',
    `logo` LONGTEXT NOT NULL COMMENT '浅色 Logo Base64 字符串',
    `dark_logo` LONGTEXT NOT NULL COMMENT '深色 Logo Base64 字符串',
    `portal_banner` LONGTEXT NOT NULL COMMENT '门户 Banner 文案或资源',
    `favicon` LONGTEXT NOT NULL COMMENT '站点图标 Base64 字符串',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE INDEX `idx_language` (`language`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='OEM 配置表'
"""
