import {
  Router,
  type NextFunction,
  type Request,
  type Response
} from "express";

import {
  DefaultDigitalEmployeeTokenAdapter,
  type DigitalEmployeeTokenAdapter
} from "../adapters/digital-employee-token-adapter";
import {
  DefaultUserManagementAdapter,
  type UserManagementAdapter
} from "../adapters/user-management-adapter";
import { HttpError } from "../errors/http-error";
import { createStudioDatabasePool } from "../infra/mariadb-client";
import type { IsfQuery } from "../infra/isf-http-client";
import { getStudioDatabaseConfig } from "../utils/env";
import { writeProxyResponse } from "./bkn";
import { readOptionalBearerToken } from "./proxy-auth";

const digitalEmployeeTokenAdapter = new DefaultDigitalEmployeeTokenAdapter(
  createStudioDatabasePool(getStudioDatabaseConfig())
);

/**
 * Builds the user-management proxy router.
 *
 * @param adapter Optional user-management adapter implementation.
 * @returns The router exposing user-management proxy endpoints.
 */
export function createUserManagementRouter(
  adapter: UserManagementAdapter = new DefaultUserManagementAdapter(),
  tokenAdapter: DigitalEmployeeTokenAdapter = digitalEmployeeTokenAdapter
): Router {
  const router = Router();

  router.get(
    "/api/dip-studio/v1/user-management/apps",
    async (
      request: Request<unknown, unknown, unknown, IsfQuery>,
      response: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const result = await adapter.listApps(
          request.query,
          readOptionalBearerToken(request)
        );
        response.status(result.status);
        result.headers.forEach((value, key) => {
          if (key.toLowerCase() !== "content-length") {
            response.setHeader(key, value);
          }
        });
        response.send(await enrichAppListWithKweaverTokenFlag(result.body, tokenAdapter));
      } catch (error) {
        next(error instanceof HttpError ? error : new HttpError(502, "Failed to query application accounts"));
      }
    }
  );

  router.post(
    "/api/dip-studio/v1/user-management/apps",
    async (
      request: Request<unknown, unknown, unknown, unknown>,
      response: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const bearerToken = readOptionalBearerToken(request);
        const result = await adapter.createApp(
          request.body,
          bearerToken
        );
        await createAndStoreKweaverTokenForApp(result, bearerToken, adapter, tokenAdapter);
        writeProxyResponse(response, result);
      } catch (error) {
        next(error instanceof HttpError ? error : new HttpError(502, "Failed to create application account"));
      }
    }
  );

  router.post(
    "/api/dip-studio/v1/user-management/console/app-tokens",
    async (
      request: Request<unknown, unknown, unknown, unknown>,
      response: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const result = await adapter.createAppToken(
          request.body,
          readOptionalBearerToken(request)
        );
        writeProxyResponse(response, result);
      } catch (error) {
        next(error instanceof HttpError ? error : new HttpError(502, "Failed to create application account token"));
      }
    }
  );

  return router;
}

interface UserManagementAppListEntry {
  id?: unknown;
  [key: string]: unknown;
}

interface UserManagementAppListResponseBody {
  entries?: unknown;
  total_count?: unknown;
  [key: string]: unknown;
}

interface UserManagementCreateAppResponseBody {
  id?: unknown;
}

interface UserManagementAppTokenResponseBody {
  token?: unknown;
}

async function enrichAppListWithKweaverTokenFlag(
  body: string,
  tokenAdapter: DigitalEmployeeTokenAdapter
): Promise<string> {
  const parsed = JSON.parse(body) as UserManagementAppListResponseBody;
  const entries = Array.isArray(parsed.entries) ? parsed.entries : [];

  const enrichedEntries = await Promise.all(entries.map(async (entry) => {
    if (typeof entry !== "object" || entry === null) {
      return entry;
    }

    const app = entry as UserManagementAppListEntry;

    if (typeof app.id !== "string") {
      return entry;
    }

    return {
      ...app,
      has_kweaver_token: await tokenAdapter.hasStudioAppToken(app.id)
    };
  }));

  return JSON.stringify({
    ...parsed,
    entries: enrichedEntries
  });
}

async function createAndStoreKweaverTokenForApp(
  createAppResponse: { status: number; body: string },
  bearerToken: string | undefined,
  adapter: UserManagementAdapter,
  tokenAdapter: DigitalEmployeeTokenAdapter
): Promise<void> {
  if (createAppResponse.status < 200 || createAppResponse.status >= 300) {
    return;
  }
  if (bearerToken === undefined || bearerToken.trim().length === 0) {
    return;
  }

  const appId = parseCreatedAppId(createAppResponse.body);
  const appTokenResponse = await adapter.createAppToken({ id: appId }, bearerToken);
  const token = parseAppToken(appTokenResponse.body);

  await tokenAdapter.upsertStudioAppToken(appId, token);
}

function parseCreatedAppId(body: string): string {
  const parsed = JSON.parse(body) as UserManagementCreateAppResponseBody;

  if (typeof parsed.id !== "string" || parsed.id.trim().length === 0) {
    throw new HttpError(502, "user-management create app response is invalid");
  }

  return parsed.id;
}

function parseAppToken(body: string): string {
  const parsed = JSON.parse(body) as UserManagementAppTokenResponseBody;

  if (typeof parsed.token !== "string" || parsed.token.trim().length === 0) {
    throw new HttpError(502, "user-management app token response is invalid");
  }

  return parsed.token;
}
