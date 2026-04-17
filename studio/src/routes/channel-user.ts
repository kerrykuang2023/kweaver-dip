import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";

import { OpenClawAgentsGatewayAdapter } from "../adapters/openclaw-agents-adapter";
import { HttpError } from "../errors/http-error";
import { OpenClawGatewayClient } from "../infra/openclaw-gateway-client";
import { DefaultChannelUserLogic, type ChannelUserLogic } from "../logic/channel-user";
import { readChannelUserListQuery } from "./channel-user-query";
import type {
  ChannelUser,
  ChannelUserExportResult,
  ChannelUserListResponse,
  ChannelUserType,
  UpsertChannelUserRequest
} from "../types/channel-user";
import { getEnv } from "../utils/env";

const env = getEnv();
const openClawAgentsAdapter = new OpenClawAgentsGatewayAdapter(
  OpenClawGatewayClient.getInstance({
    url: env.openClawGatewayUrl,
    token: env.openClawGatewayToken,
    timeoutMs: env.openClawGatewayTimeoutMs
  })
);
const channelUserLogic = new DefaultChannelUserLogic({ openClawAgentsAdapter });
const channelUserUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }
});

/**
 * Builds the channel user router.
 *
 * @param logic Optional channel user logic override.
 * @returns The router exposing channel user endpoints.
 */
export function createChannelUserRouter(
  logic: ChannelUserLogic = channelUserLogic
): Router {
  const router = Router();

  router.get(
    "/api/dip-studio/v1/channel-users",
    async (
      request: Request<unknown, ChannelUserListResponse>,
      response: Response<ChannelUserListResponse>,
      next: NextFunction
    ): Promise<void> => {
      try {
        const query = readChannelUserListQuery(request.query);
        response.status(200).json(await logic.listChannelUsers(query));
      } catch (error) {
        next(
          error instanceof HttpError
            ? error
            : new HttpError(502, "Failed to query channel users")
        );
      }
    }
  );

  router.put(
    "/api/dip-studio/v1/channel-users/:id",
    async (
      request: Request<{ id: string }, ChannelUser, UpsertChannelUserRequest>,
      response: Response<ChannelUser>,
      next: NextFunction
    ): Promise<void> => {
      try {
        const id = readRequiredIdParam(request.params.id, "id");
        response.status(200).json(
          await logic.updateChannelUser(id, readUpsertChannelUserRequest(request.body))
        );
      } catch (error) {
        next(
          error instanceof HttpError
            ? error
            : new HttpError(502, "Failed to update channel user")
        );
      }
    }
  );

  router.get(
    "/api/dip-studio/v1/channel-users/export",
    async (
      _request: Request,
      response: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const result = await logic.exportChannelUsers();
        writeJsonlDownload(response, result);
      } catch (error) {
        next(
          error instanceof HttpError
            ? error
            : new HttpError(502, "Failed to export channel users")
        );
      }
    }
  );

  router.post(
    "/api/dip-studio/v1/channel-users/import",
    handleChannelUserImportMultipart,
    async (
      request: Request,
      response: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const file = request.file;
        if (file === undefined || file.buffer.length === 0) {
          throw new HttpError(400, "Multipart field `file` is required");
        }
        const result = await logic.importChannelUsers(file.buffer.toString("utf-8"));
        response.status(200).json(result);
      } catch (error) {
        next(
          error instanceof HttpError
            ? error
            : new HttpError(502, "Failed to import channel users")
        );
      }
    }
  );

  return router;
}

/**
 * Parses and validates one create / update request body.
 *
 * @param body Raw parsed request body.
 * @returns The normalized payload.
 */
export function readUpsertChannelUserRequest(body: unknown): UpsertChannelUserRequest {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new HttpError(400, "Request body must be a JSON object");
  }

  const raw = body as Record<string, unknown>;
  const displayName = readRequiredTrimmedString(raw.displayName, "displayName");
  if (typeof raw.channel !== "object" || raw.channel === null || Array.isArray(raw.channel)) {
    throw new HttpError(400, "channel is required");
  }
  const channel = raw.channel as Record<string, unknown>;

  return {
    displayName,
    channel: {
      type: readRequiredChannelUserType(channel.type),
      openid: readRequiredTrimmedString(channel.openid, "channel.openid")
    }
  };
}

/**
 * Handles multipart parsing for the JSONL import endpoint.
 *
 * @param request Incoming HTTP request.
 * @param response Outgoing HTTP response.
 * @param next Express continuation callback.
 */
function handleChannelUserImportMultipart(
  request: Request,
  response: Response,
  next: NextFunction
): void {
  channelUserUpload.single("file")(request, response, (error: unknown) => {
    if (error === undefined) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      next(new HttpError(400, error.message));
      return;
    }

    next(new HttpError(400, error instanceof Error ? error.message : String(error)));
  });
}

/**
 * Writes the JSONL export response headers and body.
 *
 * @param response Express response.
 * @param result Export payload.
 */
function writeJsonlDownload(response: Response, result: ChannelUserExportResult): void {
  response.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  response.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(result.filename)}`);
  response.status(200).send(result.content);
}

/**
 * Reads one required route parameter.
 *
 * @param value Raw route parameter value.
 * @param key Parameter key used in the error message.
 * @returns The normalized string.
 */
function readRequiredIdParam(value: string | undefined, key: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpError(400, `${key} path parameter is required`);
  }
  return value.trim();
}

/**
 * Reads one required non-empty string.
 *
 * @param value Raw field value.
 * @param key Field key.
 * @returns Trimmed non-empty string.
 */
function readRequiredTrimmedString(value: unknown, key: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpError(400, `${key} is required`);
  }
  return value.trim();
}

/**
 * Reads one required channel user type.
 *
 * @param value Raw field value.
 * @returns Validated channel user type.
 */
function readRequiredChannelUserType(value: unknown): ChannelUserType {
  const type = value === "feishu" || value === "dingding"
    ? value
    : undefined;
  if (type === undefined) {
    throw new HttpError(400, 'channel.type must be "feishu" or "dingding"');
  }
  return type;
}
