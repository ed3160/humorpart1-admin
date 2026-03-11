"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { NavFilter } from "./AdminShell";
import FkLink from "./FkLink";

interface Caption {
  id: string;
  content: string;
  image_id: string;
  profile_id: string;
  is_public: boolean;
  created_datetime_utc: string;
}

const PAGE_SIZE = 25;
type SortField = "created_datetime_utc" | "is_public";
type SortDir = "asc" | "desc";

export default function CaptionsTable({ navigateTo, filter }: { navigateTo: (section: "profiles" | "images" | "captions", filter?: NavFilter) => void; filter: NavFilter | null }) {
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [total, setTotal] = useState(0);
  const [sortField, setSortField] = useState<SortField>("created_datetime_utc");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filterPublic, setFilterPublic] = useState<"all" | "yes" | "no">("all");

  const fetchCaptions = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    let query = supabase
      .from("captions")
      .select("id, content, image_id, profile_id, is_public, created_datetime_utc", { count: "exact" })
      .not("content", "is", null);

    if (search.trim()) query = query.ilike("content", `%${search.trim()}%`);
    if (filterPublic === "yes") query = query.eq("is_public", true);
    if (filterPublic === "no") query = query.eq("is_public", false);
    if (filter?.field === "image_id") query = query.eq("image_id", filter.value);
    if (filter?.field === "profile_id") query = query.eq("profile_id", filter.value);

    const { data, count } = await query
      .order(sortField, { ascending: sortDir === "asc" })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
      .limit(PAGE_SIZE);

    setCaptions(data ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  }, [page, search, sortField, sortDir, filterPublic, filter]);

  useEffect(() => { fetchCaptions(); }, [fetchCaptions]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("desc"); }
    setPage(0);
  };

  const sortIcon = (field: SortField) => sortField === field ? (sortDir === "asc" ? " ^" : " v") : "";
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <h2 className="text-xl font-bold text-neutral-900 mb-4">Captions</h2>

      {filter && (
        <div className="flex items-center gap-2 mb-3 p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
          Filtered by {filter.field}: <code className="bg-blue-100 px-1 rounded">{filter.value.slice(0, 12)}...</code>
          <button onClick={() => navigateTo("captions")} className="ml-auto text-blue-500 hover:text-blue-700 underline cursor-pointer">Clear</button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by content..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          className="border border-neutral-300 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-neutral-400"
        />
        <select
          value={filterPublic}
          onChange={(e) => { setFilterPublic(e.target.value as "all" | "yes" | "no"); setPage(0); }}
          className="text-xs border border-neutral-300 rounded-lg px-2 py-1.5 bg-white text-neutral-700"
        >
          <option value="all">All visibility</option>
          <option value="yes">Public only</option>
          <option value="no">Private only</option>
        </select>
        <span className="text-xs text-neutral-400 ml-auto">{total} captions</span>
      </div>

      <div className="bg-white rounded-lg border border-neutral-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-200">
              <th className="text-left px-3 py-2 font-medium text-neutral-600">Content</th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">Image ID</th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">Profile</th>
              <th
                className="text-left px-3 py-2 font-medium text-neutral-600 cursor-pointer hover:text-neutral-900 select-none"
                onClick={() => toggleSort("is_public")}
              >
                Public{sortIcon("is_public")}
              </th>
              <th
                className="text-left px-3 py-2 font-medium text-neutral-600 cursor-pointer hover:text-neutral-900 select-none"
                onClick={() => toggleSort("created_datetime_utc")}
              >
                Created{sortIcon("created_datetime_utc")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading ? (
              <tr><td colSpan={5} className="px-3 py-4 text-neutral-500">Loading...</td></tr>
            ) : captions.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-4 text-neutral-500">No captions found.</td></tr>
            ) : (
              captions.map((c) => (
                <tr key={c.id} className="hover:bg-neutral-50">
                  <td className="px-3 py-2 text-neutral-700 max-w-md truncate" title={c.content}>{c.content}</td>
                  <td className="px-3 py-2">
                    {c.image_id ? <FkLink label={c.image_id.slice(0, 8) + "..."} id={c.image_id} section="images" field="id" navigateTo={navigateTo} /> : "-"}
                  </td>
                  <td className="px-3 py-2">
                    {c.profile_id ? <FkLink label={c.profile_id.slice(0, 8) + "..."} id={c.profile_id} section="profiles" field="id" navigateTo={navigateTo} /> : "-"}
                  </td>
                  <td className="px-3 py-2">
                    <span className={c.is_public ? "text-green-600 text-xs font-medium" : "text-neutral-400 text-xs"}>
                      {c.is_public ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-neutral-500 text-xs whitespace-nowrap">
                    {new Date(c.created_datetime_utc).toLocaleDateString()}
                  </td>
                </tr>
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
