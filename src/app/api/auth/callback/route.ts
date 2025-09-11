import { NextRequest } from "next/server";
import { pgDb } from "lib/db/pg/db.pg";
import { UserSchema, AccountSchema } from "lib/db/pg/schema.pg";
import { eq } from "drizzle-orm";

/**
 * Custom GitHub OAuth callback handler
 * Handles the GitHub OAuth response and creates/updates user accounts
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  console.log('🔄 GITHUB OAUTH CALLBACK: Processing GitHub response');
  console.log('  📨 Code received:', !!code);
  console.log('  🔐 State:', state);
  console.log('  ❌ Error:', error);

  if (error) {
    console.error('❌ GitHub OAuth error:', error);
    return Response.redirect(`${url.origin}/sign-in?error=github_oauth_failed`);
  }

  if (!code) {
    console.error('❌ No authorization code received');
    return Response.redirect(`${url.origin}/sign-in?error=no_code`);
  }

  try {
    // Exchange code for access token
    console.log('🔄 Exchanging code for access token...');
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      console.error('❌ Failed to exchange code for token:', tokenResponse.status);
      return Response.redirect(`${url.origin}/sign-in?error=token_exchange_failed`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const scope = tokenData.scope;

    console.log('✅ GITHUB TOKEN RECEIVED:');
    console.log('  🔑 Token received:', !!accessToken);
    console.log('  🎯 Scopes granted:', scope);
    console.log('  ✅ Has repo scope:', scope?.includes('repo') || false);

    if (!accessToken) {
      console.error('❌ No access token in response');
      return Response.redirect(`${url.origin}/sign-in?error=no_token`);
    }

    // Get user info from GitHub
    console.log('👤 Fetching user information from GitHub...');
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!userResponse.ok) {
      console.error('❌ Failed to fetch user info:', userResponse.status);
      return Response.redirect(`${url.origin}/sign-in?error=user_fetch_failed`);
    }

    const githubUser = await userResponse.json();
    console.log('👤 GitHub user info:');
    console.log('  🆔 ID:', githubUser.id);
    console.log('  👤 Login:', githubUser.login);
    console.log('  📧 Email:', githubUser.email);
    console.log('  🖼️ Avatar:', githubUser.avatar_url);

    // Get user's email if not public
    let email = githubUser.email;
    if (!email) {
      console.log('📧 Fetching user emails...');
      const emailResponse = await fetch('https://api.github.com/user/emails', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });

      if (emailResponse.ok) {
        const emails = await emailResponse.json();
        const primaryEmail = emails.find((e: any) => e.primary);
        email = primaryEmail?.email || emails[0]?.email;
        console.log('📧 Primary email found:', email);
      }
    }

    // Create or update user in database
    console.log('💾 Creating/updating user in database...');
    
    // Check if user exists by GitHub ID
    const existingAccounts = await pgDb
      .select()
      .from(AccountSchema)
      .where(eq(AccountSchema.accountId, githubUser.id.toString()));

    let userId: string;
    
    if (existingAccounts.length > 0) {
      // Update existing account
      userId = existingAccounts[0].userId;
      console.log('🔄 Updating existing account for user:', userId);
      
      await pgDb
        .update(AccountSchema)
        .set({
          accessToken,
          scope,
          updatedAt: new Date(),
        })
        .where(eq(AccountSchema.accountId, githubUser.id.toString()));
        
    } else {
      // Create new user and account
      console.log('🆕 Creating new user and account...');
      
      const [newUser] = await pgDb
        .insert(UserSchema)
        .values({
          name: githubUser.name || githubUser.login,
          email,
          emailVerified: true,
          image: githubUser.avatar_url,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      userId = newUser.id;
      
      await pgDb
        .insert(AccountSchema)
        .values({
          userId,
          accountId: githubUser.id.toString(),
          providerId: 'github',
          accessToken,
          scope,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
    }

    console.log('✅ GITHUB OAUTH SUCCESS:');
    console.log('  👤 User ID:', userId);
    console.log('  🔑 Token saved with scopes:', scope);
    console.log('  ✅ Repository access:', scope?.includes('repo') ? 'GRANTED' : 'DENIED');

    // Redirect to home page
    return Response.redirect(`${url.origin}/?github_login=success`);

  } catch (error: any) {
    console.error('❌ GitHub OAuth callback error:', error);
    return Response.redirect(`${url.origin}/sign-in?error=callback_failed`);
  }
}
