"""
OEM 配置接口测试
"""
import base64
import json
from unittest.mock import AsyncMock

import pytest
from fastapi.exceptions import RequestValidationError
from starlette.requests import Request

from src.application.oem_config_service import OemConfigService
from src.domains.oem_config import (
    DEFAULT_LANGUAGE,
    DEFAULT_OEM_CONFIG,
    OemConfig,
    OemConfigQuery,
    OemConfigStoredFields,
    OemConfigUpdate,
    OEM_ASSET_DIR,
    SUPPORTED_LANGUAGES,
    default_oem_config_stored_fields,
)
from src.infrastructure.database.oem_config_schema import (
    CREATE_OEM_CONFIG_TABLE_SQL,
)
from src.infrastructure.exceptions import ValidationError
from src.adapters.oem_config_adapter import OemConfigAdapter
from src.infrastructure.config.settings import Settings
from src.infrastructure.middleware.auth_middleware import AuthMiddleware
from src.main import create_app
from src.routers.oem_config_router import (
    OEM_CONFIG_PATH,
    create_oem_config_router,
)
from src.routers.schemas.oem_config import OemConfigBatchUpdateRequest


class _FakeOemConfigCursor:
    """用于验证批量写入事务行为的假 cursor。"""

    def __init__(self, connection):
        self._connection = connection
        self._last_language = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def execute(self, sql, params=None):
        normalized_sql = sql.strip().upper()
        if normalized_sql in {"START TRANSACTION", "COMMIT", "ROLLBACK"}:
            self._connection.statements.append(normalized_sql)
            return
        self._connection.execute_count += 1
        if self._connection.fail_on_execute == self._connection.execute_count:
            raise RuntimeError("database write failed")
        if "WHERE language = %s" in sql:
            self._last_language = params[0]

    def fetchone(self):
        return (
            self._last_language,
            "#000000",
            "logo",
            "dark-logo",
            "banner",
            "favicon",
        )


class _FakeOemConfigConnection:
    """用于验证批量写入事务行为的假 connection。"""

    def __init__(self, fail_on_execute=None):
        self.fail_on_execute = fail_on_execute
        self.execute_count = 0
        self.statements = []

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def cursor(self):
        return _FakeOemConfigCursor(self)


class _FakeOemConfigPool:
    """用于验证批量写入事务行为的假连接池。"""

    def __init__(self, connection):
        self._connection = connection

    def connection(self):
        return self._connection


async def _empty_asgi_app(scope, receive, send):
    """用于初始化中间件的空 ASGI app。"""
    return None


def _oem_put_request(query_string: bytes = b"") -> Request:
    """构造 OEM PUT 请求对象。"""
    return Request(
        {
            "type": "http",
            "method": "PUT",
            "path": "/api/dip/v1/oem-config",
            "headers": [],
            "query_string": query_string,
            "server": ("testserver", 80),
            "scheme": "http",
            "client": ("testclient", 50000),
        }
    )


def _base64_value(value: str) -> str:
    """生成测试用 Base64 字符串。"""
    return base64.b64encode(value.encode("utf-8")).decode("ascii")


@pytest.fixture
def oem_router():
    """创建 OEM 配置路由。"""
    return create_oem_config_router(OemConfigService())


class TestOemConfigEndpoint:
    """OEM 配置接口测试。"""

    def test_registers_public_oem_config_route(
        self,
        oem_router,
    ):
        """测试注册公开 OEM 配置路由。"""
        routes = [
            route
            for route in oem_router.routes
            if getattr(route, "path", None) == OEM_CONFIG_PATH
        ]

        methods = set()
        for route in routes:
            methods.update(route.methods)

        assert "GET" in methods
        assert "PUT" in methods

    @pytest.mark.asyncio
    async def test_returns_oem_config(
        self,
        oem_router,
    ):
        """测试接口处理函数返回 OEM 配置。"""
        route = next(
            route
            for route in oem_router.routes
            if getattr(route, "path", None) == OEM_CONFIG_PATH
            and "GET" in getattr(route, "methods", set())
        )

        response = await route.endpoint(language=DEFAULT_LANGUAGE)

        assert response.model_dump() == {
            "product": DEFAULT_OEM_CONFIG.product,
            "theme": DEFAULT_OEM_CONFIG.theme,
            "loginBoxStyle": DEFAULT_OEM_CONFIG.login_box_style,
            "hideLogo": DEFAULT_OEM_CONFIG.hide_logo,
            "showPortalBanner": DEFAULT_OEM_CONFIG.show_portal_banner,
            "showUserAgreement": DEFAULT_OEM_CONFIG.show_user_agreement,
            "showPrivacyPolicy": DEFAULT_OEM_CONFIG.show_privacy_policy,
            "webTemplate": DEFAULT_OEM_CONFIG.web_template,
            "desktopTemplate": DEFAULT_OEM_CONFIG.desktop_template,
            "logo": DEFAULT_OEM_CONFIG.logo,
            "darkLogo": DEFAULT_OEM_CONFIG.dark_logo,
            "portalBanner": DEFAULT_OEM_CONFIG.portal_banner,
            "favicon": DEFAULT_OEM_CONFIG.favicon,
        }

    def test_oem_config_path_is_public(self):
        """测试带 DIP API 前缀的 OEM 配置路径会跳过鉴权。"""
        middleware = AuthMiddleware(_empty_asgi_app)

        assert middleware._is_public_path(
            f"/api/dip/v1{OEM_CONFIG_PATH}"
        )

    def test_oem_config_put_path_requires_auth(self):
        """测试 OEM 配置修改接口不跳过鉴权。"""
        middleware = AuthMiddleware(_empty_asgi_app)

        assert not middleware._is_public_path(
            f"/api/dip/v1{OEM_CONFIG_PATH}",
            method="PUT",
        )

    def test_app_registers_oem_config_under_dip_api_prefix(self):
        """测试 OEM 配置挂在 DIP 级 API 前缀下。"""
        settings = Settings(use_mock_services=True)

        app = create_app(settings)

        paths = {getattr(route, "path", None) for route in app.routes}
        assert f"{settings.oem_api_prefix}{OEM_CONFIG_PATH}" in paths
        assert f"{settings.api_prefix}{OEM_CONFIG_PATH}" not in paths

    @pytest.mark.asyncio
    async def test_updates_oem_config(
        self,
        oem_router,
    ):
        """测试接口处理函数更新 OEM 配置。"""
        route = next(
            route
            for route in oem_router.routes
            if getattr(route, "path", None) == OEM_CONFIG_PATH
            and "PUT" in getattr(route, "methods", set())
        )

        response = await route.endpoint(
            http_request=_oem_put_request(),
            request=OemConfigBatchUpdateRequest(
                {
                    "zh-CN": {
                        "theme": "#000000",
                        "logo": _base64_value("updated-logo"),
                        "darkLogo": _base64_value("updated-dark-logo"),
                        "portalBanner": "updated-banner",
                        "favicon": _base64_value("updated-favicon"),
                    }
                }
            ),
        )

        assert response["zh-CN"].model_dump() == {
            "product": DEFAULT_OEM_CONFIG.product,
            "theme": "#000000",
            "loginBoxStyle": DEFAULT_OEM_CONFIG.login_box_style,
            "hideLogo": DEFAULT_OEM_CONFIG.hide_logo,
            "showPortalBanner": DEFAULT_OEM_CONFIG.show_portal_banner,
            "showUserAgreement": DEFAULT_OEM_CONFIG.show_user_agreement,
            "showPrivacyPolicy": DEFAULT_OEM_CONFIG.show_privacy_policy,
            "webTemplate": DEFAULT_OEM_CONFIG.web_template,
            "desktopTemplate": DEFAULT_OEM_CONFIG.desktop_template,
            "logo": _base64_value("updated-logo"),
            "darkLogo": _base64_value("updated-dark-logo"),
            "portalBanner": "updated-banner",
            "favicon": _base64_value("updated-favicon"),
        }

    @pytest.mark.asyncio
    async def test_updates_oem_config_partially(
        self,
        oem_router,
    ):
        """测试接口支持只传入本次需要修改的字段。"""
        route = next(
            route
            for route in oem_router.routes
            if getattr(route, "path", None) == OEM_CONFIG_PATH
            and "PUT" in getattr(route, "methods", set())
        )

        response = await route.endpoint(
            http_request=_oem_put_request(),
            request=OemConfigBatchUpdateRequest(
                {
                    "zh-CN": {
                        "theme": "#000000",
                    }
                }
            ),
        )

        assert response["zh-CN"].model_dump() == {
            "product": DEFAULT_OEM_CONFIG.product,
            "theme": "#000000",
            "loginBoxStyle": DEFAULT_OEM_CONFIG.login_box_style,
            "hideLogo": DEFAULT_OEM_CONFIG.hide_logo,
            "showPortalBanner": DEFAULT_OEM_CONFIG.show_portal_banner,
            "showUserAgreement": DEFAULT_OEM_CONFIG.show_user_agreement,
            "showPrivacyPolicy": DEFAULT_OEM_CONFIG.show_privacy_policy,
            "webTemplate": DEFAULT_OEM_CONFIG.web_template,
            "desktopTemplate": DEFAULT_OEM_CONFIG.desktop_template,
            "logo": DEFAULT_OEM_CONFIG.logo,
            "darkLogo": DEFAULT_OEM_CONFIG.dark_logo,
            "portalBanner": DEFAULT_OEM_CONFIG.portal_banner,
            "favicon": DEFAULT_OEM_CONFIG.favicon,
        }

    @pytest.mark.asyncio
    async def test_updates_multiple_language_oem_configs(
        self,
        oem_router,
    ):
        """测试接口支持一次请求更新多种语言配置。"""
        route = next(
            route
            for route in oem_router.routes
            if getattr(route, "path", None) == OEM_CONFIG_PATH
            and "PUT" in getattr(route, "methods", set())
        )

        response = await route.endpoint(
            http_request=_oem_put_request(),
            request=OemConfigBatchUpdateRequest(
                {
                    "zh-CN": {"portalBanner": "中文 Banner"},
                    "en": {"portalBanner": "English Banner"},
                    "zh-TW": {"portalBanner": "繁體 Banner"},
                }
            ),
        )

        assert set(response.keys()) == {"zh-CN", "en", "zh-TW"}
        assert response["zh-CN"].portalBanner == "中文 Banner"
        assert response["en"].portalBanner == "English Banner"
        assert response["zh-TW"].portalBanner == "繁體 Banner"
        assert response["en"].theme == DEFAULT_OEM_CONFIG.theme

    @pytest.mark.asyncio
    async def test_put_normalizes_language_keys(
        self,
        oem_router,
    ):
        """测试 PUT 请求体中的语言 key 会规范化。"""
        route = next(
            route
            for route in oem_router.routes
            if getattr(route, "path", None) == OEM_CONFIG_PATH
            and "PUT" in getattr(route, "methods", set())
        )

        response = await route.endpoint(
            http_request=_oem_put_request(),
            request=OemConfigBatchUpdateRequest(
                {
                    "zh-cn": {"portalBanner": "中文 Banner"},
                    "EN": {"portalBanner": "English Banner"},
                    "zh-tw": {"portalBanner": "繁體 Banner"},
                }
            ),
        )

        assert set(response.keys()) == {"zh-CN", "en", "zh-TW"}
        assert response["zh-CN"].portalBanner == "中文 Banner"
        assert response["en"].portalBanner == "English Banner"
        assert response["zh-TW"].portalBanner == "繁體 Banner"

    @pytest.mark.asyncio
    async def test_rejects_query_parameters_for_put(
        self,
        oem_router,
    ):
        """测试 PUT 接口不接受 query 参数。"""
        route = next(
            route
            for route in oem_router.routes
            if getattr(route, "path", None) == OEM_CONFIG_PATH
            and "PUT" in getattr(route, "methods", set())
        )

        with pytest.raises(ValidationError, match="不支持 query 参数"):
            await route.endpoint(
                http_request=_oem_put_request(b"language=EN"),
                request=OemConfigBatchUpdateRequest(
                    {
                        "zh-CN": {"theme": "#000000"},
                    }
                ),
            )

    def test_rejects_empty_oem_config_update_request(self):
        """测试修改配置时至少需要传入一个可更新字段。"""
        with pytest.raises(ValueError, match="至少需要提供"):
            OemConfigBatchUpdateRequest({})

    def test_rejects_empty_language_oem_config_update_request(self):
        """测试每种语言下至少需要传入一个可更新字段。"""
        with pytest.raises(ValueError, match="至少需要提供"):
            OemConfigBatchUpdateRequest({"zh-CN": {}})

    def test_rejects_unknown_oem_config_update_field(self):
        """测试每种语言下不允许传入未定义字段。"""
        with pytest.raises(ValueError, match="portalBanner1"):
            OemConfigBatchUpdateRequest(
                {
                    "zh-CN": {
                        "theme": "#000000",
                        "portalBanner1": "1111",
                    }
                }
            )

    def test_rejects_invalid_theme_color(self):
        """测试主题色必须是合法十六进制颜色值。"""
        with pytest.raises(ValueError, match="theme 必须是"):
            OemConfigBatchUpdateRequest(
                {
                    "zh-CN": {
                        "theme": "#enenen",
                    }
                }
            )

    def test_rejects_invalid_base64_image_field(self):
        """测试图片字段必须是合法 Base64 字符串。"""
        with pytest.raises(ValueError, match="合法 Base64"):
            OemConfigBatchUpdateRequest(
                {
                    "zh-CN": {
                        "logo": "not-base64!",
                    }
                }
            )

    def test_rejects_blank_required_update_field(self):
        """测试非 portalBanner 字符串字段去空格后为空会被拒绝。"""
        with pytest.raises(ValueError, match="String should have at least"):
            OemConfigBatchUpdateRequest(
                {
                    "zh-CN": {
                        "theme": "   ",
                    }
                }
            )

    def test_strips_oem_config_update_fields(self):
        """测试更新字段会去掉首尾空格。"""
        request = OemConfigBatchUpdateRequest(
            {
                "zh-CN": {
                    "theme": "  #126EE3  ",
                    "portalBanner": "  决策智能体平台  ",
                }
            }
        )

        assert request.root["zh-CN"].theme == "#126EE3"
        assert request.root["zh-CN"].portalBanner == "决策智能体平台"

    @pytest.mark.asyncio
    async def test_validation_error_response_serializes_value_error(self):
        """测试校验错误中的 ValueError 会被转换为可序列化响应。"""
        app = create_app(Settings(use_mock_services=True))
        handler = app.exception_handlers[RequestValidationError]
        request = Request(
            {
                "type": "http",
                "method": "PUT",
                "path": "/api/dip/v1/oem-config",
                "headers": [],
            }
        )
        exc = RequestValidationError(
            [
                {
                    "type": "value_error",
                    "loc": ("body", "zh-CN"),
                    "msg": "Value error, 至少需要提供一个可更新字段",
                    "input": {},
                    "ctx": {"error": ValueError("至少需要提供一个可更新字段")},
                }
            ]
        )

        response = await handler(request, exc)
        body = json.loads(response.body)

        assert response.status_code == 400
        assert body["code"] == "VALIDATION_ERROR"
        assert body["detail"]["validation_errors"][0]["ctx"]["error"] == (
            "至少需要提供一个可更新字段"
        )

    def test_default_oem_config_matches_contract(self):
        """测试默认 OEM 配置字段符合接口契约。"""
        assert DEFAULT_OEM_CONFIG.product == "KWeaver DIP"
        assert DEFAULT_OEM_CONFIG.theme == "#126EE3"
        assert DEFAULT_OEM_CONFIG.login_box_style == "white"
        assert DEFAULT_OEM_CONFIG.hide_logo is False
        assert DEFAULT_OEM_CONFIG.show_portal_banner is True
        assert DEFAULT_OEM_CONFIG.show_user_agreement is True
        assert DEFAULT_OEM_CONFIG.show_privacy_policy is True
        assert DEFAULT_OEM_CONFIG.web_template == "default"
        assert DEFAULT_OEM_CONFIG.desktop_template == "default"
        assert not DEFAULT_OEM_CONFIG.logo.startswith("data:image/png;base64,")
        assert not DEFAULT_OEM_CONFIG.dark_logo.startswith("data:image/png;base64,")
        assert DEFAULT_OEM_CONFIG.portal_banner == "决策智能体平台"
        assert not DEFAULT_OEM_CONFIG.favicon.startswith("data:image/png;base64,")

    def test_default_oem_images_are_loaded_from_static_assets(self):
        """测试默认图片资源来自静态文件。"""
        assert base64.b64decode(DEFAULT_OEM_CONFIG.logo) == (
            OEM_ASSET_DIR / DEFAULT_LANGUAGE / "logo.png"
        ).read_bytes()
        assert base64.b64decode(DEFAULT_OEM_CONFIG.dark_logo) == (
            OEM_ASSET_DIR / DEFAULT_LANGUAGE / "dark_logo.png"
        ).read_bytes()
        assert base64.b64decode(DEFAULT_OEM_CONFIG.favicon) == (
            OEM_ASSET_DIR / DEFAULT_LANGUAGE / "favicon.png"
        ).read_bytes()

    def test_default_oem_images_are_grouped_by_language(self):
        """测试默认图片资源按语言目录组织。"""
        for language in SUPPORTED_LANGUAGES:
            stored = default_oem_config_stored_fields(language)
            assert base64.b64decode(stored.logo) == (
                OEM_ASSET_DIR / language / "logo.png"
            ).read_bytes()
            assert base64.b64decode(stored.dark_logo) == (
                OEM_ASSET_DIR / language / "dark_logo.png"
            ).read_bytes()
            assert base64.b64decode(stored.favicon) == (
                OEM_ASSET_DIR / language / "favicon.png"
            ).read_bytes()

    def test_oem_config_table_uses_language_unique_key(self):
        """测试 OEM 配置表只按 language 唯一定位。"""
        assert "config_key" not in CREATE_OEM_CONFIG_TABLE_SQL
        assert "UNIQUE INDEX `idx_language` (`language`)" in (
            CREATE_OEM_CONFIG_TABLE_SQL
        )


class TestOemConfigAdapter:
    """OEM 配置数据库适配器测试。"""

    def test_batch_update_commits_when_all_writes_succeed(self):
        """测试批量更新全部写入成功时会提交事务。"""
        connection = _FakeOemConfigConnection()
        adapter = OemConfigAdapter(Settings(use_mock_services=True))
        adapter._pool = _FakeOemConfigPool(connection)

        rows = adapter._sync_update_oem_configs(
            [
                OemConfigUpdate(
                    language="zh-CN",
                    theme="#000000",
                    logo="logo",
                    dark_logo="dark-logo",
                    portal_banner="banner",
                    favicon="favicon",
                ),
                OemConfigUpdate(
                    language="en",
                    theme="#ffffff",
                    logo="logo",
                    dark_logo="dark-logo",
                    portal_banner="banner",
                    favicon="favicon",
                ),
            ]
        )

        assert [row[0] for row in rows] == ["zh-CN", "en"]
        assert connection.statements == ["START TRANSACTION", "COMMIT"]

    def test_batch_update_rolls_back_when_any_write_fails(self):
        """测试批量更新任一写入失败时会回滚事务。"""
        connection = _FakeOemConfigConnection(fail_on_execute=2)
        adapter = OemConfigAdapter(Settings(use_mock_services=True))
        adapter._pool = _FakeOemConfigPool(connection)

        with pytest.raises(RuntimeError, match="database write failed"):
            adapter._sync_update_oem_configs(
                [
                    OemConfigUpdate(
                        language="zh-CN",
                        theme="#000000",
                        logo="logo",
                        dark_logo="dark-logo",
                        portal_banner="banner",
                        favicon="favicon",
                    ),
                    OemConfigUpdate(
                        language="en",
                        theme="#ffffff",
                        logo="logo",
                        dark_logo="dark-logo",
                        portal_banner="banner",
                        favicon="favicon",
                    ),
                ]
            )

        assert connection.statements == ["START TRANSACTION", "ROLLBACK"]


class TestOemConfigService:
    """OEM 配置应用服务测试。"""

    @pytest.mark.asyncio
    async def test_returns_database_config_when_port_has_value(self):
        """测试优先返回端口读取到的数据库配置。"""
        stored_config = OemConfigStoredFields(
            language="zh-CN",
            theme="#000000",
            logo="stored-logo",
            dark_logo="stored-dark-logo",
            portal_banner="stored-banner",
            favicon="stored-favicon",
        )
        mock_port = AsyncMock()
        mock_port.get_oem_config.return_value = stored_config

        service = OemConfigService(mock_port)

        result = await service.get_oem_config(
            OemConfigQuery(language="zh-CN")
        )

        mock_port.get_oem_config.assert_called_once_with(
            OemConfigQuery(language="zh-CN")
        )
        assert result == OemConfig(
            product=DEFAULT_OEM_CONFIG.product,
            theme="#000000",
            login_box_style=DEFAULT_OEM_CONFIG.login_box_style,
            hide_logo=DEFAULT_OEM_CONFIG.hide_logo,
            show_portal_banner=DEFAULT_OEM_CONFIG.show_portal_banner,
            show_user_agreement=DEFAULT_OEM_CONFIG.show_user_agreement,
            show_privacy_policy=DEFAULT_OEM_CONFIG.show_privacy_policy,
            web_template=DEFAULT_OEM_CONFIG.web_template,
            desktop_template=DEFAULT_OEM_CONFIG.desktop_template,
            logo="stored-logo",
            dark_logo="stored-dark-logo",
            portal_banner="stored-banner",
            favicon="stored-favicon",
        )

    @pytest.mark.asyncio
    async def test_returns_default_config_when_database_config_missing(self):
        """测试数据库暂无配置时返回默认配置。"""
        mock_port = AsyncMock()
        mock_port.get_oem_config.return_value = None

        service = OemConfigService(mock_port)

        result = await service.get_oem_config(
            OemConfigQuery(language="zh-CN")
        )

        mock_port.get_oem_config.assert_called_once_with(
            OemConfigQuery(language="zh-CN")
        )
        assert result == DEFAULT_OEM_CONFIG

    @pytest.mark.asyncio
    async def test_normalizes_language_before_querying_port(self):
        """测试语言参数会规范化后再查询端口。"""
        mock_port = AsyncMock()
        mock_port.get_oem_config.return_value = None

        service = OemConfigService(mock_port)

        await service.get_oem_config(
            OemConfigQuery(language=" zh-cn ")
        )

        mock_port.get_oem_config.assert_called_once_with(
            OemConfigQuery(language="zh-CN")
        )

    @pytest.mark.asyncio
    async def test_falls_back_to_default_language_when_requested_language_missing(self):
        """测试请求语言不存在时返回该语言的默认配置。"""
        mock_port = AsyncMock()
        mock_port.get_oem_config.return_value = None

        service = OemConfigService(mock_port)

        result = await service.get_oem_config(
            OemConfigQuery(language="en")
        )

        assert result == DEFAULT_OEM_CONFIG
        assert mock_port.get_oem_config.call_args_list[0].args == (
            OemConfigQuery(language="en"),
        )

    @pytest.mark.asyncio
    async def test_batch_update_normalizes_language_before_writing(self):
        """测试批量更新时会规范化语言参数。"""
        mock_port = AsyncMock()
        mock_port.get_oem_config.return_value = OemConfigStoredFields(
            language="zh-CN",
            theme="#126EE3",
            logo="current-logo",
            dark_logo="current-dark-logo",
            portal_banner="current-banner",
            favicon="current-favicon",
        )
        mock_port.update_oem_configs.return_value = [
            OemConfigStoredFields(
                language="zh-CN",
                theme="#000000",
                logo="logo",
                dark_logo="dark-logo",
                portal_banner="banner",
                favicon="favicon",
            )
        ]

        service = OemConfigService(mock_port)

        result = await service.update_oem_configs(
            [
                OemConfigUpdate(
                    language=" zh-cn ",
                    theme="#000000",
                    logo="logo",
                    dark_logo="dark-logo",
                    portal_banner="banner",
                    favicon="favicon",
                )
            ]
        )

        mock_port.update_oem_configs.assert_called_once_with(
            [
                OemConfigUpdate(
                    language="zh-CN",
                    theme="#000000",
                    logo="logo",
                    dark_logo="dark-logo",
                    portal_banner="banner",
                    favicon="favicon",
                )
            ]
        )
        assert result["zh-CN"].theme == "#000000"
        assert result["zh-CN"].logo == "logo"

    @pytest.mark.asyncio
    async def test_batch_partial_update_uses_current_values_for_missing_fields(self):
        """测试批量部分更新时未传字段沿用当前配置。"""
        mock_port = AsyncMock()
        mock_port.get_oem_config.return_value = OemConfigStoredFields(
            language="zh-CN",
            theme="#126EE3",
            logo="current-logo",
            dark_logo="current-dark-logo",
            portal_banner="current-banner",
            favicon="current-favicon",
        )
        mock_port.update_oem_configs.return_value = [
            OemConfigStoredFields(
                language="zh-CN",
                theme="#000000",
                logo="current-logo",
                dark_logo="current-dark-logo",
                portal_banner="current-banner",
                favicon="current-favicon",
            )
        ]

        service = OemConfigService(mock_port)

        result = await service.update_oem_configs(
            [
                OemConfigUpdate(language="zh-CN", theme="#000000")
            ]
        )

        mock_port.update_oem_configs.assert_called_once_with(
            [
                OemConfigUpdate(
                    language="zh-CN",
                    theme="#000000",
                    logo="current-logo",
                    dark_logo="current-dark-logo",
                    portal_banner="current-banner",
                    favicon="current-favicon",
                )
            ]
        )
        assert result["zh-CN"].theme == "#000000"
        assert result["zh-CN"].logo == "current-logo"
        assert result["zh-CN"].dark_logo == "current-dark-logo"

    @pytest.mark.asyncio
    async def test_normalizes_english_case_before_querying_port(self):
        """测试英文语言标识会统一大小写。"""
        mock_port = AsyncMock()
        mock_port.get_oem_config.return_value = None

        service = OemConfigService(mock_port)

        await service.get_oem_config(
            OemConfigQuery(language=" EN ")
        )

        assert mock_port.get_oem_config.call_args_list[0].args == (
            OemConfigQuery(language="en"),
        )

    @pytest.mark.asyncio
    async def test_rejects_unsupported_language_for_get(self):
        """测试查询接口会拒绝非白名单语言。"""
        service = OemConfigService(AsyncMock())

        with pytest.raises(ValidationError, match="语言标识无效"):
            await service.get_oem_config(
                OemConfigQuery(language="fr-FR")
            )

    @pytest.mark.asyncio
    async def test_rejects_language_with_extra_region_for_get(self):
        """测试查询接口会拒绝带额外区域的语言标识。"""
        service = OemConfigService(AsyncMock())

        with pytest.raises(ValidationError, match="语言标识无效"):
            await service.get_oem_config(
                OemConfigQuery(language="en-US")
            )

    @pytest.mark.asyncio
    async def test_rejects_language_with_extra_parts_for_get(self):
        """测试查询接口会拒绝带多余分段的语言标识。"""
        service = OemConfigService(AsyncMock())

        with pytest.raises(ValidationError, match="语言标识无效"):
            await service.get_oem_config(
                OemConfigQuery(language="zh-CN-extra")
            )

    @pytest.mark.asyncio
    async def test_invalid_language_error_detail_omits_normalized_language(self):
        """测试无效语言错误详情不暴露规范化后的内部值。"""
        service = OemConfigService(AsyncMock())

        with pytest.raises(ValidationError) as exc_info:
            await service.get_oem_config(
                OemConfigQuery(language="zn-cn")
            )

        assert exc_info.value.detail == {"language": "zn-cn"}

    @pytest.mark.asyncio
    async def test_rejects_empty_language_for_get(self):
        """测试查询接口会拒绝空语言标识。"""
        service = OemConfigService(AsyncMock())

        with pytest.raises(ValidationError, match="语言标识无效"):
            await service.get_oem_config(
                OemConfigQuery(language="   ")
            )

    @pytest.mark.asyncio
    async def test_batch_update_rejects_unsupported_language_before_writing(self):
        """测试批量更新会先校验全部语言再写入。"""
        mock_port = AsyncMock()
        service = OemConfigService(mock_port)

        with pytest.raises(ValidationError, match="语言标识无效"):
            await service.update_oem_configs(
                [
                    OemConfigUpdate(language="zh-CN", theme="#000000"),
                    OemConfigUpdate(language="ja-JP", theme="#ffffff"),
                ]
            )

        mock_port.update_oem_configs.assert_not_called()

    @pytest.mark.asyncio
    async def test_batch_update_rejects_empty_language_before_writing(self):
        """测试批量更新会拒绝空语言标识。"""
        mock_port = AsyncMock()
        service = OemConfigService(mock_port)

        with pytest.raises(ValidationError, match="语言标识无效"):
            await service.update_oem_configs(
                [
                    OemConfigUpdate(language="", theme="#000000"),
                ]
            )

        mock_port.update_oem_configs.assert_not_called()

    @pytest.mark.asyncio
    async def test_batch_update_updates_only_requested_languages(self):
        """测试批量更新只修改请求中出现的语言。"""
        mock_port = AsyncMock()
        mock_port.get_oem_config.return_value = OemConfigStoredFields(
            language="zh-CN",
            theme="#126EE3",
            logo="current-logo",
            dark_logo="current-dark-logo",
            portal_banner="current-banner",
            favicon="current-favicon",
        )
        mock_port.update_oem_configs.return_value = [
            OemConfigStoredFields(
                language="zh-CN",
                theme="#000000",
                logo="current-logo",
                dark_logo="current-dark-logo",
                portal_banner="中文 Banner",
                favicon="current-favicon",
            ),
            OemConfigStoredFields(
                language="en",
                theme="#126EE3",
                logo="current-logo",
                dark_logo="current-dark-logo",
                portal_banner="English Banner",
                favicon="current-favicon",
            ),
        ]

        service = OemConfigService(mock_port)

        result = await service.update_oem_configs(
            [
                OemConfigUpdate(
                    language="zh-CN",
                    theme="#000000",
                    portal_banner="中文 Banner",
                ),
                OemConfigUpdate(
                    language="en",
                    portal_banner="English Banner",
                ),
            ]
        )

        assert set(result.keys()) == {"zh-CN", "en"}
        mock_port.update_oem_configs.assert_called_once_with(
            [
                OemConfigUpdate(
                    language="zh-CN",
                    theme="#000000",
                    logo="current-logo",
                    dark_logo="current-dark-logo",
                    portal_banner="中文 Banner",
                    favicon="current-favicon",
                ),
                OemConfigUpdate(
                    language="en",
                    theme="#126EE3",
                    logo="current-logo",
                    dark_logo="current-dark-logo",
                    portal_banner="English Banner",
                    favicon="current-favicon",
                ),
            ]
        )

    def test_supported_languages_contract(self):
        """测试仅支持约定的三种语言。"""
        assert SUPPORTED_LANGUAGES == ("zh-CN", "en", "zh-TW")
