"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import { createClient } from "@/lib/supabase/client";
import type { NavFilter } from "./AdminShell";
import FkLink from "./FkLink";

interface LlmResponse {
  id: string;
  llm_model_id: number | null;
  humor_flavor_id: number | null;
  humor_flavor_step_id: number | null;
  caption_request_id: string | null;
  llm_prompt_chain_id: string | null;
  processing_time_seconds: number | null;
  llm_temperature: number | null;
  created_datetime_utc: string;
  llm_system_prompt: string | null;
  llm_user_prompt: string | null;
  llm_model_response: string | null;
}

const PAGE_SIZE = 25;
type SortField = "created_datetime_utc" | "processing_time_seconds";
type SortDir = "asc" | "desc";

export default function LlmResponsesTable({ navigateTo, filter }: { navigateTo: (section: string, filter?: NavFilter) => void; filter: NavFilter | null }) {
  const [rows, setRows] = useState<LlmResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [sortField, setSortField] = useState<SortField>("created_datetime_utc");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    let query = supabase
      .from("llm_model_responses")
      .select("id, llm_model_id, humor_flavor_id, humor_flavor_step_id, caption_request_id, llm_prompt_chain_id, processing_time_seconds, llm_temperature, created_datetime_utc, llm_system_prompt, llm_user_prompt, llm_model_response", { count: "exact" });

    if (filter?.field === "llm_model_id") query = query.eq("llm_model_id", filter.value);
    if (filter?.field === "humor_flavor_id") query = query.eq("humor_flavor_id", filter.value);
    if (filter?.field === "caption_request_id") query = query.eq("caption_request_id", filter.value);
    if (filter?.field === "llm_prompt_chain_id") query = query.eq("llm_prompt_chain_id", filter.value);

    const { data, count } = await query
      .order(sortField, { ascending: sortDir === "asc" })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
      .limit(PAGE_SIZE);

    setRows((data ?? []) as LlmResponse[]);
    setTotal(count ?? 0);
    setLoading(false);
  }, [page, sortField, sortDir, filter]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("desc"); }
    setPage(0);
  };

  const sortIcon = (field: SortField) => sortField === field ? (sortDir === "asc" ? " ^" : " v") : "";
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <h2 className="text-xl font-bold text-neutral-900 mb-4">LLM Responses</h2>

      {filter && (
        <div className="flex items-center gap-2 mb-3 p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
          Filtered by {filter.field}: <code className="bg-blue-100 px-1 rounded">{String(filter.value).slice(0, 12)}{String(filter.value).length > 12 ? "..." : ""}</code>
          <button onClick={() => navigateTo("llm_responses")} className="ml-auto text-blue-500 hover:text-blue-700 underline cursor-pointer">Clear</button>
        </div>
      )}

      <span className="text-xs text-neutral-400 mb-4 block">{total} responses</span>

      <div className="bg-white rounded-lg border border-neutral-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-200">
              <th className="text-left px-3 py-2 font-medium text-neutral-600 w-6"></th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">ID</th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">Model</th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">Flavor</th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">Request</th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">Chain</th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600 cursor-pointer hover:text-neutral-900 select-none whitespace-nowrap" onClick={() => toggleSort("processing_time_seconds")}>Time{sortIcon("processing_time_seconds")}</th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">Temp</th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600 cursor-pointer hover:text-neutral-900 select-none whitespace-nowrap" onClick={() => toggleSort("created_datetime_utc")}>Created{sortIcon("created_datetime_utc")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading ? (
              <tr><td colSpan={9} className="px-3 py-4 text-neutral-500">Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={9} className="px-3 py-4 text-neutral-500">No responses found.</td></tr>
            ) : (
              rows.map((r) => (
                <Fragment key={r.id}>
                  <tr className="hover:bg-neutral-50 cursor-pointer" onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}>
                    <td className="px-3 py-2 text-neutral-400 text-xs">{expandedId === r.id ? "v" : ">"}</td>
                    <td className="px-3 py-2 text-neutral-500 font-mono text-xs">{r.id.slice(0, 8)}...</td>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      {r.llm_model_id != null ? (
                        <FkLink label={String(r.llm_model_id)} id={String(r.llm_model_id)} section="llm_models" field="id" navigateTo={navigateTo} />
                      ) : "-"}
                    </td>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      {r.humor_flavor_id != null ? (
                        <FkLink label={String(r.humor_flavor_id)} id={String(r.humor_flavor_id)} section="humor_flavors" field="id" navigateTo={navigateTo} />
                      ) : "-"}
                    </td>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      {r.caption_request_id ? (
                        <FkLink label={String(r.caption_request_id).slice(0, 8) + "..."} id={String(r.caption_request_id)} section="caption_requests" field="id" navigateTo={navigateTo} />
                      ) : "-"}
                    </td>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      {r.llm_prompt_chain_id ? (
                        <FkLink label={String(r.llm_prompt_chain_id).slice(0, 8) + "..."} id={String(r.llm_prompt_chain_id)} section="prompt_chains" field="id" navigateTo={navigateTo} />
                      ) : "-"}
                    </td>
                    <td className="px-3 py-2 text-neutral-600 text-xs font-mono">
                      {r.processing_time_seconds != null ? `${r.processing_time_seconds.toFixed(2)}s` : "-"}
                    </td>
                    <td className="px-3 py-2 text-neutral-500 text-xs font-mono">{r.llm_temperature ?? "-"}</td>
                    <td className="px-3 py-2 text-neutral-500 text-xs whitespace-nowrap">
                      {new Date(r.created_datetime_utc).toLocaleDateString()}
                    </td>
                  </tr>
                  {expandedId === r.id && (
                    <tr>
                      <td colSpan={9} className="p-0">
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
                          <div>
                            <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1">Model Response</h4>
                            <p className="text-sm text-neutral-700 whitespace-pre-wrap bg-white rounded border border-neutral-200 p-3 max-h-60 overflow-y-auto">
                              {r.llm_model_response || <span className="text-neutral-400 italic">None</span>}
                            </p>
                          </div>
                          <div className="flex gap-4 text-xs text-neutral-500">
                            <span>Step ID: <span className="font-mono">{r.humor_flavor_step_id ?? "-"}</span></span>
                            <span>Full ID: <span className="font-mono">{r.id}</span></span>
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
