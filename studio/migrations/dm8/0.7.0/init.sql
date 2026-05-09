USE kweaver;

CREATE TABLE IF NOT EXISTS t_studio_config (
    id INT IDENTITY(1,1) NOT NULL,
    kweaver_base_url VARCHAR(255 char) NULL,
    openclaw_address VARCHAR(255 char) NULL,
    openclaw_token VARCHAR(255 char) NULL,
    CLUSTER PRIMARY KEY (id)
);

COMMENT ON TABLE t_studio_config IS 'DIP Studio 平台配置';
COMMENT ON COLUMN t_studio_config.id IS '自增主键';
COMMENT ON COLUMN t_studio_config.kweaver_base_url IS 'KWeaver 服务连接地址';
COMMENT ON COLUMN t_studio_config.openclaw_address IS 'OpenClaw 网关连接地址';
COMMENT ON COLUMN t_studio_config.openclaw_token IS 'OpenClaw 网关 Token';

CREATE TABLE IF NOT EXISTS t_digital_employee (
    id CHAR(36) NOT NULL,
    kweaver_token VARCHAR(255 char) NULL,
    bkn_scope VARCHAR(4096 char) NULL,
    is_deleted TINYINT NOT NULL DEFAULT 0,
    CLUSTER PRIMARY KEY (id)
);

COMMENT ON TABLE t_digital_employee IS '数字员工信息表';
COMMENT ON COLUMN t_digital_employee.id IS '数字员工 ID，等同于 agentId';
COMMENT ON COLUMN t_digital_employee.kweaver_token IS '数字员工的 KWeaver Token';
COMMENT ON COLUMN t_digital_employee.bkn_scope IS '数字员工的知识范围，逗号隔开的 id 列表';
COMMENT ON COLUMN t_digital_employee.is_deleted IS '标记数字员工是否被删除';
