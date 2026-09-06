import type { CookieOptions, Request, Response } from "express";
import config from "../../config";
import { AppError } from "../../errors";
import { sendSuccess } from "../../utils";
import { validateBody } from "../../utils/validate";
import {
  googleLoginUser,
  loginUser,
  logoutUser,
  refreshCookieMaxAge,
  refreshUserSession,
  registerUser,
} from "./auth.service";
import {
  googleSchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
} from "./auth.validation";

const REFRESH_COOKIE = "refreshToken";
const REFRESH_COOKIE_PATH = "/api/v1/auth";

const refreshCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: config.isProduction,
  sameSite: "lax",
  path: REFRESH_COOKIE_PATH,
  maxAge: refreshCookieMaxAge(),
});

const setRefreshCookie = (res: Response, token: string): void => {
  res.cookie(REFRESH_COOKIE, token, refreshCookieOptions());
};

const clearRefreshCookie = (res: Response): void => {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: "lax",
    path: REFRESH_COOKIE_PATH,
  });
};

const getRefreshToken = (req: Request): string | undefined => {
  const fromCookie = req.cookies?.[REFRESH_COOKIE];
  if (typeof fromCookie === "string" && fromCookie.length > 0) {
    return fromCookie;
  }
  const { refreshToken } = validateBody(refreshTokenSchema, req.body ?? {});
  return refreshToken;
};

export const register = async (req: Request, res: Response): Promise<void> => {
  const input = validateBody(registerSchema, req.body ?? {});
  const { user, tokens } = await registerUser(input);
  setRefreshCookie(res, tokens.refreshToken);
  sendSuccess(
    res,
    {
      message: "Account created successfully",
      data: { user, ...tokens },
    },
    201,
  );
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const input = validateBody(loginSchema, req.body ?? {});
  const { user, tokens } = await loginUser(input);
  setRefreshCookie(res, tokens.refreshToken);
  sendSuccess(res, {
    message: "Logged in successfully",
    data: { user, ...tokens },
  });
};

export const refresh = async (req: Request, res: Response): Promise<void> => {
  const token = getRefreshToken(req);
  if (!token) {
    throw new AppError("Refresh token is required", 401);
  }
  const { user, tokens } = await refreshUserSession(token);
  setRefreshCookie(res, tokens.refreshToken);
  sendSuccess(res, {
    message: "Tokens refreshed successfully",
    data: { user, ...tokens },
  });
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  const token = getRefreshToken(req);
  await logoutUser(token);
  clearRefreshCookie(res);
  sendSuccess(res, { message: "Logged out successfully", data: null });
};

export const google = async (req: Request, res: Response): Promise<void> => {
  const input = validateBody(googleSchema, req.body ?? {});
  const { user, tokens } = await googleLoginUser(input.idToken);
  setRefreshCookie(res, tokens.refreshToken);
  sendSuccess(res, {
    message: "Google login successful",
    data: { user, ...tokens },
  });
};

export const me = async (req: Request, res: Response): Promise<void> => {
  sendSuccess(res, { message: "Profile fetched successfully", data: req.user });
};
