"""
OEM 配置领域模型

定义 DIP 暴露给外部调用方的 OEM 配置。
"""
import base64
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

DEFAULT_LANGUAGE = "zh-CN"
SUPPORTED_LANGUAGES = ("zh-CN", "en", "zh-TW")


@dataclass(frozen=True)
class OemConfig:
    """
    OEM 配置。

    属性:
        product: 产品名称
        theme: 主题色
        login_box_style: 登录框样式
        hide_logo: 是否隐藏 Logo
        show_portal_banner: 是否展示门户 Banner
        show_user_agreement: 是否展示用户协议
        show_privacy_policy: 是否展示隐私政策
        web_template: Web 模板名称
        desktop_template: 桌面端模板名称
        logo: 浅色 Logo Base64 字符串
        dark_logo: 深色 Logo Base64 字符串
        portal_banner: 门户 Banner 文案或资源
        favicon: 站点图标 Base64 字符串
    """

    product: str
    theme: str
    login_box_style: str
    hide_logo: bool
    show_portal_banner: bool
    show_user_agreement: bool
    show_privacy_policy: bool
    web_template: str
    desktop_template: str
    logo: str
    dark_logo: str
    portal_banner: str
    favicon: str


@dataclass(frozen=True)
class OemConfigQuery:
    """
    OEM 配置查询条件。

    后续如果需要增加 terminal、productLine 等 query 参数，可继续扩展该模型。
    """

    language: str


@dataclass(frozen=True)
class OemConfigStoredFields:
    """
    OEM 配置入库字段。

    仅保存需要动态配置的字段，其余响应字段由代码默认值提供。
    """

    language: str
    theme: str
    logo: str
    dark_logo: str
    portal_banner: str
    favicon: str


@dataclass(frozen=True)
class OemConfigUpdate:
    """OEM 配置更新参数。"""

    language: Optional[str] = None
    theme: Optional[str] = None
    logo: Optional[str] = None
    dark_logo: Optional[str] = None
    portal_banner: Optional[str] = None
    favicon: Optional[str] = None


def normalize_oem_language(language: Optional[str]) -> str:
    """规范化 OEM 语言标识。"""
    normalized = (language or "").strip()
    if not normalized:
        return ""

    lowered = normalized.lower()
    if lowered == "en":
        return "en"
    if lowered == "zh-cn":
        return "zh-CN"
    if lowered == "zh-tw":
        return "zh-TW"
    return normalized

OEM_ASSET_DIR = Path(__file__).resolve().parents[1] / "assets" / "oem"


def _load_oem_asset_base64(language: str, filename: str) -> str:
    """读取默认 OEM 图片资源并转换为 Base64 字符串。"""
    return base64.b64encode(
        (OEM_ASSET_DIR / language / filename).read_bytes()
    ).decode("ascii")


DEFAULT_OEM_CONFIG = OemConfig(
    product="KWeaver DIP",
    theme="#126EE3",
    login_box_style="white",
    hide_logo=False,
    show_portal_banner=True,
    show_user_agreement=True,
    show_privacy_policy=True,
    web_template="default",
    desktop_template="default",
    logo=_load_oem_asset_base64(DEFAULT_LANGUAGE, "logo.png"),
    dark_logo=_load_oem_asset_base64(DEFAULT_LANGUAGE, "dark_logo.png"),
    portal_banner="决策智能体平台",
    favicon=_load_oem_asset_base64(DEFAULT_LANGUAGE, "favicon.png"),
)


def default_oem_config_stored_fields(language: str) -> OemConfigStoredFields:
    """按指定语言生成默认 OEM 配置入库字段。"""
    return OemConfigStoredFields(
        language=language,
        theme=DEFAULT_OEM_CONFIG.theme,
        logo=_load_oem_asset_base64(language, "logo.png"),
        dark_logo=_load_oem_asset_base64(language, "dark_logo.png"),
        portal_banner=DEFAULT_OEM_CONFIG.portal_banner,
        favicon=_load_oem_asset_base64(language, "favicon.png"),
    )
