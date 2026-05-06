"""
用户偏好 HTTP 路由
"""
from fastapi import APIRouter

from src.application.user_preference_service import UserPreferenceService
from src.infrastructure.context.token_context import UserContext
from src.infrastructure.exceptions import UnauthorizedError
from src.routers.schemas.user_preference import UserPreferencesPutRequest, UserPreferencesResponse


def create_user_preference_router(service: UserPreferenceService) -> APIRouter:
    router = APIRouter(tags=["UserPreference"])

    def _current_user_id() -> str:
        user = UserContext.get_user_info()
        if not user or not user.id:
            raise UnauthorizedError(
                description="无法识别当前用户",
                solution="请重新登录后重试",
            )
        return user.id

    @router.get(
        "/user/preferences",
        summary="获取当前用户偏好",
        description="读取当前登录用户在 DIP Hub 侧持久化的偏好（含侧栏钉选数字员工）。",
        response_model=UserPreferencesResponse,
    )
    async def get_user_preferences() -> UserPreferencesResponse:
        user_id = _current_user_id()
        pref = await service.get_preferences(user_id)
        return UserPreferencesResponse(
            pinned_digital_human_ids=list(pref.pinned_digital_human_ids),
        )

    @router.put(
        "/user/preferences",
        summary="更新当前用户偏好（钉选数字员工）",
        description="全量替换侧栏钉选数字员工 ID 列表；顺序即为侧栏展示顺序。",
        response_model=UserPreferencesResponse,
    )
    async def put_user_preferences(
        body: UserPreferencesPutRequest,
    ) -> UserPreferencesResponse:
        user_id = _current_user_id()
        pref = await service.set_pinned_digital_human_ids(
            user_id,
            body.pinned_digital_human_ids,
        )
        return UserPreferencesResponse(
            pinned_digital_human_ids=list(pref.pinned_digital_human_ids),
        )

    return router
