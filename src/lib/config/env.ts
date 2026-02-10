const requiredEnvKeys = [
  'SECONDME_CLIENT_ID',
  'SECONDME_CLIENT_SECRET',
  'SECONDME_OAUTH_REDIRECT_URI',
  'SECONDME_OAUTH_URL',
  'SECONDME_API_BASE_URL',
  'SECONDME_TOKEN_CODE_ENDPOINT',
  'SECONDME_TOKEN_REFRESH_ENDPOINT',
  'APP_BASE_URL',
  'DATABASE_URL',
  'SESSION_SECRET'
] as const;

type RequiredEnvKey = (typeof requiredEnvKeys)[number];

function readEnv(key: RequiredEnvKey): string {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required env: ${key}`);
  }
  return value;
}

export const env = {
  secondmeClientId: readEnv('SECONDME_CLIENT_ID'),
  secondmeClientSecret: readEnv('SECONDME_CLIENT_SECRET'),
  secondmeOauthRedirectUri: readEnv('SECONDME_OAUTH_REDIRECT_URI'),
  secondmeOauthUrl: readEnv('SECONDME_OAUTH_URL'),
  secondmeApiBaseUrl: readEnv('SECONDME_API_BASE_URL'),
  secondmeTokenCodeEndpoint: readEnv('SECONDME_TOKEN_CODE_ENDPOINT'),
  secondmeTokenRefreshEndpoint: readEnv('SECONDME_TOKEN_REFRESH_ENDPOINT'),
  appBaseUrl: readEnv('APP_BASE_URL'),
  databaseUrl: readEnv('DATABASE_URL'),
  sessionSecret: readEnv('SESSION_SECRET')
};
