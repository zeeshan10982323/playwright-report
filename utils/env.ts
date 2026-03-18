export function requiredEnv(name: 'BASE_URL' | 'LOGIN_EMAIL' | 'LOGIN_PASSWORD'): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export function getBaseOrigin(): string {
  const u = requiredEnv('BASE_URL');
  try {
    return new URL(u).origin;
  } catch {
    return u.replace(/\/$/, '');
  }
}
