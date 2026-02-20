import crypto from "crypto";
import { env } from "../env";

export function newSessionToken(): string {
    return crypto.randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
    return crypto.createHmac("sha256", env.SESSION_SECRET).update(token).digest("hex");
}