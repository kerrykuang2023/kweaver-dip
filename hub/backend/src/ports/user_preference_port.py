"""
用户偏好持久化端口
"""
from abc import ABC, abstractmethod

from src.domains.user_preference import UserPreference


class UserPreferencePort(ABC):
    """用户偏好读写抽象。"""

    @abstractmethod
    async def get_by_user_id(self, user_id: str) -> UserPreference:
        """按用户 ID 读取偏好；无记录时返回默认空偏好。"""

    @abstractmethod
    async def upsert(self, user_id: str, preference: UserPreference) -> None:
        """插入或全量更新该用户的偏好 JSON。"""
