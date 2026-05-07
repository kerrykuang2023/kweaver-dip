USE kweaver;

CREATE TABLE IF NOT EXISTS t_studio_user_preference (
    user_id VARCHAR(255) NOT NULL COMMENT '用户ID（与登录主体一致，OAuth subject 等可能长于 36）',
    pinned_digital_human_ids TEXT NOT NULL DEFAULT '[]' COMMENT '侧栏钉选数字员工 ID 列表（JSON 数组文本）',
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '更新时间',
    CLUSTER PRIMARY KEY (user_id)
);

COMMENT ON TABLE t_studio_user_preference IS 'Studio 侧栏钉选数字员工（每用户一行）';

CREATE TABLE IF NOT EXISTS t_digital_employee (
    id CHAR(36) NOT NULL,
    kweaver_token VARCHAR(255 char) NULL,
    CLUSTER PRIMARY KEY (id)
);

COMMENT ON TABLE t_digital_employee IS '数字员工信息表';
COMMENT ON COLUMN t_digital_employee.id IS '数字员工 ID，等同于 agentId';
COMMENT ON COLUMN t_digital_employee.kweaver_token IS '数字员工的 KWeaver Token';
