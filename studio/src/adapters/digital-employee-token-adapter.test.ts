import type { Pool } from "mysql2/promise";
import { describe, expect, it, vi } from "vitest";

import { DefaultDigitalEmployeeTokenAdapter } from "./digital-employee-token-adapter";

/**
 * Creates a minimal MySQL pool test double.
 *
 * @returns A mocked pool.
 */
function createPoolDouble(): Pool {
  return {
    execute: vi.fn()
  } as unknown as Pool;
}

describe("DefaultDigitalEmployeeTokenAdapter", () => {
  it("reads the application account id by agent id", async () => {
    const pool = createPoolDouble();
    vi.mocked(pool.execute).mockResolvedValue([
      [{ app_id: "app-1" }],
      []
    ] as never);
    const adapter = new DefaultDigitalEmployeeTokenAdapter(pool);

    await expect(adapter.findAppId("agent-1")).resolves.toBe("app-1");
    expect(pool.execute).toHaveBeenCalledWith(
      [
        "SELECT app_id FROM t_digital_employee",
        "WHERE id = :agentId AND is_deleted = FALSE",
        "LIMIT 1"
      ].join(" "),
      { agentId: "agent-1" }
    );
  });

  it("checks whether the app account already has a Studio token record", async () => {
    const pool = createPoolDouble();
    vi.mocked(pool.execute).mockResolvedValue([
      [{ exists_flag: 1 }],
      []
    ] as never);
    const adapter = new DefaultDigitalEmployeeTokenAdapter(pool);

    await expect(adapter.hasStudioAppToken("app-1")).resolves.toBe(true);
    expect(pool.execute).toHaveBeenCalledWith(
      [
        "SELECT 1 AS exists_flag FROM t_studio_account_token",
        "WHERE f_id = :appId AND f_type = 'app'",
        "LIMIT 1"
      ].join(" "),
      { appId: "app-1" }
    );
  });

  it("returns false when the app account has no Studio token record", async () => {
    const pool = createPoolDouble();
    vi.mocked(pool.execute).mockResolvedValue([[], []] as never);
    const adapter = new DefaultDigitalEmployeeTokenAdapter(pool);

    await expect(adapter.hasStudioAppToken("app-1")).resolves.toBe(false);
  });

  it("reads the token by agent id", async () => {
    const pool = createPoolDouble();
    vi.mocked(pool.execute).mockResolvedValue([
      [{ kweaver_token: "token-1" }],
      []
    ] as never);
    const adapter = new DefaultDigitalEmployeeTokenAdapter(pool);

    await expect(adapter.findKweaverToken("agent-1")).resolves.toBe("token-1");
    expect(pool.execute).toHaveBeenCalledWith(
      [
        "SELECT account_token.f_token AS kweaver_token",
        "FROM t_digital_employee digital_employee",
        "LEFT JOIN t_studio_account_token account_token",
        "ON digital_employee.app_id = account_token.f_id",
        "AND account_token.f_type = 'app'",
        "WHERE digital_employee.id = :agentId",
        "AND digital_employee.is_deleted = FALSE",
        "LIMIT 1"
      ].join(" "),
      { agentId: "agent-1" }
    );
  });

  it("returns undefined for missing rows", async () => {
    const pool = createPoolDouble();
    vi.mocked(pool.execute).mockResolvedValue([[], []] as never);
    const adapter = new DefaultDigitalEmployeeTokenAdapter(pool);

    await expect(adapter.findKweaverToken("agent-1")).resolves.toBeUndefined();
  });

  it("returns undefined for null token values", async () => {
    const pool = createPoolDouble();
    vi.mocked(pool.execute).mockResolvedValue([
      [{ kweaver_token: null }],
      []
    ] as never);
    const adapter = new DefaultDigitalEmployeeTokenAdapter(pool);

    await expect(adapter.findKweaverToken("agent-1")).resolves.toBeUndefined();
  });

  it("reads the BKN scope by agent id", async () => {
    const pool = createPoolDouble();
    vi.mocked(pool.execute).mockResolvedValue([
      [{ bkn_scope: "kn-1,kn-2" }],
      []
    ] as never);
    const adapter = new DefaultDigitalEmployeeTokenAdapter(pool);

    await expect(adapter.findBknScope("agent-1")).resolves.toBe("kn-1,kn-2");
    expect(pool.execute).toHaveBeenCalledWith(
      [
        "SELECT bkn_scope FROM t_digital_employee",
        "WHERE id = :agentId AND is_deleted = FALSE",
        "LIMIT 1"
      ].join(" "),
      { agentId: "agent-1" }
    );
  });

  it("upserts the full digital employee row", async () => {
    const pool = createPoolDouble();
    vi.mocked(pool.execute).mockResolvedValue([[], []] as never);
    const adapter = new DefaultDigitalEmployeeTokenAdapter(pool);

    await adapter.upsertDigitalEmployee("agent-1", "app-1", "token-1", "kn-1,kn-2");

    expect(pool.execute).toHaveBeenNthCalledWith(
      1,
      [
        "INSERT INTO t_digital_employee (id, app_id, bkn_scope, is_deleted)",
        "VALUES (:agentId, :appId, :bknScope, FALSE)",
        "ON DUPLICATE KEY UPDATE",
        "app_id = VALUES(app_id),",
        "bkn_scope = VALUES(bkn_scope),",
        "is_deleted = FALSE"
      ].join(" "),
      { agentId: "agent-1", appId: "app-1", bknScope: "kn-1,kn-2" }
    );
    expect(pool.execute).toHaveBeenNthCalledWith(
      2,
      [
        "INSERT INTO t_studio_account_token (f_id, f_type, f_token)",
        "VALUES (:appId, 'app', :token)",
        "ON DUPLICATE KEY UPDATE",
        "f_token = VALUES(f_token)"
      ].join(" "),
      { appId: "app-1", token: "token-1" }
    );
  });

  it("upserts the Studio app token directly by app id", async () => {
    const pool = createPoolDouble();
    vi.mocked(pool.execute).mockResolvedValue([[], []] as never);
    const adapter = new DefaultDigitalEmployeeTokenAdapter(pool);

    await adapter.upsertStudioAppToken("app-1", "token-1");

    expect(pool.execute).toHaveBeenCalledWith(
      [
        "INSERT INTO t_studio_account_token (f_id, f_type, f_token)",
        "VALUES (:appId, 'app', :token)",
        "ON DUPLICATE KEY UPDATE",
        "f_token = VALUES(f_token)"
      ].join(" "),
      { appId: "app-1", token: "token-1" }
    );
  });

  it("upserts the application account id by agent id", async () => {
    const pool = createPoolDouble();
    vi.mocked(pool.execute).mockResolvedValue([[], []] as never);
    const adapter = new DefaultDigitalEmployeeTokenAdapter(pool);

    await adapter.upsertAppId("agent-1", "app-1");

    expect(pool.execute).toHaveBeenCalledWith(
      [
        "INSERT INTO t_digital_employee (id, app_id, is_deleted)",
        "VALUES (:agentId, :appId, FALSE)",
        "ON DUPLICATE KEY UPDATE",
        "app_id = VALUES(app_id),",
        "is_deleted = FALSE"
      ].join(" "),
      { agentId: "agent-1", appId: "app-1" }
    );
  });

  it("upserts the token by the bound application account id", async () => {
    const pool = createPoolDouble();
    vi.mocked(pool.execute)
      .mockResolvedValueOnce([
        [{ app_id: "app-1" }],
        []
      ] as never)
      .mockResolvedValueOnce([[], []] as never);
    const adapter = new DefaultDigitalEmployeeTokenAdapter(pool);

    await adapter.upsertKweaverToken("agent-1", "token-1");

    expect(pool.execute).toHaveBeenNthCalledWith(
      1,
      [
        "SELECT app_id FROM t_digital_employee",
        "WHERE id = :agentId AND is_deleted = FALSE",
        "LIMIT 1"
      ].join(" "),
      { agentId: "agent-1" }
    );
    expect(pool.execute).toHaveBeenNthCalledWith(
      2,
      [
        "INSERT INTO t_studio_account_token (f_id, f_type, f_token)",
        "VALUES (:appId, 'app', :token)",
        "ON DUPLICATE KEY UPDATE",
        "f_token = VALUES(f_token)"
      ].join(" "),
      { appId: "app-1", token: "token-1" }
    );
  });

  it("does not upsert a token when the digital employee has no bound application account", async () => {
    const pool = createPoolDouble();
    vi.mocked(pool.execute).mockResolvedValueOnce([[], []] as never);
    const adapter = new DefaultDigitalEmployeeTokenAdapter(pool);

    await adapter.upsertKweaverToken("agent-1", "token-1");

    expect(pool.execute).toHaveBeenCalledWith(
      [
        "SELECT app_id FROM t_digital_employee",
        "WHERE id = :agentId AND is_deleted = FALSE",
        "LIMIT 1"
      ].join(" "),
      { agentId: "agent-1" }
    );
    expect(pool.execute).toHaveBeenCalledTimes(1);
  });

  it("returns early when token upsert receives null", async () => {
    const pool = createPoolDouble();
    const adapter = new DefaultDigitalEmployeeTokenAdapter(pool);

    await adapter.upsertKweaverToken("agent-1", null);

    expect(pool.execute).not.toHaveBeenCalled();
  });

  it("upserts the BKN scope by agent id", async () => {
    const pool = createPoolDouble();
    vi.mocked(pool.execute).mockResolvedValue([[], []] as never);
    const adapter = new DefaultDigitalEmployeeTokenAdapter(pool);

    await adapter.upsertBknScope("agent-1", "kn-1,kn-2");

    expect(pool.execute).toHaveBeenCalledWith(
      [
        "INSERT INTO t_digital_employee (id, bkn_scope, is_deleted)",
        "VALUES (:agentId, :bknScope, FALSE)",
        "ON DUPLICATE KEY UPDATE",
        "bkn_scope = VALUES(bkn_scope),",
        "is_deleted = FALSE"
      ].join(" "),
      { agentId: "agent-1", bknScope: "kn-1,kn-2" }
    );
  });

  it("clears the token by agent id", async () => {
    const pool = createPoolDouble();
    vi.mocked(pool.execute).mockResolvedValue([[], []] as never);
    const adapter = new DefaultDigitalEmployeeTokenAdapter(pool);

    await adapter.deleteKweaverToken("agent-1");

    expect(pool.execute).toHaveBeenCalledWith(
      [
        "UPDATE t_digital_employee",
        "SET app_id = NULL, bkn_scope = NULL",
        "WHERE id = :agentId"
      ].join(" "),
      { agentId: "agent-1" }
    );
  });

  it("marks the digital employee as deleted", async () => {
    const pool = createPoolDouble();
    vi.mocked(pool.execute).mockResolvedValue([[], []] as never);
    const adapter = new DefaultDigitalEmployeeTokenAdapter(pool);

    await adapter.markDigitalEmployeeDeleted("agent-1");

    expect(pool.execute).toHaveBeenCalledWith(
      "UPDATE t_digital_employee SET is_deleted = TRUE WHERE id = :agentId",
      { agentId: "agent-1" }
    );
  });
});
