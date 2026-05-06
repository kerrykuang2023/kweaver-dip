"""用户偏好服务单元测试"""
import asyncio

import pytest

from src.application.user_preference_service import UserPreferenceService
from src.domains.user_preference import UserPreference
from src.infrastructure.exceptions import ValidationError
from src.ports.user_preference_port import UserPreferencePort


class _FakePrefPort(UserPreferencePort):
    def __init__(self):
        self.saved: UserPreference | None = None

    async def get_by_user_id(self, user_id: str) -> UserPreference:
        return self.saved or UserPreference()

    async def upsert(self, user_id: str, preference: UserPreference) -> None:
        self.saved = UserPreference(
            pinned_digital_human_ids=list(preference.pinned_digital_human_ids),
        )


def test_set_pinned_dedupe_and_order():
    port = _FakePrefPort()
    svc = UserPreferenceService(port)

    async def _run():
        return await svc.set_pinned_digital_human_ids("u1", ["a", "a", "b", "  c  "])

    result = asyncio.run(_run())
    assert result.pinned_digital_human_ids == ["a", "b", "c"]
    assert port.saved is not None
    assert port.saved.pinned_digital_human_ids == ["a", "b", "c"]


def test_set_pinned_limit():
    port = _FakePrefPort()
    svc = UserPreferenceService(port)
    ids = [f"id{i}" for i in range(31)]

    async def _run():
        await svc.set_pinned_digital_human_ids("u1", ids)

    with pytest.raises(ValidationError) as exc:
        asyncio.run(_run())
    assert "30" in exc.value.description


def test_set_pinned_id_too_long():
    port = _FakePrefPort()
    svc = UserPreferenceService(port)

    async def _run():
        await svc.set_pinned_digital_human_ids("u1", ["x" * 129])

    with pytest.raises(ValidationError):
        asyncio.run(_run())
