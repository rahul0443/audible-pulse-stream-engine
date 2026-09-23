import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    subscriptionTier: string;
  };
}

export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    // For demo/dev mode, allow fallback header or default test user
    const devUserId = req.header('x-user-id');
    if (devUserId) {
      req.user = {
        id: devUserId,
        email: 'dev@audible.com',
        subscriptionTier: 'PREMIUM',
      };
      return next();
    }

    return res.status(401).json({ error: 'Unauthorized', message: 'Missing Authorization Bearer token' });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as any;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Forbidden', message: 'Invalid or expired JWT token' });
  }
};
