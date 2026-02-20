import crypto from "crypto"

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

export function generateRoomCode(length = 6): string {
    const bytes = crypto.randomBytes(length);
    let out = "";

    for (const byte of bytes) {
        out += ALPHABET[byte % ALPHABET.length];
    }

    return out;
}