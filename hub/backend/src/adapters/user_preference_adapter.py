"""
用户偏好数据库适配器
"""
import asyncio
import json
import logging
from typing import Optional

import pymysql
from dbutilsx.pooled_db import PooledDB, PooledDBInfo

from src.domains.user_preference import UserPreference
from src.infrastructure.config.settings import Settings
from src.ports.user_preference_port import UserPreferencePort

logger = logging.getLogger(__name__)

_CONTENT_KEY_PINNED_DH = "pinned_digital_human_ids"


class UserPreferenceAdapter(UserPreferencePort):
    """将用户偏好存入 t_user_preference.content（JSON 文本）。"""

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
            logger.info("用户偏好数据库连接池已创建")
        return self._pool

    async def close(self) -> None:
        self._pool = None

    def _sync_get_by_user_id(self, user_id: str) -> UserPreference:
        pool = self._get_pool()
        with pool.connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    "SELECT content FROM t_user_preference WHERE user_id = %s",
                    (user_id,),
                )
                row = cursor.fetchone()
                if not row or row[0] is None:
                    return UserPreference()
                raw = row[0]
                if isinstance(raw, (bytes, bytearray)):
                    raw = raw.decode("utf-8")
                try:
                    data = json.loads(raw)
                except json.JSONDecodeError:
                    logger.warning("用户 %s 偏好 JSON 损坏，返回默认", user_id)
                    return UserPreference()
                if not isinstance(data, dict):
                    return UserPreference()
                ids = data.get(_CONTENT_KEY_PINNED_DH)
                if not isinstance(ids, list):
                    return UserPreference()
                cleaned = [str(x).strip() for x in ids if str(x).strip()]
                return UserPreference(pinned_digital_human_ids=cleaned)

    def _sync_upsert(self, user_id: str, preference: UserPreference) -> None:
        pool = self._get_pool()
        payload = {
            _CONTENT_KEY_PINNED_DH: list(preference.pinned_digital_human_ids),
        }
        content = json.dumps(payload, ensure_ascii=False)
        with pool.connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO t_user_preference (user_id, content)
                    VALUES (%s, %s)
                    ON DUPLICATE KEY UPDATE content = VALUES(content)
                    """,
                    (user_id, content),
                )

    async def get_by_user_id(self, user_id: str) -> UserPreference:
        return await asyncio.to_thread(self._sync_get_by_user_id, user_id)

    async def upsert(self, user_id: str, preference: UserPreference) -> None:
        await asyncio.to_thread(self._sync_upsert, user_id, preference)
