import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 BETTER AUTH GITHUB DEBUG:');
    console.log('  📋 GitHub Client ID:', process.env.GITHUB_CLIENT_ID);
    console.log('  🔑 GitHub Client Secret exists:', !!process.env.GITHUB_CLIENT_SECRET);
    console.log('  🎯 Expected scopes: repo, user:email, read:user');

    // Test the Better Auth OAuth URL generation
    const testUrl = `${request.nextUrl.origin}/api/auth/sign-in/social?provider=github`;
    
    console.log('  🔗 Better Auth GitHub OAuth URL:', testUrl);

    // Manual GitHub OAuth URL for comparison
    const manualUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(`${request.nextUrl.origin}/api/auth/callback/github`)}&scope=${encodeURIComponent("repo user:email read:user")}&state=manual-test`;

    return Response.json({
      status: "Better Auth GitHub Debug",
      config: {
        clientId: process.env.GITHUB_CLIENT_ID,
        hasClientSecret: !!process.env.GITHUB_CLIENT_SECRET,
        callbackUrl: `${request.nextUrl.origin}/api/auth/callback/github`,
        expectedScopes: ["repo", "user:email", "read:user"]
      },
      urls: {
        betterAuthUrl: testUrl,
        manualTestUrl: manualUrl
      },
      instructions: [
        "1. Use Better Auth URL for actual sign-in",
        "2. Compare with manual URL if issues occur",
        "3. Watch console logs during OAuth flow",
        "4. Verify GitHub asks for repository permissions"
      ]
    });

  } catch (error: any) {
    console.error('❌ Better Auth debug error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
