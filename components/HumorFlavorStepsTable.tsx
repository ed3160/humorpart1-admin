"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import { createClient } from "@/lib/supabase/client";
import type { NavFilter } from "./AdminShell";
import FkLink from "./FkLink";

interface FlavorStep {
  id: number;
  humor_flavor_id: number;
  order_by: number;
  description: string | null;
  llm_model_id: number | null;
  llm_temperature: number | null;
  humor_flavor_step_type_id: number | null;
  llm_input_type_id: number | null;
  llm_output_type_id: number | null;
  llm_system_prompt: string | null;
  llm_user_prompt: string | null;
}

const PAGE_SIZE = 25;
type SortField = "order_by" | "humor_flavor_id";
type SortDir = "asc" | "desc";

export default function HumorFlavorStepsTable({ navigateTo, filter }: { navigateTo: (section: string, filter?: NavFilter) => void; filter: NavFilter | null }) {
  const [rows, setRows] = useState<FlavorStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [sortField, setSortField] = useState<SortField>("humor_flavor_id");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    let query = supabase
      .from("humor_flavor_steps")
      .select("id, humor_flavor_id, order_by, description, llm_model_id, llm_temperature, humor_flavor_step_type_id, llm_input_type_id, llm_output_type_id, llm_system_prompt, llm_user_prompt", { count: "exact" });

    if (filter?.field === "humor_flavor_id") query = query.eq("humor_flavor_id", filter.value);

    const { data, count } = await query
      .order(sortField, { ascending: sortDir === "asc" })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
      .limit(PAGE_SIZE);

    setRows((data ?? []) as FlavorStep[]);
    setTotal(count ?? 0);
    setLoading(false);
  }, [page, sortField, sortDir, filter]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
    setPage(0);
  };

  const sortIcon = (field: SortField) => sortField === field ? (sortDir === "asc" ? " ^" : " v") : "";
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <h2 className="text-xl font-bold text-neutral-900 mb-4">Humor Flavor Steps</h2>

      {filter && (
        <div className="flex items-center gap-2 mb-3 p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
          Filtered by {filter.field}: <code className="bg-blue-100 px-1 rounded">{String(filter.value)}</code>
          <button onClick={() => navigateTo("flavor_steps")} className="ml-auto text-blue-500 hover:text-blue-700 underline cursor-pointer">Clear</button>
        </div>
      )}

      <span className="text-xs text-neutral-400 mb-4 block">{total} steps</span>

      <div className="bg-white rounded-lg border border-neutral-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-200">
              <th className="text-left px-3 py-2 font-medium text-neutral-600 w-6"></th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">ID</th>
              <th
                className="text-left px-3 py-2 font-medium text-neutral-600 cursor-pointer hover:text-neutral-900 select-none whitespace-nowrap"
                onClick={() => toggleSort("humor_flavor_id")}
              >
                Flavor ID{sortIcon("humor_flavor_id")}
              </th>
              <th
                className="text-left px-3 py-2 font-medium text-neutral-600 cursor-pointer hover:text-neutral-900 select-none whitespace-nowrap"
                onClick={() => toggleSort("order_by")}
              >
                Order{sortIcon("order_by")}
              </th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">Description</th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">Model ID</th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">Temp</th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">Step Type</th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">Input Type</th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">Output Type</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading ? (
              <tr><td colSpan={10} className="px-3 py-4 text-neutral-500">Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={10} className="px-3 py-4 text-neutral-500">No steps found.</td></tr>
            ) : (
              rows.map((r) => (
                <Fragment key={r.id}>
                  <tr className="hover:bg-neutral-50 cursor-pointer" onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}>
                    <td className="px-3 py-2 text-neutral-400 text-xs">{expandedId === r.id ? "v" : ">"}</td>
                    <td className="px-3 py-2 text-neutral-500 font-mono text-xs">{r.id}</td>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <FkLink label={String(r.humor_flavor_id)} id={String(r.humor_flavor_id)} section="humor_flavors" field="id" navigateTo={navigateTo} />
                    </td>
                    <td className="px-3 py-2 text-neutral-600 font-mono text-xs">{r.order_by}</td>
                    <td className="px-3 py-2 text-neutral-600 max-w-xs truncate">{r.description ?? "-"}</td>
                    <td className="px-3 py-2 text-neutral-500 font-mono text-xs">{r.llm_model_id ?? "-"}</td>
                    <td className="px-3 py-2 text-neutral-500 font-mono text-xs">{r.llm_temperature ?? "-"}</td>
                    <td className="px-3 py-2 text-neutral-500 font-mono text-xs">{r.humor_flavor_step_type_id ?? "-"}</td>
                    <td className="px-3 py-2 text-neutral-500 font-mono text-xs">{r.llm_input_type_id ?? "-"}</td>
                    <td className="px-3 py-2 text-neutral-500 font-mono text-xs">{r.llm_output_type_id ?? "-"}</td>
                  </tr>
                  {expandedId === r.id && (
                    <tr>
                      <td colSpan={10} className="p-0">
                        <div className="bg-neutral-50 border-t border-neutral-200 p-5 space-y-3">
                          <div>
                            <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1">System Prompt</h4>
                            <p className="text-sm text-neutral-700 whitespace-pre-wrap bg-white rounded border border-neutral-200 p-3 max-h-60 overflow-y-auto">
                              {r.llm_system_prompt || <span className="text-neutral-400 italic">None</span>}
                            </p>
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1">User Prompt</h4>
                            <p className="text-sm text-neutral-700 whitespace-pre-wrap bg-white rounded border border-neutral-200 p-3 max-h-60 overflow-y-auto">
                              {r.llm_user_prompt || <span className="text-neutral-400 italic">None</span>}
                            </p>
                          </div>
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
