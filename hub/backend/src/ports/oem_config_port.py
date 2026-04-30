"""
OEM 配置端口接口

定义 OEM 配置的持久化读取契约。
"""
from abc import ABC, abstractmethod
from typing import Optional

from src.domains.oem_config import (
    OemConfigQuery,
    OemConfigStoredFields,
    OemConfigUpdate,
)


class OemConfigPort(ABC):
    """OEM 配置端口接口。"""

    @abstractmethod
    async def get_oem_config(
        self,
        query: OemConfigQuery,
    ) -> Optional[OemConfigStoredFields]:
        """
        获取 OEM 配置。

        参数:
            query: 查询条件

        返回:
            Optional[OemConfigStoredFields]: 当前配置，不存在时返回 None
        """
        pass

    @abstractmethod
    async def update_oem_configs(
        self,
        configs: list[OemConfigUpdate],
    ) -> list[OemConfigStoredFields]:
        """
        批量更新 OEM 配置。

        参数:
            configs: 多语言完整更新参数

        返回:
            list[OemConfigStoredFields]: 更新后的入库字段列表
        """
        pass
