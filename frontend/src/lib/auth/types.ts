export interface AuthUser {
  id: string;
  email: string;
  fullName: string | null;
}

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; message: string };
