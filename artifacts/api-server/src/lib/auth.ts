import jwt from "jsonwebtoken";

const SECRET = process.env.SESSION_SECRET ?? "artech-dev-secret";

export interface TokenPayload {
  type: "usher" | "admin";
  id: number;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, SECRET) as TokenPayload;
}
