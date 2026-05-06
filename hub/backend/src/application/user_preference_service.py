"""
用户偏好应用服务

负责校验、去重、顺序保持及写入持久化。
"""
import logging
from typing import List

from src.domains.user_preference import UserPreference
from src.infrastructure.exceptions import ValidationError
from src.ports.user_preference_port import UserPreferencePort

logger = logging.getLogger(__name__)

# 侧栏可展示上限，与设计文档一致，可按产品调整
_MAX_PINNED_DIGITAL_HUMANS = 30
_MAX_ID_LEN = 128


class UserPreferenceService:
    """用户偏好业务逻辑。"""

    def __init__(self, preference_port: UserPreferencePort):
        self._port = preference_port

    async def get_preferences(self, user_id: str) -> UserPreference:
        return await self._port.get_by_user_id(user_id)

    async def set_pinned_digital_human_ids(
        self,
        user_id: str,
        raw_ids: List[str],
    ) -> UserPreference:
        """
        全量替换钉选数字员工列表（有序、去重）。

        参数:
            user_id: 当前用户 ID（与 UserInfo.id 一致）
            raw_ids: 客户端传入的 ID 列表
        """
        normalized: List[str] = []
        seen = set()
        for item in raw_ids:
            sid = str(item).strip()
            if not sid:
                continue
            if len(sid) > _MAX_ID_LEN:
                raise ValidationError(
                    code="INVALID_DIGITAL_HUMAN_ID",
                    description=f"数字员工 ID 长度不能超过 {_MAX_ID_LEN}",
                )
            if sid in seen:
                continue
            seen.add(sid)
            normalized.append(sid)
            if len(normalized) > _MAX_PINNED_DIGITAL_HUMANS:
                raise ValidationError(
                    code="PINNED_DIGITAL_HUMAN_LIMIT",
                    description=f"最多固定 {_MAX_PINNED_DIGITAL_HUMANS} 个数字员工",
                )

        pref = UserPreference(pinned_digital_human_ids=normalized)
        await self._port.upsert(user_id, pref)
        logger.info("用户 %s 更新钉选数字员工: %s 个", user_id, len(normalized))
        return pref
