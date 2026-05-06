"""用户偏好 API 请求/响应模型"""
from typing import List

from pydantic import BaseModel, Field


class UserPreferencesResponse(BaseModel):
    """用户偏好（读）。"""

    pinned_digital_human_ids: List[str] = Field(
        default_factory=list,
        description="侧栏固定的数字员工 ID 列表，顺序为展示顺序",
    )


class UserPreferencesPutRequest(BaseModel):
    """全量更新钉选数字员工列表。"""

    pinned_digital_human_ids: List[str] = Field(
        ...,
        description="钉选列表（有序）；传空数组表示全部取消固定",
    )
