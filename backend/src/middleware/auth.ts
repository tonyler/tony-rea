import { Request, Response, NextFunction } from 'express';
import { getSession } from '../services/session';
import { isUserWhitelisted } from '../services/whitelist';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    avatar: string | null;
  };
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const sessionId = req.cookies?.session;

    if (!sessionId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const session = await getSession(sessionId);

    if (!session) {
      res.clearCookie('session');
      res.status(401).json({ error: 'Session expired' });
      return;
    }

    // Re-check whitelist
    if (!isUserWhitelisted(session.discordId)) {
      res.clearCookie('session');
      res.status(403).json({ error: 'User no longer authorized' });
      return;
    }

    // Attach user to request
    req.user = {
      id: session.discordId,
      username: session.username,
      avatar: session.avatar,
    };

    next();
  } catch (error) {
    next(error);
  }
}
