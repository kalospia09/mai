import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

export function setupAuth(app: Express) {
  // Initialize passport after session
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(new LocalStrategy(async (username, password, done) => {
    try {
      console.log('Login attempt:', username);
      if (username !== 'user1' && username !== 'user2') {
        console.log('Invalid user:', username);
        return done(null, false, { message: "Invalid user" });
      }

      const userId = username === 'user1' ? 1 : 2;
      const user = await storage.getUser(userId);

      if (!user) {
        console.log('User not found:', userId);
        return done(null, false, { message: "User not found" });
      }

      // For this demo, we'll use a simple password check
      if (password !== user.password) {
        console.log('Invalid password for user:', userId);
        return done(null, false, { message: "Invalid password" });
      }

      console.log('Login successful for user:', userId);
      return done(null, user);
    } catch (err) {
      console.error('Login error:', err);
      return done(err);
    }
  }));

  passport.serializeUser((user, done) => {
    console.log('Serializing user:', user.id);
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      console.log('Deserializing user:', id);
      const user = await storage.getUser(id);
      if (!user) {
        console.log('User not found during deserialization:', id);
        return done(null, false);
      }
      console.log('Deserialization successful for user:', id);
      done(null, user);
    } catch (err) {
      console.error('Deserialization error:', err);
      done(err);
    }
  });

  app.post("/api/login", (req, res, next) => {
    console.log('Login request:', req.body);
    passport.authenticate("local", (err, user, info) => {
      if (err) {
        console.error('Authentication error:', err);
        return next(err);
      }
      if (!user) {
        console.log('Authentication failed:', info?.message);
        return res.status(401).json({ message: info?.message || "Authentication failed" });
      }
      req.logIn(user, (err) => {
        if (err) {
          console.error('Login error:', err);
          return next(err);
        }
        console.log('Login successful, session ID:', req.session?.id);
        return res.status(200).json(user);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    console.log('Logout request for user:', req.user?.id);
    if (req.user) {
      const userId = (req.user as SelectUser).id;
      storage.updateUserStatus(userId, false);
      storage.updateLastSeen(userId);
    }
    req.logout((err) => {
      if (err) {
        console.error('Logout error:', err);
        return next(err);
      }
      console.log('Logout successful');
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    console.log('User request - Session ID:', req.session?.id);
    console.log('User request - Authenticated:', req.isAuthenticated());
    console.log('User request - User:', req.user);

    if (!req.isAuthenticated()) {
      console.log('User request - Not authenticated');
      return res.sendStatus(401);
    }
    console.log('User request - Sending user data:', req.user);
    res.json(req.user);
  });
}