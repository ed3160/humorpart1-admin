"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Dashboard from "./Dashboard";
import ProfilesTable from "./ProfilesTable";
import ImagesTable from "./ImagesTable";
import CaptionsTable from "./CaptionsTable";

type Section = "dashboard" | "profiles" | "images" | "captions";

const navItems: { key: Section; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "profiles", label: "Profiles" },
  { key: "images", label: "Images" },
  { key: "captions", label: "Captions" },
];

export default function AdminShell({
  userId,
  userEmail,
}: {
  userId: string;
  userEmail: string;
}) {
  const [isSuperadmin, setIsSuperadmin] = useState<boolean | null>(null);
  const [activeSection, setActiveSection] = useState<Section>("dashboard");

  useEffect(() => {
    const checkAdmin = async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("is_superadmin")
        .eq("id", userId)
        .single();

      const isDbSuperadmin = !error && data?.is_superadmin === true;
      const isAllowedEmail = userEmail.endsWith("@columbia.edu") || userEmail.endsWith("@barnard.edu");
      setIsSuperadmin(isDbSuperadmin || isAllowedEmail);
    };
    checkAdmin();
  }, [userId]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  if (isSuperadmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-neutral-500">Loading...</div>
      </div>
    );
  }

  if (!isSuperadmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-sm w-full text-center">
          <h1 className="text-xl font-bold text-neutral-900 mb-2">
            Access Denied
          </h1>
          <p className="text-neutral-500 mb-4">
            You do not have superadmin privileges.
          </p>
          <button
            onClick={handleLogout}
            className="text-sm text-neutral-500 hover:text-neutral-700 underline cursor-pointer"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-neutral-50">
      {/* Sidebar */}
      <aside className="w-56 bg-neutral-900 text-white flex flex-col shrink-0">
        <div className="p-4 border-b border-neutral-700">
          <h1 className="text-lg font-bold tracking-tight">Crackd Admin</h1>
        </div>

        <nav className="flex-1 p-2">
          {navItems.map((item) => (
            <button
              key={item.key}
              onClick={() => setActiveSection(item.key)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                activeSection === item.key
                  ? "bg-neutral-700 text-white"
                  : "text-neutral-400 hover:text-white hover:bg-neutral-800"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-neutral-700">
          <div className="text-xs text-neutral-400 truncate mb-2">
            {userEmail}
          </div>
          <button
            onClick={handleLogout}
            className="text-xs text-neutral-500 hover:text-white transition-colors cursor-pointer"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6 overflow-auto">
        {activeSection === "dashboard" && <Dashboard />}
        {activeSection === "profiles" && <ProfilesTable />}
        {activeSection === "images" && <ImagesTable />}
        {activeSection === "captions" && <CaptionsTable />}
      </main>
    </div>
  );
}
