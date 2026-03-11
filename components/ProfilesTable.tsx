"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface Profile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  is_superadmin: boolean;
  is_matrix_admin: boolean;
  is_in_study: boolean;
  created_datetime_utc: string;
}

const PAGE_SIZE = 25;
type SortField = "created_datetime_utc" | "email" | "is_superadmin";
type SortDir = "asc" | "desc";

export default function ProfilesTable() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [total, setTotal] = useState(0);
  const [sortField, setSortField] = useState<SortField>("created_datetime_utc");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filterAdmin, setFilterAdmin] = useState<"all" | "yes" | "no">("all");
  const [error, setError] = useState<string | null>(null);

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    let query = supabase
      .from("profiles")
      .select("id, email, first_name, last_name, is_superadmin, is_matrix_admin, is_in_study, created_datetime_utc", { count: "exact" });

    if (search.trim()) {
      query = query.or(`email.ilike.%${search.trim()}%,first_name.ilike.%${search.trim()}%,last_name.ilike.%${search.trim()}%`);
    }
    if (filterAdmin === "yes") query = query.eq("is_superadmin", true);
    if (filterAdmin === "no") query = query.eq("is_superadmin", false);

    const { data, count, error: err } = await query
      .order(sortField, { ascending: sortDir === "asc" })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
      .limit(PAGE_SIZE);

    if (err) setError(err.message);
    setProfiles((data ?? []) as Profile[]);
    setTotal(count ?? 0);
    setLoading(false);
  }, [page, search, sortField, sortDir, filterAdmin]);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("desc"); }
    setPage(0);
  };

  const sortIcon = (field: SortField) => sortField === field ? (sortDir === "asc" ? " ^" : " v") : "";
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <th
      className="text-left px-3 py-2 font-medium text-neutral-600 cursor-pointer hover:text-neutral-900 select-none"
      onClick={() => toggleSort(field)}
    >
      {children}{sortIcon(field)}
    </th>
  );

  return (
    <div>
      <h2 className="text-xl font-bold text-neutral-900 mb-4">Profiles</h2>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by email or name..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          className="border border-neutral-300 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-neutral-400"
        />
        <select
          value={filterAdmin}
          onChange={(e) => { setFilterAdmin(e.target.value as "all" | "yes" | "no"); setPage(0); }}
          className="text-xs border border-neutral-300 rounded-lg px-2 py-1.5 bg-white text-neutral-700"
        >
          <option value="all">All roles</option>
          <option value="yes">Superadmin</option>
          <option value="no">Not admin</option>
        </select>
        <span className="text-xs text-neutral-400 ml-auto">{total} profiles</span>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
          Note: RLS may limit visible profiles. {error}
        </div>
      )}

      <div className="bg-white rounded-lg border border-neutral-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-200">
              <SortHeader field="email">Email</SortHeader>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">Name</th>
              <SortHeader field="is_superadmin">Admin</SortHeader>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">Matrix</th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">In Study</th>
              <SortHeader field="created_datetime_utc">Created</SortHeader>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading ? (
              <tr><td colSpan={6} className="px-3 py-4 text-neutral-500">Loading...</td></tr>
            ) : profiles.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-4 text-neutral-500">No profiles visible (RLS may restrict access).</td></tr>
            ) : (
              profiles.map((p) => (
                <tr key={p.id} className="hover:bg-neutral-50">
                  <td className="px-3 py-2 text-neutral-700 text-xs">{p.email}</td>
                  <td className="px-3 py-2 text-neutral-700 text-xs">
                    {[p.first_name, p.last_name].filter(Boolean).join(" ") || "-"}
                  </td>
                  <td className="px-3 py-2">
                    <span className={p.is_superadmin ? "text-green-600 text-xs font-medium" : "text-neutral-400 text-xs"}>
                      {p.is_superadmin ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={p.is_matrix_admin ? "text-blue-600 text-xs font-medium" : "text-neutral-400 text-xs"}>
                      {p.is_matrix_admin ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={p.is_in_study ? "text-purple-600 text-xs font-medium" : "text-neutral-400 text-xs"}>
                      {p.is_in_study ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-neutral-500 text-xs whitespace-nowrap">
                    {new Date(p.created_datetime_utc).toLocaleDateString()}
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
