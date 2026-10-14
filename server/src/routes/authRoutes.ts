import { Router, Request, Response } from 'express';
import { prisma } from '../services/db';
import { hashPassword, verifyPassword, generateToken } from '../utils/auth';
import { authenticate, AuthenticatedRequest } from '../middleware/authMiddleware';

const router = Router();

// Ensure initial accounts exist
async function ensureSeedUsers() {
  try {
    const count = await prisma.user.count();
    if (count === 0) {
      // Create Officer Account
      await prisma.user.create({
        data: {
          email: 'officer@aegis.maritime',
          name: 'Cmdr. Vikram Sharma',
          badgeNumber: 'IN-CG-8821',
          passwordHash: hashPassword('aegis-officer-2026'),
          role: 'OFFICER',
        },
      });

      // Create Standard Investigator / User Account
      await prisma.user.create({
        data: {
          email: 'investigator@aegis.maritime',
          name: 'Dr. Ananya Roy',
          badgeNumber: 'MAR-ENV-409',
          passwordHash: hashPassword('aegis-user-2026'),
          role: 'USER',
        },
      });
      console.log('[AEGIS Auth] Seeded default Officer & User accounts');
    }
  } catch (err) {
    console.error('[AEGIS Auth] Failed to check/seed users:', err);
  }
}

// Run initial check
ensureSeedUsers();

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (!user) {
      return res.status(401).json({ error: 'INVALID CREDENTIALS: No account matches this identifier' });
    }

    const match = verifyPassword(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ error: 'INVALID CREDENTIALS: Password verification failed' });
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role as 'USER' | 'OFFICER',
      name: user.name,
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        badgeNumber: user.badgeNumber,
        role: user.role,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name, badgeNumber, role } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and full name are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (existing) {
      return res.status(409).json({ error: 'ACCOUNT EXISTS: An officer or user with this email is already registered' });
    }

    const assignedRole = role === 'OFFICER' ? 'OFFICER' : 'USER';
    const user = await prisma.user.create({
      data: {
        email: cleanEmail,
        name: name.trim(),
        badgeNumber: badgeNumber ? badgeNumber.trim() : null,
        passwordHash: hashPassword(password),
        role: assignedRole,
      },
    });

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role as 'USER' | 'OFFICER',
      name: user.name,
    });

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        badgeNumber: user.badgeNumber,
        role: user.role,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  res.json({ user: req.user });
});

export default router;
