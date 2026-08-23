import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Toaster } from "sonner";
import { BudgetPlanner } from "./components/BudgetPlanner";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-neutral-50">
      <header className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm h-16 flex justify-between items-center border-b border-slate-200 shadow-sm px-6">
        <h2 className="text-xl font-semibold text-slate-800">Financial Planning Workspace</h2>
        <Authenticated>
          <SignOutButton />
        </Authenticated>
      </header>
      <main className="flex-1 p-6">
        <Content />
      </main>
      <Toaster 
        position="top-right"
        toastOptions={{
          style: {
            background: 'white',
            border: '1px solid #e2e8f0',
            color: '#1e293b',
          },
        }}
      />
    </div>
  );
}

function Content() {
  const loggedInUser = useQuery(api.auth.loggedInUser);

  if (loggedInUser === undefined) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <Authenticated>
        <BudgetPlanner />
      </Authenticated>
      <Unauthenticated>
        <div className="flex flex-col items-center justify-center min-h-[500px] gap-12">
          <div className="text-center max-w-2xl">
            <h1 className="text-4xl font-bold text-slate-800 mb-6">Financial Planning Workspace</h1>
            <p className="text-xl text-slate-600 leading-relaxed">
              Professional budget allocation and financial planning tools designed for clarity and control over your finances.
            </p>
          </div>
          <div className="w-full max-w-md">
            <SignInForm />
          </div>
        </div>
      </Unauthenticated>
    </div>
  );
}
