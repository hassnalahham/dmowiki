import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="grid flex-1 place-items-center px-4 py-16">
      <div className="card w-full max-w-sm p-6">
        <h1 className="text-xl font-bold">Dashboard sign in</h1>
        <p className="mb-5 mt-1 text-sm text-muted">Staff accounts only.</p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
