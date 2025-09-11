import { NextRequest, NextResponse } from "next/server";
import { getSession } from "auth/server";
import { pgDb } from "lib/db/pg/db.pg";
import { AccountSchema } from "lib/db/pg/schema.pg";
import { eq } from "drizzle-orm";

/**
 * Debug endpoint to check GitHub OAuth integration
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session?.user?.id) {
      return NextResponse.json({
        error: "Not authenticated",
        suggestion: "Please sign in first"
      }, { status: 401 });
    }

    console.log('🔍 OAUTH DEBUG: Checking GitHub integration for user:', session.user.id);

    const userInfo = {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image,
      isGitHubUser: session.user.image?.includes('avatars.githubusercontent.com')
    };

    const allAccounts = await pgDb
      .select()
      .from(AccountSchema)
      .where(eq(AccountSchema.userId, session.user.id));

    console.log('🔍 Found accounts in database:', allAccounts.length);

    const githubAccounts = allAccounts.filter(account => account.providerId === 'github');
    
    console.log('🔍 GitHub accounts found:', githubAccounts.length);

    if (githubAccounts.length === 0) {
      return NextResponse.json({
        status: "ERROR",
        issue: "No GitHub account found in database",
        userInfo,
        allAccounts: allAccounts.map(acc => ({
          providerId: acc.providerId,
          accountId: acc.accountId,
          hasAccessToken: !!acc.accessToken,
          scope: acc.scope,
          createdAt: acc.createdAt
        })),
        suggestions: [
          "User may have signed up with email/password instead of GitHub",
          "OAuth flow may have failed to save account",
          "Try signing out and signing in with GitHub again"
        ]
      });
    }

    const githubAccount = githubAccounts[0];
    
    const tokenInfo = {
      hasAccessToken: !!githubAccount.accessToken,
      tokenLength: githubAccount.accessToken?.length || 0,
      tokenPrefix: githubAccount.accessToken?.substring(0, 10) || 'none',
      scope: githubAccount.scope,
      expiresAt: githubAccount.accessTokenExpiresAt,
      isExpired: githubAccount.accessTokenExpiresAt ? 
        new Date() > githubAccount.accessTokenExpiresAt : false
    };

    console.log('🔑 Token info:', tokenInfo);

    let apiTest: any = null;
    if (githubAccount.accessToken) {
      try {
        console.log('🧪 Testing GitHub API access...');
        
        const userResponse = await fetch('https://api.github.com/user', {
          headers: {
            'Authorization': `Bearer ${githubAccount.accessToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Luminar-AI-DiffDB/1.0'
          }
        });

        if (userResponse.ok) {
          const userData = await userResponse.json();
          
          const repoTestResponse = await fetch('https://api.github.com/user/repos', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${githubAccount.accessToken}`,
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'Luminar-AI-DiffDB/1.0'
            }
          });

          apiTest = {
            userAccess: true,
            username: userData.login,
            scopes: userResponse.headers.get('x-oauth-scopes')?.split(', ') || [],
            repoAccess: repoTestResponse.ok,
            canCreateRepos: userData.permissions?.can_create_repositories || 
                           repoTestResponse.headers.get('x-oauth-scopes')?.includes('repo') || false
          };
        } else {
          apiTest = {
            userAccess: false,
            error: `HTTP ${userResponse.status}: ${await userResponse.text()}`,
            suggestion: 'Token may be expired or invalid'
          };
        }
      } catch (err: any) {
        apiTest = {
          userAccess: false,
          error: `Network error: ${err.message}`,
          suggestion: 'Check internet connection or GitHub API status'
        };
      }
    }

    const result = {
      status: githubAccount.accessToken ? "SUCCESS" : "TOKEN_MISSING",
      userInfo,
      githubAccount: {
        accountId: githubAccount.accountId,
        providerId: githubAccount.providerId,
        scope: githubAccount.scope,
        createdAt: githubAccount.createdAt,
        updatedAt: githubAccount.updatedAt
      },
      tokenInfo,
      apiTest,
      diffDBStatus: {
        enabled: process.env.DIFFDB_ENABLED === 'true',
        shouldWork: !!(githubAccount.accessToken && apiTest?.canCreateRepos),
        requirements: {
          accessToken: !!githubAccount.accessToken,
          repoScope: githubAccount.scope?.includes('repo') || false,
          apiAccess: apiTest?.userAccess || false
        }
      }
    };

    console.log('✅ OAuth debug complete:', result.status);
    
    return NextResponse.json(result);

  } catch (err: any) {
    console.error('❌ OAuth debug error:', err);
    return NextResponse.json({
      status: "ERROR",
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }, { status: 500 });
  }
}
