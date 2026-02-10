import { NextResponse } from 'next/server';
import { issueOauthState } from '@/lib/auth/oauth-state';
import { secondMeSdk } from '@/lib/secondme/sdk';

const defaultScopes = ['user.info', 'chat'];

export async function GET(): Promise<Response> {
  const state = await issueOauthState();
  const authorizeUrl = secondMeSdk.buildAuthorizeUrl(state, defaultScopes);
  return NextResponse.redirect(authorizeUrl);
}
