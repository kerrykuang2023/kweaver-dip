"""
用户偏好领域模型

当前存储侧栏钉选的数字员工 ID 有序列表（与 dip-studio 数字员工 id 对齐）。
"""
from dataclasses import dataclass, field
from typing import List


@dataclass
class UserPreference:
    """单用户的偏好数据（从 content JSON 解析）。"""

    pinned_digital_human_ids: List[str] = field(default_factory=list)
