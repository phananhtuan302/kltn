import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import mongoose, { Schema, Document } from "mongoose";

import { connectMongoDB, getMongoose } from "../config/database.js";
import { env } from "../config/env.js";

export interface UserRow {
  nguoi_dung_id: number;
  ten_dang_nhap: string;
  email: string;
  mat_khau_bam: string;
  ho_ten: string;
  vai_tro: string;
  trang_thai: string;
}

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: string;
}

export interface AuthResult {
  user: AuthUser;
  token: string;
}

interface SessionRow {
  token: string;
  userId: number;
  role: string;
  isActive: boolean;
  expiresAt: Date;
  lastUsedAt: Date;
}

interface RegisterPreferences {
  favoriteCategories?: string[];
  budgetPerTrip?: number | null;
  foodPreferences?: string;
  tripStyle?: string;
}

// MongoDB User Schema
const userSchema = new Schema<UserRow & Document>(
  {
    nguoi_dung_id: { type: Number, required: true, unique: true, index: true },
    ten_dang_nhap: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, index: true },
    mat_khau_bam: { type: String, required: true },
    ho_ten: String,
    vai_tro: { type: String, default: "user" },
    trang_thai: { type: String, default: "active" }
  },
  { collection: "nguoidung" }
);

const sessionSchema = new Schema<SessionRow & Document>(
  {
    token: { type: String, required: true, unique: true, index: true },
    userId: { type: Number, required: true, index: true },
    role: { type: String, required: true },
    isActive: { type: Boolean, default: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
    lastUsedAt: { type: Date, required: true }
  },
  { collection: "phien_dang_nhap" }
);

let UserModel: mongoose.Model<UserRow & Document> | null = null;
let SessionModel: mongoose.Model<SessionRow & Document> | null = null;

async function getUserModel() {
  if (!UserModel) {
    await connectMongoDB();
    const db = getMongoose();
    UserModel = db.model<UserRow & Document>("NguoiDung", userSchema, "nguoidung");
  }
  return UserModel;
}

async function getSessionModel() {
  if (!SessionModel) {
    await connectMongoDB();
    const db = getMongoose();
    SessionModel = db.model<SessionRow & Document>("PhienDangNhap", sessionSchema, "phien_dang_nhap");
  }
  return SessionModel;
}

function parseExpiryToMs(raw: string): number {
  const trimmed = raw.trim().toLowerCase();
  const match = trimmed.match(/^(\d+)([smhd])$/);
  if (!match) {
    return 7 * 24 * 60 * 60 * 1000;
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const factor = unit === "s" ? 1000 : unit === "m" ? 60_000 : unit === "h" ? 3_600_000 : 86_400_000;
  return amount * factor;
}

export class AuthService {
  async register(data: {
    username: string;
    email: string;
    password: string;
    fullName: string;
    preferences?: RegisterPreferences;
  }): Promise<AuthResult> {
    const hashedPassword = await bcrypt.hash(data.password, 12);

    try {
      const User = await getUserModel();

      // Check if user already exists
      const existing = await User.findOne({
        $or: [{ ten_dang_nhap: data.username }, { email: data.email }]
      });

      if (existing) {
        throw new Error("Tên đăng nhập hoặc email đã tồn tại.");
      }

      // Get next user ID
      const lastUser = await User.findOne().sort({ nguoi_dung_id: -1 });
      const nextId = (lastUser?.nguoi_dung_id || 0) + 1;

      // Create new user
      const newUser = new User({
        nguoi_dung_id: nextId,
        ten_dang_nhap: data.username,
        email: data.email,
        mat_khau_bam: hashedPassword,
        ho_ten: data.fullName,
        vai_tro: "user",
        trang_thai: "active"
      });

      const saved = await newUser.save();
      
      // Convert MongoDB doc to UserRow
      const userRow: UserRow = {
        nguoi_dung_id: saved.nguoi_dung_id,
        ten_dang_nhap: saved.ten_dang_nhap,
        email: saved.email,
        mat_khau_bam: saved.mat_khau_bam,
        ho_ten: saved.ho_ten || "",
        vai_tro: saved.vai_tro,
        trang_thai: saved.trang_thai
      };

      return this.buildResult(userRow);
    } catch (error) {
      throw error;
    }
  }

  async login(data: {
    username: string;
    password: string;
  }): Promise<AuthResult> {
    const user = await this.findByUsername(data.username);

    if (!user) {
      throw new Error("Tên đăng nhập hoặc mật khẩu không đúng.");
    }

    if (user.trang_thai !== "active") {
      throw new Error("Tài khoản bị tạm khóa. Vui lòng liên hệ quản trị.");
    }

    const valid = await bcrypt.compare(data.password, user.mat_khau_bam);
    if (!valid) {
      throw new Error("Tên đăng nhập hoặc mật khẩu không đúng.");
    }

    return this.buildResult(user);
  }

  async getUserById(id: number): Promise<AuthUser | null> {
    const user = await this.findByUserId(id);
    return user ? this.toAuthUser(user) : null;
  }

  async getUserBySessionToken(token: string): Promise<AuthUser | null> {
    try {
      const Session = await getSessionModel();
      const now = new Date();
      const session = await Session.findOne({
        token,
        isActive: true,
        expiresAt: { $gt: now }
      }).lean();

      if (!session) {
        return null;
      }

      await Session.updateOne({ token: session.token }, { $set: { lastUsedAt: now } });

      const user = await this.findByUserId(session.userId);
      return user ? this.toAuthUser(user) : null;
    } catch {
      return null;
    }
  }

  private async findByUsername(username: string): Promise<UserRow | null> {
    try {
      const User = await getUserModel();
      const doc = await User.findOne({
        $or: [{ ten_dang_nhap: username }, { email: username }]
      }).lean();

      if (!doc) return null;

      return {
        nguoi_dung_id: doc.nguoi_dung_id,
        ten_dang_nhap: doc.ten_dang_nhap,
        email: doc.email,
        mat_khau_bam: doc.mat_khau_bam,
        ho_ten: doc.ho_ten || "",
        vai_tro: doc.vai_tro,
        trang_thai: doc.trang_thai
      };
    } catch {
      return null;
    }
  }

  private async findByUserId(id: number): Promise<UserRow | null> {
    try {
      const User = await getUserModel();
      const doc = await User.findOne({ nguoi_dung_id: id }).lean();

      if (!doc) return null;

      return {
        nguoi_dung_id: doc.nguoi_dung_id,
        ten_dang_nhap: doc.ten_dang_nhap,
        email: doc.email,
        mat_khau_bam: doc.mat_khau_bam,
        ho_ten: doc.ho_ten || "",
        vai_tro: doc.vai_tro,
        trang_thai: doc.trang_thai
      };
    } catch {
      return null;
    }
  }

  private async buildResult(user: UserRow): Promise<AuthResult> {
    const authUser = this.toAuthUser(user);
    const Session = await getSessionModel();
    const now = new Date();
    const token = randomBytes(48).toString("hex");
    const expiresAt = new Date(now.getTime() + parseExpiryToMs(env.jwtExpiresIn));

    await Session.create({
      token,
      userId: authUser.id,
      role: authUser.role,
      isActive: true,
      expiresAt,
      lastUsedAt: now
    });

    return { user: authUser, token };
  }

  private toAuthUser(row: UserRow): AuthUser {
    return {
      id: row.nguoi_dung_id,
      username: row.ten_dang_nhap,
      email: row.email,
      fullName: row.ho_ten,
      role: row.vai_tro
    };
  }
}

export const authService = new AuthService();
