"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import { createClient } from "@/lib/supabase/client";
import type { NavFilter } from "./AdminShell";
import FkLink from "./FkLink";

interface CaptionRequest {
  id: string;
  image_id: string | null;
  profile_id: string | null;
  created_datetime_utc: string;
}

interface PromptChain {
  id: string;
  created_datetime_utc: string;
}

const PAGE_SIZE = 25;
type SortField = "created_datetime_utc";
type SortDir = "asc" | "desc";

export default function CaptionRequestsTable({ navigateTo, filter }: { navigateTo: (section: string, filter?: NavFilter) => void; filter: NavFilter | null }) {
  const [rows, setRows] = useState<CaptionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [sortField, setSortField] = useState<SortField>("created_datetime_utc");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailChains, setDetailChains] = useState<PromptChain[]>([]);
  const [detailResponseCount, setDetailResponseCount] = useState(0);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    let query = supabase
      .from("caption_requests")
      .select("id, image_id, profile_id, created_datetime_utc", { count: "exact" });

    if (filter?.field === "image_id") query = query.eq("image_id", filter.value);
    if (filter?.field === "profile_id") query = query.eq("profile_id", filter.value);

    const { data, count } = await query
      .order(sortField, { ascending: sortDir === "asc" })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
      .limit(PAGE_SIZE);

    setRows((data ?? []) as CaptionRequest[]);
    setTotal(count ?? 0);
    setLoading(false);
  }, [page, sortField, sortDir, filter]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const fetchDetail = useCallback(async (requestId: string) => {
    setDetailLoading(true);
    const supabase = createClient();

    const { data: chains } = await supabase
      .from("llm_prompt_chains")
      .select("id, created_datetime_utc")
      .eq("caption_request_id", requestId)
      .order("created_datetime_utc", { ascending: false });

    setDetailChains((chains ?? []) as PromptChain[]);

    const { count } = await supabase
      .from("llm_model_responses")
      .select("id", { count: "exact", head: true })
      .eq("caption_request_id", requestId);

    setDetailResponseCount(count ?? 0);
    setDetailLoading(false);
  }, []);

  const toggleExpand = (row: CaptionRequest) => {
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
      <h2 className="text-xl font-bold text-neutral-900 mb-4">Caption Requests</h2>

      {filter && (
        <div className="flex items-center gap-2 mb-3 p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
          Filtered by {filter.field}: <code className="bg-blue-100 px-1 rounded">{filter.value.slice(0, 12)}...</code>
          <button onClick={() => navigateTo("caption_requests")} className="ml-auto text-blue-500 hover:text-blue-700 underline cursor-pointer">Clear</button>
        </div>
      )}

      <span className="text-xs text-neutral-400 mb-4 block">{total} requests</span>

      <div className="bg-white rounded-lg border border-neutral-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-200">
              <th className="text-left px-3 py-2 font-medium text-neutral-600 w-6"></th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">ID</th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">Image</th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">Profile</th>
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
              <tr><td colSpan={5} className="px-3 py-4 text-neutral-500">Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-4 text-neutral-500">No caption requests found.</td></tr>
            ) : (
              rows.map((r) => (
                <Fragment key={r.id}>
                  <tr className="hover:bg-neutral-50 cursor-pointer" onClick={() => toggleExpand(r)}>
                    <td className="px-3 py-2 text-neutral-400 text-xs">{expandedId === r.id ? "v" : ">"}</td>
                    <td className="px-3 py-2 text-neutral-500 font-mono text-xs">{String(r.id).slice(0, 8)}...</td>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      {r.image_id ? <FkLink label={r.image_id.slice(0, 8) + "..."} id={r.image_id} section="images" field="id" navigateTo={navigateTo} /> : "-"}
                    </td>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      {r.profile_id ? <FkLink label={r.profile_id.slice(0, 8) + "..."} id={r.profile_id} section="profiles" field="id" navigateTo={navigateTo} /> : "-"}
                    </td>
                    <td className="px-3 py-2 text-neutral-500 text-xs whitespace-nowrap">
                      {new Date(r.created_datetime_utc).toLocaleDateString()}
                    </td>
                  </tr>
                  {expandedId === r.id && (
                    <tr>
                      <td colSpan={5} className="p-0">
                        <div className="bg-neutral-50 border-t border-neutral-200 p-5">
                          {detailLoading ? (
                            <p className="text-sm text-neutral-500">Loading details...</p>
                          ) : (
                            <div className="space-y-3">
                              <div className="flex gap-6">
                                <div>
                                  <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1">Request ID</h4>
                                  <p className="text-xs font-mono text-neutral-600">{r.id}</p>
                                </div>
                                <div>
                                  <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1">Responses</h4>
                                  <p className="text-sm text-neutral-700">{detailResponseCount}</p>
                                </div>
                              </div>
                              <div>
                                <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1">Prompt Chains ({detailChains.length})</h4>
                                {detailChains.length === 0 ? (
                                  <p className="text-sm text-neutral-400 italic">No prompt chains.</p>
                                ) : (
                                  <div className="space-y-1">
                                    {detailChains.map((chain) => (
                                      <div key={chain.id} className="bg-white rounded border border-neutral-200 p-2 flex items-center justify-between">
                                        <span className="text-xs font-mono text-neutral-600">{String(chain.id)}</span>
                                        <span className="text-xs text-neutral-400">{new Date(chain.created_datetime_utc).toLocaleDateString()}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
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
