"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import { createClient } from "@/lib/supabase/client";
import type { NavFilter } from "./AdminShell";

interface HumorFlavor {
  id: number;
  slug: string;
  description: string | null;
  created_datetime_utc: string;
}

interface FlavorStep {
  id: number;
  humor_flavor_id: number;
  order_by: number;
  description: string | null;
  llm_model_id: number | null;
  llm_temperature: number | null;
  llm_system_prompt: string | null;
  llm_user_prompt: string | null;
}

const PAGE_SIZE = 25;
type SortField = "created_datetime_utc" | "slug";
type SortDir = "asc" | "desc";

export default function HumorFlavorsTable({ filter }: { navigateTo: (section: string, filter?: NavFilter) => void; filter: NavFilter | null }) {
  const [rows, setRows] = useState<HumorFlavor[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [sortField, setSortField] = useState<SortField>("created_datetime_utc");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detailSteps, setDetailSteps] = useState<FlavorStep[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [stepCounts, setStepCounts] = useState<Record<number, number>>({});

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    let query = supabase
      .from("humor_flavors")
      .select("id, slug, description, created_datetime_utc", { count: "exact" });

    if (filter?.field === "id") query = query.eq("id", filter.value);

    const { data, count } = await query
      .order(sortField, { ascending: sortDir === "asc" })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
      .limit(PAGE_SIZE);

    const items = (data ?? []) as HumorFlavor[];
    setRows(items);
    setTotal(count ?? 0);

    // Fetch step counts
    if (items.length > 0) {
      const ids = items.map((r) => r.id);
      const { data: steps } = await supabase
        .from("humor_flavor_steps")
        .select("humor_flavor_id")
        .in("humor_flavor_id", ids);
      const counts: Record<number, number> = {};
      for (const s of steps ?? []) {
        counts[s.humor_flavor_id] = (counts[s.humor_flavor_id] || 0) + 1;
      }
      setStepCounts(counts);
    }

    setLoading(false);
  }, [page, sortField, sortDir, filter]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const fetchDetail = useCallback(async (flavorId: number) => {
    setDetailLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("humor_flavor_steps")
      .select("id, humor_flavor_id, order_by, description, llm_model_id, llm_temperature, llm_system_prompt, llm_user_prompt")
      .eq("humor_flavor_id", flavorId)
      .order("order_by", { ascending: true });
    setDetailSteps((data ?? []) as FlavorStep[]);
    setDetailLoading(false);
  }, []);

  const toggleExpand = (row: HumorFlavor) => {
    if (expandedId === row.id) {
      setExpandedId(null);
    } else {
      setExpandedId(row.id);
      fetchDetail(row.id);
    }
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
      <h2 className="text-xl font-bold text-neutral-900 mb-4">Humor Flavors</h2>
      <span className="text-xs text-neutral-400 mb-4 block">{total} flavors</span>

      <div className="bg-white rounded-lg border border-neutral-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-200">
              <th className="text-left px-3 py-2 font-medium text-neutral-600 w-6"></th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">ID</th>
              <th
                className="text-left px-3 py-2 font-medium text-neutral-600 cursor-pointer hover:text-neutral-900 select-none whitespace-nowrap"
                onClick={() => toggleSort("slug")}
              >
                Slug{sortIcon("slug")}
              </th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">Description</th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">Steps</th>
              <th
                className="text-left px-3 py-2 font-medium text-neutral-600 cursor-pointer hover:text-neutral-900 select-none whitespace-nowrap"
                onClick={() => toggleSort("created_datetime_utc")}
              >
                Created{sortIcon("created_datetime_utc")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading ? (
              <tr><td colSpan={6} className="px-3 py-4 text-neutral-500">Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-4 text-neutral-500">No humor flavors found.</td></tr>
            ) : (
              rows.map((r) => (
                <Fragment key={r.id}>
                  <tr className="hover:bg-neutral-50 cursor-pointer" onClick={() => toggleExpand(r)}>
                    <td className="px-3 py-2 text-neutral-400 text-xs">{expandedId === r.id ? "v" : ">"}</td>
                    <td className="px-3 py-2 text-neutral-500 font-mono text-xs">{r.id}</td>
                    <td className="px-3 py-2 text-neutral-700">{r.slug}</td>
                    <td className="px-3 py-2 text-neutral-600 max-w-xs truncate">{r.description ?? "-"}</td>
                    <td className="px-3 py-2 text-neutral-600 text-xs">{stepCounts[r.id] ?? 0}</td>
                    <td className="px-3 py-2 text-neutral-500 text-xs whitespace-nowrap">
                      {new Date(r.created_datetime_utc).toLocaleDateString()}
                    </td>
                  </tr>
                  {expandedId === r.id && (
                    <tr>
                      <td colSpan={6} className="p-0">
                        <div className="bg-neutral-50 border-t border-neutral-200 p-5">
                          {detailLoading ? (
                            <p className="text-sm text-neutral-500">Loading steps...</p>
                          ) : detailSteps.length === 0 ? (
                            <p className="text-sm text-neutral-400 italic">No steps for this flavor.</p>
                          ) : (
                            <div className="space-y-3">
                              <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Flavor Steps ({detailSteps.length})</h4>
                              {detailSteps.map((step) => (
                                <div key={step.id} className="bg-white rounded-lg border border-neutral-200 p-3">
                                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600 mb-2">
                                    <span>Order: <span className="font-mono">{step.order_by}</span></span>
                                    <span>Model ID: <span className="font-mono">{step.llm_model_id ?? "-"}</span></span>
                                    <span>Temp: <span className="font-mono">{step.llm_temperature ?? "-"}</span></span>
                                  </div>
                                  {step.description && <p className="text-sm text-neutral-700 mb-2">{step.description}</p>}
                                  {step.llm_system_prompt && (
                                    <div className="mb-1">
                                      <span className="text-xs font-medium text-neutral-500">System Prompt: </span>
                                      <span className="text-xs text-neutral-600">{step.llm_system_prompt.length > 200 ? step.llm_system_prompt.slice(0, 200) + "..." : step.llm_system_prompt}</span>
                                    </div>
                                  )}
                                  {step.llm_user_prompt && (
                                    <div>
                                      <span className="text-xs font-medium text-neutral-500">User Prompt: </span>
                                      <span className="text-xs text-neutral-600">{step.llm_user_prompt.length > 200 ? step.llm_user_prompt.slice(0, 200) + "..." : step.llm_user_prompt}</span>
                                    </div>
                                  )}
                                </div>
                              ))}
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
