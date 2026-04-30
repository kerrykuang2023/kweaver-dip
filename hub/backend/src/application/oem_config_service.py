"""
OEM 配置应用服务

优先从持久化端口读取配置；数据库暂无配置时返回对应语言的默认值。
"""
from src.domains.oem_config import (
    DEFAULT_OEM_CONFIG,
    OemConfig,
    OemConfigQuery,
    OemConfigStoredFields,
    OemConfigUpdate,
    SUPPORTED_LANGUAGES,
    default_oem_config_stored_fields,
    normalize_oem_language,
)
from src.infrastructure.exceptions import ValidationError
from src.ports.oem_config_port import OemConfigPort


class OemConfigService:
    """OEM 配置应用服务。"""

    def __init__(self, oem_config_port: OemConfigPort = None):
        self._oem_config_port = oem_config_port

    async def get_oem_config(
        self,
        query: OemConfigQuery,
    ) -> OemConfig:
        """
        获取当前 OEM 配置。

        参数:
            query: 查询条件。

        返回:
            OemConfig: 当前 OEM 配置。
        """
        if self._oem_config_port is None:
            return DEFAULT_OEM_CONFIG

        normalized_language = self._normalize_and_validate_language(query.language)
        config = await self._oem_config_port.get_oem_config(
            OemConfigQuery(language=normalized_language)
        )
        if config is None:
            config = default_oem_config_stored_fields(normalized_language)

        return self._merge_with_default(config)

    async def update_oem_configs(
        self,
        configs: list[OemConfigUpdate],
    ) -> dict[str, OemConfig]:
        """
        批量更新 OEM 配置。

        参数:
            configs: 多语言更新参数。

        返回:
            dict[str, OemConfig]: 按语言返回更新后的完整 OEM 配置。
        """
        if not configs:
            raise ValidationError(
                code="EMPTY_LANGUAGE_UPDATE",
                description="至少需要提供一种语言配置",
                solution="请至少提供 zh-CN、en、zh-TW 中一种语言的配置",
            )

        normalized_configs: list[OemConfigUpdate] = []
        normalized_languages: set[str] = set()
        for config in configs:
            if config.language is None or not config.language.strip():
                raise ValidationError(
                    code="INVALID_LANGUAGE",
                    description="语言标识无效，仅支持 zh-CN、en、zh-TW",
                    solution="请使用 zh-CN、en 或 zh-TW 作为语言标识",
                    detail={"language": config.language},
                )
            normalized_language = self._normalize_and_validate_language(
                config.language
            )
            if normalized_language in normalized_languages:
                raise ValidationError(
                    code="DUPLICATE_LANGUAGE",
                    description="请求中存在重复的语言配置",
                    solution="请确保同一种语言只传入一次",
                    detail={"language": normalized_language},
                )
            normalized_languages.add(normalized_language)
            normalized_configs.append(
                OemConfigUpdate(
                    language=normalized_language,
                    theme=config.theme,
                    logo=config.logo,
                    dark_logo=config.dark_logo,
                    portal_banner=config.portal_banner,
                    favicon=config.favicon,
                )
            )

        complete_configs = [
            await self._build_complete_update_config(config)
            for config in normalized_configs
        ]

        if self._oem_config_port is None:
            return {
                config.language: self._merge_with_default(
                    OemConfigStoredFields(
                        language=config.language,
                        theme=config.theme,
                        logo=config.logo,
                        dark_logo=config.dark_logo,
                        portal_banner=config.portal_banner,
                        favicon=config.favicon,
                    )
                )
                for config in complete_configs
            }

        stored_configs = await self._oem_config_port.update_oem_configs(
            complete_configs
        )
        return {
            stored_config.language: self._merge_with_default(stored_config)
            for stored_config in stored_configs
        }

    async def _build_complete_update_config(
        self,
        config: OemConfigUpdate,
    ) -> OemConfigUpdate:
        """基于当前配置补齐未传字段，生成完整入库更新参数。"""
        current_config = await self.get_oem_config(
            OemConfigQuery(language=config.language)
        )
        return OemConfigUpdate(
            language=config.language,
            theme=config.theme if config.theme is not None else current_config.theme,
            logo=config.logo if config.logo is not None else current_config.logo,
            dark_logo=(
                config.dark_logo
                if config.dark_logo is not None
                else current_config.dark_logo
            ),
            portal_banner=(
                config.portal_banner
                if config.portal_banner is not None
                else current_config.portal_banner
            ),
            favicon=(
                config.favicon
                if config.favicon is not None
                else current_config.favicon
            ),
        )

    @staticmethod
    def _normalize_and_validate_language(language: str) -> str:
        """规范化并校验语言参数。"""
        normalized = normalize_oem_language(language)
        if normalized not in SUPPORTED_LANGUAGES:
            raise ValidationError(
                code="INVALID_LANGUAGE",
                description="语言标识无效，仅支持 zh-CN、en、zh-TW",
                solution="请使用 zh-CN、en 或 zh-TW 作为语言标识",
                detail={"language": language},
            )
        return normalized

    @staticmethod
    def _merge_with_default(config: OemConfigStoredFields) -> OemConfig:
        """将入库字段与代码默认字段合并为完整响应。"""
        return OemConfig(
            product=DEFAULT_OEM_CONFIG.product,
            theme=config.theme,
            login_box_style=DEFAULT_OEM_CONFIG.login_box_style,
            hide_logo=DEFAULT_OEM_CONFIG.hide_logo,
            show_portal_banner=DEFAULT_OEM_CONFIG.show_portal_banner,
            show_user_agreement=DEFAULT_OEM_CONFIG.show_user_agreement,
            show_privacy_policy=DEFAULT_OEM_CONFIG.show_privacy_policy,
            web_template=DEFAULT_OEM_CONFIG.web_template,
            desktop_template=DEFAULT_OEM_CONFIG.desktop_template,
            logo=config.logo,
            dark_logo=config.dark_logo,
            portal_banner=config.portal_banner,
            favicon=config.favicon,
        )
