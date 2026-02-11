import { NextResponse } from 'next/server';
import { issueOauthState } from '@/lib/auth/oauth-state';
import { secondMeSdk } from '@/lib/secondme/sdk';

const defaultScopes = ['user.info', 'chat'];

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const returnTo = url.searchParams.get('return_to');
  const state = await issueOauthState(returnTo);
  const authorizeUrl = secondMeSdk.buildAuthorizeUrl(state, defaultScopes);
  return NextResponse.redirect(authorizeUrl);
}
