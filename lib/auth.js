import jwt from 'jsonwebtoken';
import { query } from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'leadospush_secret_key_change_in_production_2024';
const TOKEN_EXPIRY = '7d';

export function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// Extract user from Authorization header or cookie
export async function getUserFromRequest(request) {
  let token = null;

  // Check Authorization header first
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }

  // Fall back to cookie
  if (!token) {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(/leadosToken=([^;]+)/);
    if (match) token = match[1];
  }

  if (!token) return null;

  const decoded = verifyToken(token);
  if (!decoded) return null;

  // Verify user still exists and is active
  const result = await query(
    'SELECT id, email, name, role, status FROM users WHERE id = $1',
    [decoded.id]
  );

  if (result.rows.length === 0) return null;
  const user = result.rows[0];
  if (user.status !== 'active') return null;

  return user;
}

// Middleware helper: returns user or error response
export async function requireAuth(request) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return { error: 'Unauthorized', status: 401 };
  }
  return { user };
}

// Middleware helper: requires admin role
export async function requireAdmin(request) {
  const result = await requireAuth(request);
  if (result.error) return result;
  if (result.user.role !== 'admin') {
    return { error: 'Forbidden: Admin access required', status: 403 };
  }
  return result;
}
