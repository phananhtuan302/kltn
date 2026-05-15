import { Router } from "express";
import { z } from "zod";
import { authService } from "../services/auth-service.js";
import { requireAuth } from "../middleware/auth.js";

const registerSchema = z.object({
  username: z.string().min(3).max(100),
  email: z.string().email(),
  password: z
    .string()
    .min(6, "Mật khẩu tối thiểu 6 ký tự")
    .max(128),
  fullName: z.string().min(1).max(255),
  preferences: z
    .object({
      favoriteCategories: z.array(z.string().min(1)).max(10).optional(),
      budgetPerTrip: z.number().positive().max(50000000).nullable().optional(),
      foodPreferences: z.string().max(255).optional(),
      tripStyle: z.string().max(255).optional()
    })
    .optional()
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      message: "Thông tin không hợp lệ.",
      errors: parsed.error.flatten().fieldErrors
    });
    return;
  }

  try {
    const result = await authService.register(parsed.data);
    res.status(201).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Đăng ký thất bại.";
    res.status(409).json({ message });
  }
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Thiếu thông tin đăng nhập." });
    return;
  }

  try {
    const result = await authService.login(parsed.data);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Đăng nhập thất bại.";
    res.status(401).json({ message });
  }
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await authService.getUserById(req.user!.id);
  if (!user) {
    res.status(404).json({ message: "Không tìm thấy người dùng." });
    return;
  }
  res.json(user);
});
