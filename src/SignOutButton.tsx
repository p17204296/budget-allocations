"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { Icon } from "./components/ui";

import { useNavigationGuard } from "./hooks/NavigationGuard";

export function SignOutButton() {
  const { isAuthenticated } = useConvexAuth();
  const { navigate, busy } = useNavigationGuard();
  const { signOut } = useAuthActions();

  if (!isAuthenticated) {
    return null;
  }

  return (
    <button
      className="sign-out-button"
      aria-label="Sign out"
      disabled={busy}
      onClick={() => void navigate(() => signOut())}
    >
      <Icon name="logout" className="h-4 w-4" />
      <span>Sign out</span>
    </button>
  );
}
