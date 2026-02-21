export type ApiErrorCode =
  | "INVALID_REQUEST"
  | "UNAUTHORISED"
  | "FORBIDDEN"
  | "ROOM_NOT_FOUND"
  | "ROOM_GONE"
  | "INTERNAL_ERROR"
  | "STEAM_IDENTITY_NOT_FOUND"
  | "STEAM_UPSTREAM_ERROR"
  | "STEAM_ACCOUNT_NOT_FOUND"
  | "STEAM_GAMES_NOT_VISIBLE";

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: ApiErrorCode;
  public readonly details?: unknown;

  constructor(status: number, code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
