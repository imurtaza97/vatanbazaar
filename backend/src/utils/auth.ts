// /src/utils/auth.ts

import bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { SignOptions, Secret } from 'jsonwebtoken';

const SALT_ROUNDS = process.env.SALT_ROUNDS ? parseInt(process.env.SALT_ROUNDS) : 10;

/**
 * Async function to hash password
 */

async function hashPassword(password: string) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * async function to compare password
 */
async function comparePassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

/**
 * async function to generate jwt token
 */
function generateToken(payload: object, expiresIn: string | number = '1h') {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }
  const options: SignOptions = { expiresIn: expiresIn as any, algorithm : 'HS256' };
  return jwt.sign(payload, secret, options);
}

/**
 * async function to generate a long-lived JWT refresh token
 */
function generateRefreshToken(payload: object, expiresIn: string | number = '7d') {
  // Use a separate secret if defined, otherwise fall back to JWT_SECRET
  const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }
  const options: SignOptions = { expiresIn: expiresIn as any, algorithm : 'HS256' };
  return jwt.sign(payload, secret, options);
}


/**
 * async function to verify jwt token
 */
function verifyToken(token: string, secret?: Secret) {
  // Use the provided secret or default to JWT_SECRET
  const usedSecret: Secret | undefined = secret || process.env.JWT_SECRET;
  if (!usedSecret) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }
  
  try {
    return jwt.verify(token, usedSecret);
  } catch (error) {
    console.error('Token verification error:', error);
    throw new Error('Invalid token');
  }
}

export { hashPassword, comparePassword, generateToken, generateRefreshToken, verifyToken };