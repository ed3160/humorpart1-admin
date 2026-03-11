"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Dashboard from "./Dashboard";
import ProfilesTable from "./ProfilesTable";
import ImagesTable from "./ImagesTable";
import CaptionsTable from "./CaptionsTable";

type Section = "dashboard" | "profiles" | "images" | "captions";

export interface NavFilter {
  field: string;
  value: string;
}

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
  const [filter, setFilter] = useState<NavFilter | null>(null);

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
  }, [userId, userEmail]);

  const navigateTo = useCallback((section: Section, navFilter?: NavFilter) => {
    setActiveSection(section);
    setFilter(navFilter ?? null);
  }, []);

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
    const supabaseLink = `https://supabase.com/dashboard/project/qihsgnfjqmkjmoowyfbn/editor/35885?schema=public&sort=is_superadmin%3Aasc&filter=email%3Aeq%3A${encodeURIComponent(userEmail)}`;
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <h1 className="text-xl font-bold text-neutral-900 mb-2">Access Denied</h1>
          <p className="text-neutral-600 text-sm mb-4">
            Your account ({userEmail}) does not have superadmin privileges.
          </p>
          <p className="text-neutral-500 text-xs mb-4">
            To get access, set <code className="bg-neutral-100 px-1 py-0.5 rounded text-xs">is_superadmin = true</code> for your profile in the Supabase dashboard:
          </p>
          <a
            href={supabaseLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-neutral-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-neutral-800 transition-colors mb-4"
          >
            Open in Supabase
          </a>
          <div>
            <button onClick={handleLogout} className="text-sm text-neutral-500 hover:text-neutral-700 underline cursor-pointer">
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-neutral-50">
      <aside className="w-56 bg-neutral-900 text-white flex flex-col shrink-0">
        <div className="p-4 border-b border-neutral-700">
          <h1 className="text-lg font-bold tracking-tight">Crackd Admin</h1>
        </div>
        <nav className="flex-1 p-2">
          {navItems.map((item) => (
            <button
              key={item.key}
              onClick={() => navigateTo(item.key)}
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
          <div className="text-xs text-neutral-400 truncate mb-2">{userEmail}</div>
          <button onClick={handleLogout} className="text-xs text-neutral-500 hover:text-white transition-colors cursor-pointer">
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 p-6 overflow-auto">
        {activeSection === "dashboard" && <Dashboard navigateTo={navigateTo} />}
        {activeSection === "profiles" && <ProfilesTable navigateTo={navigateTo} filter={filter} />}
        {activeSection === "images" && <ImagesTable navigateTo={navigateTo} filter={filter} />}
        {activeSection === "captions" && <CaptionsTable navigateTo={navigateTo} filter={filter} />}
      </main>
    </div>
  );
}
