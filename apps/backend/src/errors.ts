export type ApiErrorCode =
  | "INVALID_REQUEST"
  | "UNAUTHORISED"
  | "FORBIDDEN"
  | "ROOM_NOT_FOUND"
  | "ROOM_GONE"
  | "INTERNAL_ERROR";

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
