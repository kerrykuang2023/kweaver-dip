"""
OEM 配置路由

提供 DIP 级 OEM 配置查询端点。
"""
from fastapi import APIRouter, Query, Request

from src.application.oem_config_service import OemConfigService
from src.domains.oem_config import OemConfig, OemConfigQuery, OemConfigUpdate
from src.infrastructure.exceptions import ValidationError
from src.routers.schemas.oem_config import (
    OemConfigResponse,
    OemConfigBatchUpdateRequest,
)

OEM_CONFIG_PATH = "/oem-config"


def create_oem_config_router(
    oem_config_service: OemConfigService,
) -> APIRouter:
    """
    创建 OEM 配置路由。

    参数:
        oem_config_service: OEM 配置服务实例。

    返回:
        APIRouter: 配置完成的路由。
    """
    router = APIRouter(tags=["OemConfig"])

    def _to_response(config: OemConfig) -> OemConfigResponse:
        """将领域模型转换为响应模型。"""
        return OemConfigResponse(
            product=config.product,
            theme=config.theme,
            loginBoxStyle=config.login_box_style,
            hideLogo=config.hide_logo,
            showPortalBanner=config.show_portal_banner,
            showUserAgreement=config.show_user_agreement,
            showPrivacyPolicy=config.show_privacy_policy,
            webTemplate=config.web_template,
            desktopTemplate=config.desktop_template,
            logo=config.logo,
            darkLogo=config.dark_logo,
            portalBanner=config.portal_banner,
            favicon=config.favicon,
        )

    @router.get(
        OEM_CONFIG_PATH,
        summary="获取 OEM 配置",
        description="供外部调用方读取 DIP OEM 配置。该接口不需要鉴权。",
        response_model=OemConfigResponse,
        responses={
            200: {"description": "成功获取 OEM 配置"},
        },
    )
    async def get_oem_config(
        language: str = Query(
            ...,
            min_length=1,
            description="语言标识，仅支持 zh-CN、en、zh-TW",
        ),
    ) -> OemConfigResponse:
        """
        获取 OEM 配置。

        参数:
            language: 语言标识，例如 zh-CN、en。

        返回:
            OemConfigResponse: OEM 配置。
        """
        config = await oem_config_service.get_oem_config(
            OemConfigQuery(language=language)
        )
        return _to_response(config)

    @router.put(
        OEM_CONFIG_PATH,
        summary="修改 OEM 配置",
        description="修改 DIP OEM 配置。该接口需要鉴权。",
        response_model=dict[str, OemConfigResponse],
        responses={
            200: {"description": "成功修改 OEM 配置"},
        },
    )
    async def update_oem_config(
        http_request: Request,
        request: OemConfigBatchUpdateRequest,
    ) -> dict[str, OemConfigResponse]:
        """
        修改 OEM 配置。

        参数:
            request: OEM 配置更新请求。

        返回:
            dict[str, OemConfigResponse]: 按语言返回更新后的 OEM 配置。
        """
        if http_request.query_params:
            raise ValidationError(
                code="INVALID_QUERY_PARAMETER",
                description="PUT /oem-config 不支持 query 参数",
                solution="请将语言标识放在请求体顶层 key 中，例如 zh-CN、en、zh-TW",
                detail={"query": dict(http_request.query_params)},
            )

        configs = await oem_config_service.update_oem_configs(
            [
                OemConfigUpdate(
                    language=language,
                    theme=language_request.theme,
                    logo=language_request.logo,
                    dark_logo=language_request.darkLogo,
                    portal_banner=language_request.portalBanner,
                    favicon=language_request.favicon,
                )
                for language, language_request in request.root.items()
            ]
        )
        return {
            language: _to_response(config)
            for language, config in configs.items()
        }

    return router
