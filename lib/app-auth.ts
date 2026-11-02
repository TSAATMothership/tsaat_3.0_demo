import "server-only";

import {
  authenticateLoginDetailsUser,
  changeLoginDetailsPassword,
  loadActiveLoginDetailsSession,
  type AuthenticatedLoginDetailsUser
} from "@/lib/login-details";

export type AuthenticatedAppUser = AuthenticatedLoginDetailsUser;

export async function authenticateAppUser(
  usernameInput: string,
  password: string
): Promise<AuthenticatedAppUser | null> {
  return authenticateLoginDetailsUser(usernameInput, password);
}

export async function loadActiveUserSession(usernameInput: string): Promise<AuthenticatedAppUser | null> {
  return loadActiveLoginDetailsSession(usernameInput);
}

export async function changeAppUserPassword(
  usernameInput: string,
  currentPasswordInput: string,
  newPasswordInput: string
): Promise<AuthenticatedAppUser | null> {
  return changeLoginDetailsPassword(usernameInput, currentPasswordInput, newPasswordInput);
}
