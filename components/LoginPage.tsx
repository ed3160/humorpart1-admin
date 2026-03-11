"use client";

import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const handleLogin = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-sm w-full text-center">
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">
          Crackd Admin
        </h1>
        <p className="text-neutral-500 mb-6">Sign in to access the admin panel</p>
        <button
          onClick={handleLogin}
          className="w-full bg-neutral-900 text-white rounded-lg px-4 py-2.5 font-medium hover:bg-neutral-800 transition-colors cursor-pointer"
        >
          Sign in with Google
        </button>
      </div>
    </div>
  );
}
