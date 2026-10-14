import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/auth';
import { prisma } from '../services/db';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    name: string;
    badgeNumber?: string | null;
  };
}

export async function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'AUTHENTICATION REQUIRED: Missing or invalid authorization token' });
  }

  const token = authHeader.split(' ')[1];
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'AUTHENTICATION EXPIRED: Session token is invalid or expired' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, role: true, name: true, badgeNumber: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'USER NOT FOUND: The authenticated account no longer exists' });
    }

    req.user = user;
    next();
  } catch (err: any) {
    return res.status(500).json({ error: 'Auth database error: ' + err.message });
  }
}

export async function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);
    if (payload) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: payload.userId },
          select: { id: true, email: true, role: true, name: true, badgeNumber: true },
        });
        if (user) req.user = user;
      } catch {}
    }
  }
  next();
}
