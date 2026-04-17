import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import AdminShell from "@/components/AdminShell";
import LoginPage from "@/components/LoginPage";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <LoginPage />;
  }

  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-neutral-50 text-neutral-500">Loading...</div>}>
      <AdminShell userId={user.id} userEmail={user.email ?? ""} />
    </Suspense>
  );
}
