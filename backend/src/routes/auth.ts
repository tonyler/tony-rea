import { Router } from 'express';
import { createSession, getSession, deleteSession } from '../services/session';
import { isUserWhitelisted } from '../services/whitelist';
import { env } from '../config/env';

interface DiscordTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

interface DiscordUser {
  id: string;
  username: string;
  avatar: string | null;
  discriminator: string;
}

const router = Router();

const DISCORD_API = 'https://discord.com/api/v10';
const DISCORD_CDN = 'https://cdn.discordapp.com';

function getRedirectUri(): string {
  return env.DISCORD_REDIRECT_URI;
}

function getOAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: 'identify',
  });

  return `https://discord.com/oauth2/authorize?${params}`;
}

// GET /api/auth/login - Redirect to Discord OAuth
router.get('/login', (req, res) => {
  res.redirect(getOAuthUrl());
});

// GET /api/auth/callback - Handle Discord OAuth callback
router.get('/callback', async (req, res, next) => {
  try {
    const { code } = req.query;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Missing authorization code' });
    }

    // Exchange code for tokens
    const tokenResponse = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        client_secret: env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: getRedirectUri(),
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('Token exchange failed:', error);
      return res.status(401).json({ error: 'Failed to authenticate with Discord' });
    }

    const tokens = await tokenResponse.json() as DiscordTokenResponse;

    // Get user info
    const userResponse = await fetch(`${DISCORD_API}/users/@me`, {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    if (!userResponse.ok) {
      return res.status(401).json({ error: 'Failed to get user info' });
    }

    const user = await userResponse.json() as DiscordUser;

    // Check whitelist
    if (!isUserWhitelisted(user.id)) {
      return res.status(403).json({ error: 'User not authorized' });
    }

    // Create session
    const session = await createSession({
      discordId: user.id,
      username: user.username,
      avatar: user.avatar
        ? `${DISCORD_CDN}/avatars/${user.id}/${user.avatar}.png`
        : null,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
    });

    // Set session cookie
    res.cookie('session', session.id, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    // Redirect to app
    const baseUrl = env.NODE_ENV === 'production' ? '/rea/' : '/';
    res.redirect(baseUrl);
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/logout - Clear session
router.post('/logout', async (req, res, next) => {
  try {
    const sessionId = req.cookies?.session;

    if (sessionId) {
      await deleteSession(sessionId);
    }

    res.clearCookie('session');
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/me - Get current user
router.get('/me', async (req, res, next) => {
  try {
    const sessionId = req.cookies?.session;

    if (!sessionId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const session = await getSession(sessionId);

    if (!session) {
      res.clearCookie('session');
      return res.status(401).json({ error: 'Session expired' });
    }

    // Re-check whitelist (in case user was removed)
    if (!isUserWhitelisted(session.discordId)) {
      await deleteSession(sessionId);
      res.clearCookie('session');
      return res.status(403).json({ error: 'User no longer authorized' });
    }

    res.json({
      user: {
        id: session.discordId,
        username: session.username,
        avatar: session.avatar,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
