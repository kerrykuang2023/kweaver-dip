"""
OEM 配置 API Schema

定义 OEM 配置接口的响应模型。
"""
import base64
import binascii
import re

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    RootModel,
    field_validator,
    model_validator,
)


THEME_COLOR_PATTERN = re.compile(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")


class OemConfigResponse(BaseModel):
    """OEM 配置响应。"""

    product: str = Field(..., description="产品名称")
    theme: str = Field(..., description="主题色")
    loginBoxStyle: str = Field(..., description="登录框样式")
    hideLogo: bool = Field(..., description="是否隐藏 Logo")
    showPortalBanner: bool = Field(..., description="是否展示门户 Banner")
    showUserAgreement: bool = Field(..., description="是否展示用户协议")
    showPrivacyPolicy: bool = Field(..., description="是否展示隐私政策")
    webTemplate: str = Field(..., description="Web 模板名称")
    desktopTemplate: str = Field(..., description="桌面端模板名称")
    logo: str = Field(..., description="浅色 Logo Base64 字符串")
    darkLogo: str = Field(..., description="深色 Logo Base64 字符串")
    portalBanner: str = Field(..., description="门户 Banner 文案或资源")
    favicon: str = Field(..., description="站点图标 Base64 字符串")


class OemConfigUpdateFields(BaseModel):
    """OEM 配置更新字段集合。"""

    model_config = ConfigDict(extra="forbid")

    theme: str | None = Field(
        default=None,
        min_length=1,
        max_length=7,
        description="主题色，仅支持 #RGB 或 #RRGGBB 十六进制颜色值",
    )
    logo: str | None = Field(
        default=None,
        min_length=1,
        description="浅色 Logo Base64 字符串",
    )
    darkLogo: str | None = Field(
        default=None,
        min_length=1,
        description="深色 Logo Base64 字符串",
    )
    portalBanner: str | None = Field(
        default=None,
        min_length=1,
        description="门户 Banner 文案或资源",
    )
    favicon: str | None = Field(
        default=None,
        min_length=1,
        description="站点图标 Base64 字符串",
    )

    @field_validator(
        "theme",
        "logo",
        "darkLogo",
        "portalBanner",
        "favicon",
        mode="before",
    )
    @classmethod
    def strip_string_field(cls, value):
        """清理字符串字段首尾空格。"""
        if isinstance(value, str):
            return value.strip()
        return value

    @field_validator("theme")
    @classmethod
    def validate_theme_color(cls, value: str | None):
        """校验主题色格式。"""
        if value is None:
            return value
        if not THEME_COLOR_PATTERN.fullmatch(value):
            raise ValueError("theme 必须是 #RGB 或 #RRGGBB 格式的十六进制颜色值")
        return value

    @field_validator("logo", "darkLogo", "favicon")
    @classmethod
    def validate_base64_image_field(cls, value: str | None):
        """校验图片字段为合法 Base64 字符串。"""
        if value is None:
            return value
        try:
            base64.b64decode(value, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise ValueError(
                "logo、darkLogo、favicon 必须是合法 Base64 字符串"
            ) from exc
        return value

    @model_validator(mode="after")
    def validate_has_update_field(self):
        """至少需要提供一个可更新字段。"""
        if not any(
            (
                self.theme is not None,
                self.logo is not None,
                self.darkLogo is not None,
                self.portalBanner is not None,
                self.favicon is not None,
            )
        ):
            raise ValueError(
                "至少需要提供 theme、logo、darkLogo、portalBanner、favicon 中的一个"
            )
        return self


class OemConfigBatchUpdateRequest(RootModel[dict[str, OemConfigUpdateFields]]):
    """OEM 配置批量更新请求，key 为语言标识。"""

    @model_validator(mode="after")
    def validate_has_language(self):
        """至少需要提供一种语言的配置。"""
        if not self.root:
            raise ValueError("至少需要提供一种语言配置")
        return self
