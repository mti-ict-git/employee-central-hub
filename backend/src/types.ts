export type AppRole =
  | "superadmin"
  | "admin"
  | "hr_general"
  | "finance"
  | "department_rep";

export interface AuthSuccess {
  token: string;
  user: {
    dn: string;
    username: string;
    displayName?: string;
    email?: string;
    roles: AppRole[];
    provider: "ad";
  };
}

export interface AuthError {
  error: string;
}