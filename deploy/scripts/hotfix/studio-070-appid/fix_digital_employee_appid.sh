#!/usr/bin/env bash
# fix_digital_employee_appid.sh
#
# One-shot repair for the studio 0.7.0 upgrade gap that breaks digital-employee features after a
# 0.6.x -> 0.7.0 image overlay:
#   * "Unknown column 'app_id' in 'SELECT' / 'INSERT INTO'"
#   * install built-in digital employee (数据分析员 / BKN Creator) -> 502 Bad Gateway
#   * "Failed to query application accounts"
#
# Cause: studio 0.7.0 ships its schema only in migrations/mariadb/0.7.0/init.sql via
#   CREATE TABLE IF NOT EXISTS, with NO 0.6->0.7 ALTER. On an upgrade where t_digital_employee
#   already exists, IF NOT EXISTS is a no-op so app_id / bkn_scope / is_deleted never get added.
#
# This script adds the missing columns/index and creates any missing 0.7.0 tables. Idempotent
# (MariaDB "IF NOT EXISTS") — safe to re-run.
#
# Copy to the server and run:
#   chmod +x fix_digital_employee_appid.sh
#   ./fix_digital_employee_appid.sh                 # autodetect mariadb pod, prompt for root pw
#   ./fix_digital_employee_appid.sh -n kweaver --pod mariadb-0 --user root
#   MARIADB_ROOT_PASSWORD=xxxx ./fix_digital_employee_appid.sh -y
#   ./fix_digital_employee_appid.sh --direct "mysql -h 127.0.0.1 -P 3306"   # non-k8s (compose/bare)
set -euo pipefail

NS="" POD="" DBUSER="root" DBPASS="${MARIADB_ROOT_PASSWORD:-}" DB="kweaver" YES=false DIRECT=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    -n|--namespace) NS="${2:-}"; shift 2 ;;
    --pod) POD="${2:-}"; shift 2 ;;
    --user) DBUSER="${2:-}"; shift 2 ;;
    --password) DBPASS="${2:-}"; shift 2 ;;
    --db) DB="${2:-}"; shift 2 ;;
    --direct) DIRECT="${2:-}"; shift 2 ;;
    -y|--yes) YES=true; shift ;;
    -h|--help) sed -n '2,25p' "$0"; exit 0 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

log() { echo "[fix] $*"; }
die() { echo "[fix] ERROR: $*" >&2; exit 1; }

# --- The repair SQL (self-contained; no external file needed) ---
read -r -d '' FIX_SQL <<'SQL' || true
USE kweaver;
ALTER TABLE t_digital_employee
  ADD COLUMN IF NOT EXISTS app_id     CHAR(36)      NULL COMMENT '数字员工绑定的应用账号 ID' AFTER id,
  ADD COLUMN IF NOT EXISTS bkn_scope  VARCHAR(4096) NULL COMMENT '数字员工的知识范围，逗号隔开的 id 列表',
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE COMMENT '标记数字员工是否被删除';
ALTER TABLE t_digital_employee
  ADD INDEX IF NOT EXISTS idx_t_digital_employee_app_id (app_id);
CREATE TABLE IF NOT EXISTS t_studio_config (
  id INT NOT NULL AUTO_INCREMENT COMMENT '自增主键',
  kweaver_base_url VARCHAR(255) NULL, openclaw_address VARCHAR(255) NULL, openclaw_token VARCHAR(255) NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='DIP Studio 平台配置';
CREATE TABLE IF NOT EXISTS t_studio_user_preference (
  user_id VARCHAR(255) NOT NULL,
  pinned_digital_human_ids JSON NOT NULL DEFAULT ('[]'),
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Studio 用户偏好表';
CREATE TABLE IF NOT EXISTS t_studio_account_token (
  f_id VARCHAR(255) NOT NULL, f_type VARCHAR(16) NOT NULL, f_token TEXT NOT NULL,
  PRIMARY KEY (f_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='按主体存储的 KWeaver/BKN 访问令牌';
SQL
# Keep the embedded USE db in sync with --db if the operator overrides it.
[[ "$DB" != "kweaver" ]] && FIX_SQL="${FIX_SQL/USE kweaver;/USE $DB;}"

VERIFY_SQL="USE $DB; SHOW COLUMNS FROM t_digital_employee LIKE 'app_id';"

# --- Build the mysql invocation (k8s exec or direct) ---
if [[ -n "$DIRECT" ]]; then
  # Non-k8s: user supplies the mysql base command (host/port); we append creds.
  # shellcheck disable=SC2206
  BASE=( $DIRECT -u"$DBUSER" )
  runmysql() { MYSQL_PWD="$DBPASS" "${BASE[@]}"; }   # password via env, not argv
else
  command -v kubectl >/dev/null 2>&1 || die "kubectl not found (use --direct for non-k8s)"
  # Autodetect namespace + pod if not given.
  if [[ -z "$POD" ]]; then
    line="$(kubectl get pods -A 2>/dev/null | grep -iE 'maria|mysql' | grep -iv 'exporter\|backup' | head -1 || true)"
    [[ -z "$line" ]] && die "no mariadb/mysql pod found; pass --pod and -n"
    NS="${NS:-$(awk '{print $1}' <<<"$line")}"
    POD="$(awk '{print $2}' <<<"$line")"
  fi
  [[ -z "$NS" ]] && die "namespace unknown; pass -n <namespace>"
  log "target pod: $NS/$POD  db: $DB  user: $DBUSER"
  # Run mysql INSIDE the pod; password via MYSQL_PWD env in-container (not in host argv).
  runmysql() { kubectl exec -i -n "$NS" "$POD" -- env MYSQL_PWD="$DBPASS" mysql -u"$DBUSER" --batch; }
fi

# --- Password ---
if [[ -z "$DBPASS" ]]; then
  read -r -s -p "[fix] MariaDB password for $DBUSER: " DBPASS; echo
fi

# --- Confirm (additive DDL; low risk but it's still a schema change) ---
if [[ "$YES" != true ]]; then
  echo "[fix] Will run additive DDL on DB '$DB' (ADD COLUMN IF NOT EXISTS app_id/bkn_scope/is_deleted"
  echo "      on t_digital_employee, + create missing 0.7.0 tables). Idempotent."
  read -r -p "[fix] Proceed? [y/N] " ans
  [[ "$ans" =~ ^[Yy]$ ]] || { log "aborted."; exit 0; }
fi

# --- Apply ---
log "applying repair SQL ..."
if ! printf '%s\n' "$FIX_SQL" | runmysql; then
  die "SQL failed. Check DB name (--db), that t_digital_employee exists, and MariaDB version supports 'ADD COLUMN IF NOT EXISTS' (10.0.2+). For 达梦/DM8 use the dm8 0.7.0 definitions."
fi

# --- Verify ---
log "verifying app_id column ..."
out="$(printf '%s\n' "$VERIFY_SQL" | runmysql || true)"
if grep -q 'app_id' <<<"$out"; then
  log "OK: t_digital_employee.app_id present."
  log "Now retry in the UI: install 数据分析员 / BKN Creator, and bind an application account."
else
  die "app_id still missing after apply — output:\n$out"
fi
