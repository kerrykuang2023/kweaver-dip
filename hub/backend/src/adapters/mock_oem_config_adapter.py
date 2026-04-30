"""
Mock OEM 配置适配器

用于本地开发和测试时模拟数据库读取。
"""
from typing import Optional

from src.domains.oem_config import (
    OemConfigQuery,
    OemConfigStoredFields,
    OemConfigUpdate,
    default_oem_config_stored_fields,
)
from src.ports.oem_config_port import OemConfigPort


class MockOemConfigAdapter(OemConfigPort):
    """Mock OEM 配置适配器。"""

    async def get_oem_config(
        self,
        query: OemConfigQuery,
    ) -> Optional[OemConfigStoredFields]:
        """获取内存中的默认 OEM 配置。"""
        return default_oem_config_stored_fields(query.language)

    async def update_oem_configs(
        self,
        configs: list[OemConfigUpdate],
    ) -> list[OemConfigStoredFields]:
        """返回请求中的多语言 OEM 配置。"""
        return [
            OemConfigStoredFields(
                language=config.language,
                theme=config.theme,
                logo=config.logo,
                dark_logo=config.dark_logo,
                portal_banner=config.portal_banner,
                favicon=config.favicon,
            )
            for config in configs
        ]

    async def close(self):
        """关闭适配器（Mock 不需要实际关闭操作）。"""
        return None
