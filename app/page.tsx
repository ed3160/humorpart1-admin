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

  return <AdminShell userId={user.id} userEmail={user.email ?? ""} />;
}
