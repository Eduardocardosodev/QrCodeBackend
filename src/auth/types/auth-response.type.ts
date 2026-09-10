export type AuthUserResponse = {
  id: string;
  email: string;
  createdAt: Date;
};

export type AuthTokensResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
};

export type AuthResponse = AuthTokensResponse & {
  user: AuthUserResponse;
};
