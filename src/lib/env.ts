export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  supabaseUrl: () => requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
  serviceRoleKey: () => requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  openRouterKey: () => requireEnv("OPENROUTER_API_KEY"),
  falKey: () => requireEnv("FAL_API_KEY"),
};
