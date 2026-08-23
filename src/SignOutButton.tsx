"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { Icon } from "./components/ui";

export function SignOutButton() {
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();

  if (!isAuthenticated) {
    return null;
  }

  return (
    <button
      className="sign-out-button"
      onClick={() => void signOut()}
    >
      <Icon name="logout" className="h-4 w-4" />
      <span>Sign out</span>
    </button>
  );
}
