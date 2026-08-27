import path from 'path';

import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const ACCESS_SECRET =
  process.env['JWT_SECRET'] ?? 'orbit_default_dev_jwt_secret_32_characters_long';
const REFRESH_SECRET =
  process.env['REFRESH_SECRET'] ?? 'orbit_default_dev_refresh_secret_32_chars';
const ACCESS_TTL_SECONDS = 15 * 60; // 15 min
const REFRESH_TTL_SECONDS = 7 * 24 * 3600; // 7 days

export interface AccessPayload {
  sub: string; // user id
  type: 'access';
}

export interface RefreshPayload {
  sub: string;       // user id
  family: string;    // session family UUID (for replay detection)
  type: 'refresh';
}

export function signAccessToken(userId: string): string {
  const payload: AccessPayload = { sub: userId, type: 'access' };
  return jwt.sign(payload, ACCESS_SECRET, {
    expiresIn: ACCESS_TTL_SECONDS,
  });
}

export function signRefreshToken(userId: string, family: string): string {
  const payload: RefreshPayload = { sub: userId, family, type: 'refresh' };
  return jwt.sign(payload, REFRESH_SECRET, {
    expiresIn: REFRESH_TTL_SECONDS,
  });
}

export function verifyAccessToken(token: string): AccessPayload {
  return jwt.verify(token, ACCESS_SECRET) as AccessPayload;
}

export function verifyRefreshToken(token: string): RefreshPayload {
  return jwt.verify(token, REFRESH_SECRET) as RefreshPayload;
}

export const ACCESS_TTL_SECONDS_EXPORT = ACCESS_TTL_SECONDS;
export const REFRESH_TTL_SECONDS_EXPORT = REFRESH_TTL_SECONDS;
