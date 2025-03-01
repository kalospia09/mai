import { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface Request {
      user?: SelectUser;
    }
  }
}

export async function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.sendStatus(401);
  }

  try {
    const user = await storage.getUserByToken(token);
    if (!user) {
      return res.sendStatus(401);
    }
    req.user = user;
    next();
  } catch (err) {
    return res.sendStatus(403);
  }
}

export function setupAuth(app: Express) {
  app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;
    console.log('Login attempt:', username);

    if (username !== 'user1' && username !== 'user2') {
      console.log('Invalid user:', username);
      return res.status(401).json({ message: "Invalid user" });
    }

    const userId = username === 'user1' ? 1 : 2;
    const user = await storage.getUser(userId);

    if (!user) {
      console.log('User not found:', userId);
      return res.status(401).json({ message: "User not found" });
    }

    if (password !== user.password) {
      console.log('Invalid password for user:', userId);
      return res.status(401).json({ message: "Invalid password" });
    }

    const token = await storage.generateUserToken(user.id);
    console.log('Login successful for user:', userId);

    res.json({
      user,
      token
    });
  });

  app.post("/api/logout", authenticateToken, async (req, res) => {
    if (req.user) {
      await storage.updateUserStatus(req.user.id, false);
      await storage.updateLastSeen(req.user.id);
      // Clear the token by generating a new one
      await storage.generateUserToken(req.user.id);
    }
    res.sendStatus(200);
  });

  app.get("/api/user", authenticateToken, (req, res) => {
    res.json(req.user);
  });
}