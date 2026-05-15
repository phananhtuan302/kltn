import { Request, Response, NextFunction } from "express";
import { authService } from "../services/auth-service.js";

export interface JwtPayload {
  id: number;
  role: string;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: JwtPayload;
  }
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ message: "Chưa đăng nhập." });
    return;
  }

  const token = header.slice(7);
  void (async () => {
    const user = await authService.getUserBySessionToken(token);
    if (!user) {
      res.status(401).json({ message: "Token không hợp lệ hoặc đã hết hạn." });
      return;
    }

    req.user = { id: user.id, role: user.role };
    next();
  })();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ message: "Không có quyền truy cập." });
      return;
    }
    next();
  };
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    next();
    return;
  }

  const token = header.slice(7);
  void (async () => {
    const user = await authService.getUserBySessionToken(token);
    if (user) {
      req.user = { id: user.id, role: user.role };
    }
    next();
  })();
}
