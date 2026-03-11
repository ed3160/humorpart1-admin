"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import { createClient } from "@/lib/supabase/client";
import type { NavFilter } from "./AdminShell";
import FkLink from "./FkLink";

interface PromptChain {
  id: string;
  caption_request_id: string | null;
  created_datetime_utc: string;
}

interface ModelResponse {
  id: string;
  llm_model_id: number | null;
  humor_flavor_id: number | null;
  llm_system_prompt: string | null;
  llm_user_prompt: string | null;
  llm_model_response: string | null;
  processing_time_seconds: number | null;
  created_datetime_utc: string;
}

const PAGE_SIZE = 25;
type SortField = "created_datetime_utc";
type SortDir = "asc" | "desc";

export default function LlmPromptChainsTable({ navigateTo, filter }: { navigateTo: (section: string, filter?: NavFilter) => void; filter: NavFilter | null }) {
  const [rows, setRows] = useState<PromptChain[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [sortField, setSortField] = useState<SortField>("created_datetime_utc");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailResponses, setDetailResponses] = useState<ModelResponse[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    let query = supabase
      .from("llm_prompt_chains")
      .select("id, caption_request_id, created_datetime_utc", { count: "exact" });

    if (filter?.field === "caption_request_id") query = query.eq("caption_request_id", filter.value);

    const { data, count } = await query
      .order(sortField, { ascending: sortDir === "asc" })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
      .limit(PAGE_SIZE);

    setRows((data ?? []) as PromptChain[]);
    setTotal(count ?? 0);
    setLoading(false);
  }, [page, sortField, sortDir, filter]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const fetchDetail = useCallback(async (chainId: string) => {
    setDetailLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("llm_model_responses")
      .select("id, llm_model_id, humor_flavor_id, llm_system_prompt, llm_user_prompt, llm_model_response, processing_time_seconds, created_datetime_utc")
      .eq("llm_prompt_chain_id", chainId)
      .order("created_datetime_utc", { ascending: true });
    setDetailResponses((data ?? []) as ModelResponse[]);
    setDetailLoading(false);
  }, []);

  const toggleExpand = (row: PromptChain) => {
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
      <h2 className="text-xl font-bold text-neutral-900 mb-4">LLM Prompt Chains</h2>

      {filter && (
        <div className="flex items-center gap-2 mb-3 p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
          Filtered by {filter.field}: <code className="bg-blue-100 px-1 rounded">{filter.value.slice(0, 12)}...</code>
          <button onClick={() => navigateTo("prompt_chains")} className="ml-auto text-blue-500 hover:text-blue-700 underline cursor-pointer">Clear</button>
        </div>
      )}

      <span className="text-xs text-neutral-400 mb-4 block">{total} chains</span>

      <div className="bg-white rounded-lg border border-neutral-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-200">
              <th className="text-left px-3 py-2 font-medium text-neutral-600 w-6"></th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">ID</th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">Caption Request</th>
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
              <tr><td colSpan={4} className="px-3 py-4 text-neutral-500">Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={4} className="px-3 py-4 text-neutral-500">No prompt chains found.</td></tr>
            ) : (
              rows.map((r) => (
                <Fragment key={r.id}>
                  <tr className="hover:bg-neutral-50 cursor-pointer" onClick={() => toggleExpand(r)}>
                    <td className="px-3 py-2 text-neutral-400 text-xs">{expandedId === r.id ? "v" : ">"}</td>
                    <td className="px-3 py-2 text-neutral-500 font-mono text-xs">{String(r.id).slice(0, 8)}...</td>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      {r.caption_request_id ? (
                        <FkLink label={String(r.caption_request_id).slice(0, 8) + "..."} id={String(r.caption_request_id)} section="caption_requests" field="id" navigateTo={navigateTo} />
                      ) : "-"}
                    </td>
                    <td className="px-3 py-2 text-neutral-500 text-xs whitespace-nowrap">
                      {new Date(r.created_datetime_utc).toLocaleDateString()}
                    </td>
                  </tr>
                  {expandedId === r.id && (
                    <tr>
                      <td colSpan={4} className="p-0">
                        <div className="bg-neutral-50 border-t border-neutral-200 p-5">
                          {detailLoading ? (
                            <p className="text-sm text-neutral-500">Loading responses...</p>
                          ) : detailResponses.length === 0 ? (
                            <p className="text-sm text-neutral-400 italic">No responses for this chain.</p>
                          ) : (
                            <div className="space-y-3">
                              <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Model Responses ({detailResponses.length})</h4>
                              {detailResponses.map((resp) => (
                                <div key={resp.id} className="bg-white rounded-lg border border-neutral-200 p-3 space-y-2">
                                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
                                    <span>ID: <span className="font-mono">{String(resp.id).slice(0, 8)}...</span></span>
                                    <span>Model: <span className="font-mono">{resp.llm_model_id ?? "-"}</span></span>
                                    <span>Flavor: <span className="font-mono">{resp.humor_flavor_id ?? "-"}</span></span>
                                    <span>Time: {resp.processing_time_seconds != null ? `${resp.processing_time_seconds.toFixed(2)}s` : "-"}</span>
                                    <span>{new Date(resp.created_datetime_utc).toLocaleString()}</span>
                                  </div>
                                  {resp.llm_system_prompt && (
                                    <div>
                                      <span className="text-xs font-medium text-neutral-500">System: </span>
                                      <span className="text-xs text-neutral-600">{resp.llm_system_prompt.length > 300 ? resp.llm_system_prompt.slice(0, 300) + "..." : resp.llm_system_prompt}</span>
                                    </div>
                                  )}
                                  {resp.llm_user_prompt && (
                                    <div>
                                      <span className="text-xs font-medium text-neutral-500">User: </span>
                                      <span className="text-xs text-neutral-600">{resp.llm_user_prompt.length > 300 ? resp.llm_user_prompt.slice(0, 300) + "..." : resp.llm_user_prompt}</span>
                                    </div>
                                  )}
                                  {resp.llm_model_response && (
                                    <div>
                                      <span className="text-xs font-medium text-neutral-500">Response: </span>
                                      <span className="text-xs text-neutral-700">{resp.llm_model_response.length > 300 ? resp.llm_model_response.slice(0, 300) + "..." : resp.llm_model_response}</span>
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
