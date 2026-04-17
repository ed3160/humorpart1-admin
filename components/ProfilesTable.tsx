"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import { createClient } from "@/lib/supabase/client";
import type { NavFilter } from "./AdminShell";

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

export default function ProfilesTable({ navigateTo, filter }: { navigateTo: (section: string, filter?: NavFilter) => void; filter: NavFilter | null }) {
  const [profiles, setProfiles] = useState<ProfileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [mode, setMode] = useState<"direct" | "derived">("direct");

  // Expandable detail
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailImages, setDetailImages] = useState<{ id: string; url: string }[]>([]);
  const [detailCaptions, setDetailCaptions] = useState<{ id: string; content: string; image_id: string }[]>([]);
  const [detailVoteCount, setDetailVoteCount] = useState(0);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchDetail = useCallback(async (profileId: string) => {
    setDetailLoading(true);
    setDetailImages([]);
    setDetailCaptions([]);
    setDetailVoteCount(0);
    const supabase = createClient();

    const [imgRes, capRes, voteRes] = await Promise.all([
      supabase.from("images").select("id, url").eq("profile_id", profileId).order("created_datetime_utc", { ascending: false }).limit(6),
      supabase.from("captions").select("id, content, image_id").eq("profile_id", profileId).not("content", "is", null).order("created_datetime_utc", { ascending: false }).limit(5),
      supabase.from("caption_votes").select("id", { count: "exact", head: true }).eq("profile_id", profileId),
    ]);

    setDetailImages((imgRes.data ?? []) as { id: string; url: string }[]);
    setDetailCaptions((capRes.data ?? []) as { id: string; content: string; image_id: string }[]);
    setDetailVoteCount(voteRes.count ?? 0);
    setDetailLoading(false);
  }, []);

  const toggleExpand = (profileId: string) => {
    if (expandedId === profileId) {
      setExpandedId(null);
    } else {
      setExpandedId(profileId);
      fetchDetail(profileId);
    }
  };

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

  const idFiltered = filter?.field === "id"
    ? profiles.filter((p) => p.id === filter.value)
    : profiles;

  const filtered = search.trim()
    ? idFiltered.filter((p) => {
        const s = search.toLowerCase();
        return (
          p.id.toLowerCase().includes(s) ||
          (p.email?.toLowerCase().includes(s)) ||
          (p.first_name?.toLowerCase().includes(s)) ||
          (p.last_name?.toLowerCase().includes(s))
        );
      })
    : idFiltered;

  const PAGE_SIZE = 25;
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div>
      <h2 className="text-xl font-bold text-neutral-900 mb-4">Profiles</h2>

      {mode === "derived" && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
          RLS restricts direct profile reads. Showing {profiles.length} profiles derived from activity in images, captions, and votes.
        </div>
      )}

      {filter && (
        <div className="flex items-center gap-2 mb-3 p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
          Filtered by {filter.field}: <code className="bg-blue-100 px-1 rounded">{filter.value.slice(0, 12)}...</code>
          <button onClick={() => navigateTo("profiles")} className="ml-auto text-blue-500 hover:text-blue-700 underline cursor-pointer">Clear</button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by ID, email, or name..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          className="border border-neutral-300 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-neutral-400"
        />
        <span className="text-xs text-neutral-400 ml-auto">{filtered.length} profiles</span>
      </div>

      <div className="bg-white rounded-lg border border-neutral-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-200">
              <th className="text-left px-3 py-2 font-medium text-neutral-600 w-6"></th>
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
            ) : paginated.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-4 text-neutral-500">No profiles found.</td></tr>
            ) : (
              paginated.map((p) => (
                <Fragment key={p.id}>
                <tr className="hover:bg-neutral-50 cursor-pointer" onClick={() => toggleExpand(p.id)}>
                  <td className="px-3 py-2 text-neutral-400 text-xs">{expandedId === p.id ? "v" : ">"}</td>
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
                  <td className="px-3 py-2 text-xs tabular-nums">
                    {p.image_count > 0 ? (
                      <button onClick={() => navigateTo("images", { field: "profile_id", value: p.id })} className="text-blue-600 hover:underline cursor-pointer">{p.image_count}</button>
                    ) : <span className="text-neutral-400">0</span>}
                  </td>
                  <td className="px-3 py-2 text-xs tabular-nums">
                    {p.caption_count > 0 ? (
                      <button onClick={() => navigateTo("captions", { field: "profile_id", value: p.id })} className="text-blue-600 hover:underline cursor-pointer">{p.caption_count}</button>
                    ) : <span className="text-neutral-400">0</span>}
                  </td>
                  <td className="px-3 py-2 text-neutral-700 text-xs tabular-nums">{p.vote_count}</td>
                </tr>
                {expandedId === p.id && (
                  <tr>
                    <td colSpan={mode === "direct" ? 9 : 5} className="p-0">
                      <div className="bg-neutral-50 border-t border-neutral-200 p-5">
                        {detailLoading ? (
                          <p className="text-sm text-neutral-500">Loading...</p>
                        ) : (
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div>
                              <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Recent Images ({detailImages.length})</h4>
                              {detailImages.length === 0 ? (
                                <p className="text-xs text-neutral-400">No images</p>
                              ) : (
                                <div className="grid grid-cols-3 gap-2">
                                  {detailImages.map((img) => (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img key={img.id} src={img.url} alt="" className="w-full aspect-square object-cover rounded-lg" />
                                  ))}
                                </div>
                              )}
                            </div>
                            <div>
                              <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Recent Captions ({detailCaptions.length})</h4>
                              {detailCaptions.length === 0 ? (
                                <p className="text-xs text-neutral-400">No captions</p>
                              ) : (
                                <div className="space-y-2">
                                  {detailCaptions.map((cap) => (
                                    <div key={cap.id} className="bg-white rounded-lg border border-neutral-200 p-2.5">
                                      <p className="text-xs text-neutral-700">{cap.content}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div>
                              <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Summary</h4>
                              <div className="bg-white rounded-lg border border-neutral-200 p-4 space-y-3">
                                <div className="flex justify-between">
                                  <span className="text-xs text-neutral-500">Profile ID</span>
                                  <span className="text-xs font-mono text-neutral-700">{p.id}</span>
                                </div>
                                {p.email && <div className="flex justify-between"><span className="text-xs text-neutral-500">Email</span><span className="text-xs text-neutral-700">{p.email}</span></div>}
                                <div className="flex justify-between"><span className="text-xs text-neutral-500">Images</span><span className="text-xs font-semibold text-neutral-700">{p.image_count}</span></div>
                                <div className="flex justify-between"><span className="text-xs text-neutral-500">Captions</span><span className="text-xs font-semibold text-neutral-700">{p.caption_count}</span></div>
                                <div className="flex justify-between"><span className="text-xs text-neutral-500">Total Votes Cast</span><span className="text-xs font-semibold text-neutral-700">{detailVoteCount}</span></div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-2 mt-4 text-sm">
          <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 rounded border border-neutral-300 disabled:opacity-40 hover:bg-neutral-100 cursor-pointer disabled:cursor-default">Prev</button>
          <span className="text-neutral-500">Page {page + 1} of {totalPages}</span>
          <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 rounded border border-neutral-300 disabled:opacity-40 hover:bg-neutral-100 cursor-pointer disabled:cursor-default">Next</button>
        </div>
      )}
    </div>
  );
}
