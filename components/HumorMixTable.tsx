"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { NavFilter } from "./AdminShell";
import FkLink from "./FkLink";

interface HumorMix {
  id: number;
  humor_flavor_id: number;
  caption_count: number | null;
  created_datetime_utc: string;
}

const PAGE_SIZE = 25;
type SortField = "created_datetime_utc" | "humor_flavor_id";
type SortDir = "asc" | "desc";

export default function HumorMixTable({ navigateTo, filter }: { navigateTo: (section: string, filter?: NavFilter) => void; filter: NavFilter | null }) {
  const [rows, setRows] = useState<HumorMix[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [sortField, setSortField] = useState<SortField>("created_datetime_utc");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [editId, setEditId] = useState<number | null>(null);
  const [editCaptionCount, setEditCaptionCount] = useState<number>(0);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    let query = supabase
      .from("humor_flavor_mix")
      .select("id, humor_flavor_id, caption_count, created_datetime_utc", { count: "exact" });

    if (filter?.field === "humor_flavor_id") query = query.eq("humor_flavor_id", filter.value);

    const { data, count } = await query
      .order(sortField, { ascending: sortDir === "asc" })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
      .limit(PAGE_SIZE);

    setRows((data ?? []) as HumorMix[]);
    setTotal(count ?? 0);
    setLoading(false);
  }, [page, sortField, sortDir, filter]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const handleUpdate = async (id: number) => {
    const supabase = createClient();
    await supabase.from("humor_flavor_mix").update({ caption_count: editCaptionCount }).eq("id", id);
    setEditId(null);
    fetchRows();
  };

  const startEdit = (row: HumorMix) => {
    setEditId(row.id);
    setEditCaptionCount(row.caption_count ?? 0);
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("desc"); }
    setPage(0);
  };

  const sortIcon = (field: SortField) => sortField === field ? (sortDir === "asc" ? " ^" : " v") : "";
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <h2 className="text-xl font-bold text-neutral-900 mb-4">Humor Mix</h2>

      {filter && (
        <div className="flex items-center gap-2 mb-3 p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
          Filtered by {filter.field}: <code className="bg-blue-100 px-1 rounded">{String(filter.value)}</code>
          <button onClick={() => navigateTo("humor_mix")} className="ml-auto text-blue-500 hover:text-blue-700 underline cursor-pointer">Clear</button>
        </div>
      )}

      <span className="text-xs text-neutral-400 mb-4 block">{total} mix entries</span>

      <div className="bg-white rounded-lg border border-neutral-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-200">
              <th className="text-left px-3 py-2 font-medium text-neutral-600">ID</th>
              <th
                className="text-left px-3 py-2 font-medium text-neutral-600 cursor-pointer hover:text-neutral-900 select-none whitespace-nowrap"
                onClick={() => toggleSort("humor_flavor_id")}
              >
                Flavor ID{sortIcon("humor_flavor_id")}
              </th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">Caption Count</th>
              <th
                className="text-left px-3 py-2 font-medium text-neutral-600 cursor-pointer hover:text-neutral-900 select-none whitespace-nowrap"
                onClick={() => toggleSort("created_datetime_utc")}
              >
                Created{sortIcon("created_datetime_utc")}
              </th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading ? (
              <tr><td colSpan={5} className="px-3 py-4 text-neutral-500">Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-4 text-neutral-500">No entries found.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="hover:bg-neutral-50">
                  <td className="px-3 py-2 text-neutral-500 font-mono text-xs">{r.id}</td>
                  <td className="px-3 py-2">
                    <FkLink label={String(r.humor_flavor_id)} id={String(r.humor_flavor_id)} section="humor_flavors" field="id" navigateTo={navigateTo} />
                  </td>
                  <td className="px-3 py-2">
                    {editId === r.id ? (
                      <input
                        type="number"
                        value={editCaptionCount}
                        onChange={(e) => setEditCaptionCount(Number(e.target.value))}
                        className="border border-neutral-300 rounded px-2 py-1 text-sm w-24"
                      />
                    ) : (
                      <span className="text-neutral-700">{r.caption_count ?? 0}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-neutral-500 text-xs whitespace-nowrap">
                    {new Date(r.created_datetime_utc).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2">
                    {editId === r.id ? (
                      <div className="flex gap-2">
                        <button onClick={() => handleUpdate(r.id)} className="text-xs text-green-600 hover:underline cursor-pointer">Save</button>
                        <button onClick={() => setEditId(null)} className="text-xs text-neutral-400 hover:underline cursor-pointer">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => startEdit(r)} className="text-xs text-blue-600 hover:underline cursor-pointer">Edit</button>
                    )}
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
