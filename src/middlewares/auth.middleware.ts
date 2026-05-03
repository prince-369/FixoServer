import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/generateToken';
import User from '../models/User';
import Worker from '../models/Worker';
import Admin from '../models/Admin';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: 'customer' | 'worker' | 'admin';
      };
    }
  }
}

export const protect = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let token: string | undefined;

    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      res.status(401).json({ message: 'Not authorized, no token' });
      return;
    }

    const decoded = verifyAccessToken(token);
    req.user = { id: decoded.id, role: decoded.role };
    next();
  } catch (error) {
    res.status(401).json({ message: 'Not authorized, token invalid' });
  }
};

export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ message: 'Not authorized for this action' });
      return;
    }
    next();
  };
};

export const verifyUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Not authorized' });
      return;
    }

    let userExists = false;
    switch (req.user.role) {
      case 'customer': {
        const customer = await User.findById(req.user.id).select('isActive');
        userExists = !!customer && customer.isActive !== false;
        break;
      }
      case 'worker':
        userExists = !!(await Worker.findById(req.user.id));
        break;
      case 'admin':
        userExists = !!(await Admin.findById(req.user.id));
        break;
    }

    if (!userExists) {
      res.status(401).json({ message: 'User no longer exists' });
      return;
    }

    next();
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};
