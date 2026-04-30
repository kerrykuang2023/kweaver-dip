"""
OEM 配置数据库适配器

从 MariaDB 读取 DIP OEM 配置。
"""
import asyncio
import logging
from typing import Optional

import pymysql
from dbutilsx.pooled_db import PooledDB, PooledDBInfo

from src.domains.oem_config import (
    OemConfigQuery,
    OemConfigStoredFields,
    OemConfigUpdate,
)
from src.infrastructure.config.settings import Settings
from src.ports.oem_config_port import OemConfigPort

logger = logging.getLogger(__name__)

_SELECT_COLUMNS = """
    SELECT language, theme, logo, dark_logo, portal_banner, favicon
    FROM t_oem_config
    WHERE language = %s
"""

_UPSERT_OEM_CONFIG = """
    INSERT INTO t_oem_config
        (language, theme, logo, dark_logo, portal_banner, favicon)
    VALUES
        (%s, %s, %s, %s, %s, %s)
    ON DUPLICATE KEY UPDATE
        theme = VALUES(theme),
        logo = VALUES(logo),
        dark_logo = VALUES(dark_logo),
        portal_banner = VALUES(portal_banner),
        favicon = VALUES(favicon)
"""


class OemConfigAdapter(OemConfigPort):
    """
    OEM 配置数据库适配器。

    使用 pymysql + PooledDB 进行同步数据库操作，
    通过 asyncio.to_thread() 在线程池中执行以兼容 FastAPI 异步模型。
    """

    def __init__(self, settings: Settings):
        self._settings = settings
        self._pool: Optional[PooledDB] = None

    def _get_pool(self) -> PooledDB:
        if self._pool is None:
            info = PooledDBInfo(
                creator=pymysql,
                host=self._settings.db_host,
                port=self._settings.db_port,
                user=self._settings.db_user,
                password=self._settings.db_password,
                database=self._settings.db_name,
                autocommit=True,
                mincached=1,
                maxcached=5,
                maxconnections=10,
                blocking=True,
            )
            self._pool = PooledDB(master=info, backup=info)
            logger.info(
                "OEM 配置数据库连接池已创建: %s:%s/%s",
                self._settings.db_host,
                self._settings.db_port,
                self._settings.db_name,
            )
        return self._pool

    async def close(self):
        """释放数据库连接池。"""
        self._pool = None
        logger.info("OEM 配置数据库连接池已释放")

    @staticmethod
    def _row_to_config(row: tuple) -> OemConfigStoredFields:
        if row is None:
            raise RuntimeError("OEM 配置写入后未查询到记录")
        return OemConfigStoredFields(
            language=row[0],
            theme=row[1],
            logo=row[2],
            dark_logo=row[3],
            portal_banner=row[4],
            favicon=row[5],
        )

    def _sync_get_oem_config(self, language: str) -> Optional[tuple]:
        pool = self._get_pool()
        with pool.connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(_SELECT_COLUMNS, (language,))
                return cursor.fetchone()

    def _sync_update_oem_configs(
        self,
        configs: list[OemConfigUpdate],
    ) -> list[tuple]:
        pool = self._get_pool()
        with pool.connection() as conn:
            try:
                rows = []
                with conn.cursor() as cursor:
                    cursor.execute("START TRANSACTION")
                    for config in configs:
                        cursor.execute(
                            _UPSERT_OEM_CONFIG,
                            (
                                config.language,
                                config.theme,
                                config.logo,
                                config.dark_logo,
                                config.portal_banner,
                                config.favicon,
                            ),
                        )
                    for config in configs:
                        cursor.execute(
                            _SELECT_COLUMNS,
                            (config.language,),
                        )
                        row = cursor.fetchone()
                        if row is None:
                            raise RuntimeError(
                                f"OEM 配置写入后未查询到记录: language={config.language}"
                            )
                        rows.append(row)
                    cursor.execute("COMMIT")
                return rows
            except Exception:
                try:
                    with conn.cursor() as cursor:
                        cursor.execute("ROLLBACK")
                except Exception:
                    logger.exception("OEM 配置批量更新回滚失败")
                raise

    async def get_oem_config(
        self,
        query: OemConfigQuery,
    ) -> Optional[OemConfigStoredFields]:
        row = await asyncio.to_thread(
            self._sync_get_oem_config,
            query.language,
        )
        if row is None:
            return None
        return self._row_to_config(row)

    async def update_oem_configs(
        self,
        configs: list[OemConfigUpdate],
    ) -> list[OemConfigStoredFields]:
        rows = await asyncio.to_thread(
            self._sync_update_oem_configs,
            configs,
        )
        return [
            self._row_to_config(row)
            for row in rows
        ]
