"""
用户偏好 Mock 适配器（内存存储，用于 use_mock_services）
"""
import logging
from typing import Dict

from src.domains.user_preference import UserPreference
from src.ports.user_preference_port import UserPreferencePort

logger = logging.getLogger(__name__)


class MockUserPreferenceAdapter(UserPreferencePort):
    """进程内 dict，按 user_id 存储偏好。"""

    def __init__(self) -> None:
        self._store: Dict[str, UserPreference] = {}

    async def get_by_user_id(self, user_id: str) -> UserPreference:
        return self._store.get(user_id, UserPreference())

    async def upsert(self, user_id: str, preference: UserPreference) -> None:
        self._store[user_id] = UserPreference(
            pinned_digital_human_ids=list(preference.pinned_digital_human_ids),
        )
        logger.debug(
            "Mock 用户偏好已更新: user_id=%s count=%s",
            user_id,
            len(preference.pinned_digital_human_ids),
        )

    async def close(self) -> None:
        """与真实适配器接口对齐。"""
        self._store.clear()
