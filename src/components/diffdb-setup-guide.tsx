"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "ui/card";
import { Button } from "ui/button";
import { Badge } from "ui/badge";
import {
  CheckCircle2,
  Circle,
  GitBranch,
  Database,
  Shield,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { getSession } from "auth/client";

interface SetupStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  icon: React.ReactNode;
}

export function DiffDBSetupGuide() {
  const [steps, setSteps] = useState<SetupStep[]>([
    {
      id: "github-auth",
      title: "Sign in with GitHub",
      description: "Connect your GitHub account to enable DiffDB storage",
      completed: false,
      icon: <GitBranch className="w-5 h-5" />,
    },
    {
      id: "repo-creation",
      title: "Repository Creation",
      description:
        "We'll create a private 'luminar-ai-data' repository in your account",
      completed: false,
      icon: <Database className="w-5 h-5" />,
    },
    {
      id: "privacy-setup",
      title: "Privacy Configuration",
      description: "Your data stays in YOUR repository, under YOUR control",
      completed: false,
      icon: <Shield className="w-5 h-5" />,
    },
  ]);

  const [currentUser, setCurrentUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const session = await getSession();
      if (session?.user) {
        setCurrentUser(session.user);
        // Check if user has GitHub account connected
        const hasGitHub = session.user.accounts?.some(
          (account: any) => account.providerId === "github",
        );
        if (hasGitHub) {
          setSteps((prev) =>
            prev.map((step) =>
              step.id === "github-auth" ? { ...step, completed: true } : step,
            ),
          );
        }
      }
    } catch (error) {
      console.error("Failed to check auth status:", error);
    }
  };

  const handleGetStarted = () => {
    if (currentUser) {
      // User is already signed in, proceed to app
      router.push("/");
    } else {
      // Redirect to sign-in page
      router.push("/sign-in");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center mb-4">
            <GitBranch className="w-12 h-12 text-blue-600" />
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Welcome to DiffDB
          </CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            Your AI conversations, stored in YOUR GitHub repository
          </CardDescription>
          <Badge variant="secondary" className="mt-2 w-fit mx-auto">
            Bring Your Own GitHub (BYOG)
          </Badge>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
              🚀 What makes DiffDB special?
            </h3>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <li>• Your data stays in YOUR private GitHub repository</li>
              <li>• Full conversation history with Git version control</li>
              <li>• No vendor lock-in - export anytime</li>
              <li>• Transparent and human-readable storage</li>
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Setup Process</h3>
            {steps.map((step, _index) => (
              <div key={step.id} className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-1">
                  {step.completed ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  ) : (
                    <Circle className="w-5 h-5 text-gray-400" />
                  )}
                </div>
                <div className="flex-grow">
                  <div className="flex items-center space-x-2">
                    {step.icon}
                    <h4
                      className={`font-medium ${step.completed ? "text-green-800 dark:text-green-200" : "text-gray-900 dark:text-gray-100"}`}
                    >
                      {step.title}
                    </h4>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-4">
            <h4 className="font-medium text-amber-900 dark:text-amber-100 mb-2">
              ⚡ Quick Setup (&lt; 30 seconds)
            </h4>
            <p className="text-sm text-amber-800 dark:text-amber-200">
              1. Sign in with GitHub • 2. Authorize repository creation • 3.
              Start chatting!
            </p>
          </div>

          <div className="flex flex-col space-y-3">
            <Button onClick={handleGetStarted} size="lg" className="w-full">
              {currentUser ? "Continue to App" : "Get Started with GitHub"}
            </Button>

            {!currentUser && (
              <p className="text-xs text-center text-muted-foreground">
                By continuing, you agree to let Luminar-AI create a private
                repository in your GitHub account
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
