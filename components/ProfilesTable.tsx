"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface ProfileInfo {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  is_superadmin: boolean | null;
  is_matrix_admin: boolean | null;
  is_in_study: boolean | null;
  created_datetime_utc: string | null;
  image_count: number;
  caption_count: number;
  vote_count: number;
}

export default function ProfilesTable() {
  const [profiles, setProfiles] = useState<ProfileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"direct" | "derived">("direct");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const supabase = createClient();

      // First try reading profiles directly (works if RLS allows it)
      const { data: directProfiles, error } = await supabase
        .from("profiles")
        .select("id, email, first_name, last_name, is_superadmin, is_matrix_admin, is_in_study, created_datetime_utc")
        .order("created_datetime_utc", { ascending: false })
        .limit(500);

      if (!error && directProfiles && directProfiles.length > 1) {
        // RLS allows reading profiles - use them directly
        setMode("direct");
        setProfiles(directProfiles.map((p) => ({
          ...p,
          image_count: 0,
          caption_count: 0,
          vote_count: 0,
        })));
        setLoading(false);
        return;
      }

      // RLS blocks it - build profile list from other tables
      setMode("derived");
      const profileMap = new Map<string, ProfileInfo>();

      const initProfile = (id: string): ProfileInfo => ({
        id,
        email: null,
        first_name: null,
        last_name: null,
        is_superadmin: null,
        is_matrix_admin: null,
        is_in_study: null,
        created_datetime_utc: null,
        image_count: 0,
        caption_count: 0,
        vote_count: 0,
      });

      // Collect profile_ids from images
      const { data: imgs } = await supabase.from("images").select("profile_id").limit(1000);
      (imgs ?? []).forEach((r: { profile_id: string | null }) => {
        if (!r.profile_id) return;
        const p = profileMap.get(r.profile_id) ?? initProfile(r.profile_id);
        p.image_count++;
        profileMap.set(r.profile_id, p);
      });

      // Collect from captions
      const { data: caps } = await supabase.from("captions").select("profile_id").not("content", "is", null).limit(1000);
      (caps ?? []).forEach((r: { profile_id: string | null }) => {
        if (!r.profile_id) return;
        const p = profileMap.get(r.profile_id) ?? initProfile(r.profile_id);
        p.caption_count++;
        profileMap.set(r.profile_id, p);
      });

      // Collect from votes
      const { data: votes } = await supabase.from("caption_votes").select("profile_id").limit(1000);
      (votes ?? []).forEach((r: { profile_id: string | null }) => {
        if (!r.profile_id) return;
        const p = profileMap.get(r.profile_id) ?? initProfile(r.profile_id);
        p.vote_count++;
        profileMap.set(r.profile_id, p);
      });

      // Try to enrich with profile details for our own user
      if (directProfiles && directProfiles.length === 1) {
        const own = directProfiles[0];
        const p = profileMap.get(own.id) ?? initProfile(own.id);
        Object.assign(p, own);
        profileMap.set(own.id, p);
      }

      setProfiles(Array.from(profileMap.values()).sort((a, b) =>
        (b.image_count + b.caption_count + b.vote_count) - (a.image_count + a.caption_count + a.vote_count)
      ));
      setLoading(false);
    };
    load();
  }, []);

  const filtered = search.trim()
    ? profiles.filter((p) => {
        const s = search.toLowerCase();
        return (
          p.id.toLowerCase().includes(s) ||
          (p.email?.toLowerCase().includes(s)) ||
          (p.first_name?.toLowerCase().includes(s)) ||
          (p.last_name?.toLowerCase().includes(s))
        );
      })
    : profiles;

  return (
    <div>
      <h2 className="text-xl font-bold text-neutral-900 mb-4">Profiles</h2>

      {mode === "derived" && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
          RLS restricts direct profile reads. Showing {profiles.length} profiles derived from activity in images, captions, and votes.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by ID, email, or name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-neutral-300 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-neutral-400"
        />
        <span className="text-xs text-neutral-400 ml-auto">{filtered.length} profiles</span>
      </div>

      <div className="bg-white rounded-lg border border-neutral-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-200">
              <th className="text-left px-3 py-2 font-medium text-neutral-600">ID</th>
              {mode === "direct" && (
                <>
                  <th className="text-left px-3 py-2 font-medium text-neutral-600">Email</th>
                  <th className="text-left px-3 py-2 font-medium text-neutral-600">Name</th>
                  <th className="text-left px-3 py-2 font-medium text-neutral-600">Admin</th>
                  <th className="text-left px-3 py-2 font-medium text-neutral-600">Created</th>
                </>
              )}
              <th className="text-left px-3 py-2 font-medium text-neutral-600">Images</th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">Captions</th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">Votes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading ? (
              <tr><td colSpan={8} className="px-3 py-4 text-neutral-500">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-4 text-neutral-500">No profiles found.</td></tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className="hover:bg-neutral-50">
                  <td className="px-3 py-2 font-mono text-xs text-neutral-600" title={p.id}>
                    {p.id.slice(0, 8)}...
                  </td>
                  {mode === "direct" && (
                    <>
                      <td className="px-3 py-2 text-neutral-700 text-xs">{p.email ?? "-"}</td>
                      <td className="px-3 py-2 text-neutral-700 text-xs">
                        {[p.first_name, p.last_name].filter(Boolean).join(" ") || "-"}
                      </td>
                      <td className="px-3 py-2">
                        <span className={p.is_superadmin ? "text-green-600 text-xs font-medium" : "text-neutral-400 text-xs"}>
                          {p.is_superadmin ? "Yes" : "No"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-neutral-500 text-xs whitespace-nowrap">
                        {p.created_datetime_utc ? new Date(p.created_datetime_utc).toLocaleDateString() : "-"}
                      </td>
                    </>
                  )}
                  <td className="px-3 py-2 text-neutral-700 text-xs tabular-nums">{p.image_count}</td>
                  <td className="px-3 py-2 text-neutral-700 text-xs tabular-nums">{p.caption_count}</td>
                  <td className="px-3 py-2 text-neutral-700 text-xs tabular-nums">{p.vote_count}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
