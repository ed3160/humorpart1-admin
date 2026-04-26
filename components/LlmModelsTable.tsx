"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { NavFilter } from "./AdminShell";
import FkLink from "./FkLink";

interface LlmModel {
  id: number;
  name: string;
  llm_provider_id: number | null;
  provider_model_id: string | null;
  is_temperature_supported: boolean | null;
  created_datetime_utc: string;
}

interface LlmProvider {
  id: number;
  name: string;
}

const PAGE_SIZE = 25;
type SortField = "created_datetime_utc" | "name";
type SortDir = "asc" | "desc";

export default function LlmModelsTable({ navigateTo, filter, userId }: { navigateTo: (section: string, filter?: NavFilter) => void; filter: NavFilter | null; userId: string }) {
  const [rows, setRows] = useState<LlmModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [sortField, setSortField] = useState<SortField>("created_datetime_utc");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [providers, setProviders] = useState<LlmProvider[]>([]);

  // Create
  const [newName, setNewName] = useState("");
  const [newProviderId, setNewProviderId] = useState<number | null>(null);
  const [newProviderModelId, setNewProviderModelId] = useState("");
  const [newTempSupported, setNewTempSupported] = useState(false);
  const [creating, setCreating] = useState(false);

  // Edit
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editProviderId, setEditProviderId] = useState<number | null>(null);
  const [editProviderModelId, setEditProviderModelId] = useState("");
  const [editTempSupported, setEditTempSupported] = useState(false);

  // Delete
  const [deleteId, setDeleteId] = useState<number | null>(null);

  useEffect(() => {
    const fetchProviders = async () => {
      const supabase = createClient();
      const { data } = await supabase.from("llm_providers").select("id, name").order("name");
      setProviders((data ?? []) as LlmProvider[]);
    };
    fetchProviders();
  }, []);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    let query = supabase
      .from("llm_models")
      .select("id, name, llm_provider_id, provider_model_id, is_temperature_supported, created_datetime_utc", { count: "exact" });

    if (filter?.field === "id") query = query.eq("id", filter.value);
    if (filter?.field === "llm_provider_id") query = query.eq("llm_provider_id", filter.value);

    const { data, count } = await query
      .order(sortField, { ascending: sortDir === "asc" })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
      .limit(PAGE_SIZE);

    setRows((data ?? []) as LlmModel[]);
    setTotal(count ?? 0);
    setLoading(false);
  }, [page, sortField, sortDir, filter]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const getProviderName = (id: number | null) => {
    if (id === null) return "-";
    const p = providers.find((pp) => pp.id === id);
    return p ? p.name : String(id);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const supabase = createClient();
    await supabase.from("llm_models").insert({
      name: newName.trim(),
      llm_provider_id: newProviderId,
      provider_model_id: newProviderModelId.trim() || null,
      is_temperature_supported: newTempSupported,
      created_by_user_id: userId,
      modified_by_user_id: userId,
    });
    setNewName(""); setNewProviderId(null); setNewProviderModelId(""); setNewTempSupported(false);
    setCreating(false);
    fetchRows();
  };

  const handleUpdate = async (id: number) => {
    const supabase = createClient();
    await supabase.from("llm_models").update({
      name: editName.trim(),
      llm_provider_id: editProviderId,
      provider_model_id: editProviderModelId.trim() || null,
      is_temperature_supported: editTempSupported,
      modified_by_user_id: userId,
    }).eq("id", id);
    setEditId(null);
    fetchRows();
  };

  const handleDelete = async (id: number) => {
    const supabase = createClient();
    await supabase.from("llm_models").delete().eq("id", id);
    setDeleteId(null);
    fetchRows();
  };

  const startEdit = (row: LlmModel) => {
    setEditId(row.id);
    setEditName(row.name);
    setEditProviderId(row.llm_provider_id);
    setEditProviderModelId(row.provider_model_id ?? "");
    setEditTempSupported(row.is_temperature_supported ?? false);
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
      <h2 className="text-xl font-bold text-neutral-900 mb-4">LLM Models</h2>

      {/* Create form */}
      <div className="bg-white rounded-lg border border-neutral-200 p-4 mb-4">
        <h3 className="text-sm font-semibold text-neutral-700 mb-2">Add Model</h3>
        <div className="flex flex-wrap items-center gap-2">
          <input type="text" placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} className="border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400" />
          <select value={newProviderId ?? ""} onChange={(e) => setNewProviderId(e.target.value ? Number(e.target.value) : null)} className="text-sm border border-neutral-300 rounded-lg px-2 py-2 bg-white text-neutral-700">
            <option value="">No provider</option>
            {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input type="text" placeholder="Provider Model ID" value={newProviderModelId} onChange={(e) => setNewProviderModelId(e.target.value)} className="border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400" />
          <label className="flex items-center gap-1.5 text-xs text-neutral-600 whitespace-nowrap">
            <input type="checkbox" checked={newTempSupported} onChange={(e) => setNewTempSupported(e.target.checked)} />
            Temp supported
          </label>
          <button onClick={handleCreate} disabled={creating || !newName.trim()} className="bg-neutral-900 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-neutral-800 disabled:opacity-40 cursor-pointer disabled:cursor-default">Add</button>
        </div>
      </div>

      {filter && (
        <div className="flex items-center gap-2 mb-3 p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
          Filtered by {filter.field}: <code className="bg-blue-100 px-1 rounded">{String(filter.value)}</code>
          <button onClick={() => navigateTo("llm_models")} className="ml-auto text-blue-500 hover:text-blue-700 underline cursor-pointer">Clear</button>
        </div>
      )}

      <span className="text-xs text-neutral-400 mb-4 block">{total} models</span>

      <div className="bg-white rounded-lg border border-neutral-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-200">
              <th className="text-left px-3 py-2 font-medium text-neutral-600">ID</th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600 cursor-pointer hover:text-neutral-900 select-none whitespace-nowrap" onClick={() => toggleSort("name")}>Name{sortIcon("name")}</th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">Provider</th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">Provider Model</th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">Temp</th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600 cursor-pointer hover:text-neutral-900 select-none whitespace-nowrap" onClick={() => toggleSort("created_datetime_utc")}>Created{sortIcon("created_datetime_utc")}</th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading ? (
              <tr><td colSpan={7} className="px-3 py-4 text-neutral-500">Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-4 text-neutral-500">No models found.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="hover:bg-neutral-50">
                  <td className="px-3 py-2 text-neutral-500 font-mono text-xs">{r.id}</td>
                  <td className="px-3 py-2">
                    {editId === r.id ? (
                      <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="border border-neutral-300 rounded px-2 py-1 text-sm w-full" />
                    ) : (
                      <span className="text-neutral-700 font-medium">{r.name}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editId === r.id ? (
                      <select value={editProviderId ?? ""} onChange={(e) => setEditProviderId(e.target.value ? Number(e.target.value) : null)} className="text-xs border border-neutral-300 rounded px-1 py-1 bg-white">
                        <option value="">None</option>
                        {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    ) : r.llm_provider_id ? (
                      <FkLink label={getProviderName(r.llm_provider_id)} id={String(r.llm_provider_id)} section="llm_providers" field="id" navigateTo={navigateTo} />
                    ) : (
                      <span className="text-neutral-400 text-xs">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editId === r.id ? (
                      <input type="text" value={editProviderModelId} onChange={(e) => setEditProviderModelId(e.target.value)} className="border border-neutral-300 rounded px-2 py-1 text-sm w-full" />
                    ) : (
                      <span className="text-neutral-600 text-xs font-mono">{r.provider_model_id ?? "-"}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editId === r.id ? (
                      <input type="checkbox" checked={editTempSupported} onChange={(e) => setEditTempSupported(e.target.checked)} />
                    ) : (
                      <span className={r.is_temperature_supported ? "text-green-600 text-xs font-medium" : "text-neutral-400 text-xs"}>
                        {r.is_temperature_supported ? "Yes" : "No"}
                      </span>
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
                    ) : deleteId === r.id ? (
                      <div className="flex gap-2">
                        <button onClick={() => handleDelete(r.id)} className="text-xs text-red-600 hover:underline cursor-pointer">Confirm</button>
                        <button onClick={() => setDeleteId(null)} className="text-xs text-neutral-400 hover:underline cursor-pointer">Cancel</button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button onClick={() => startEdit(r)} className="text-xs text-blue-600 hover:underline cursor-pointer">Edit</button>
                        <button onClick={() => setDeleteId(r.id)} className="text-xs text-red-500 hover:underline cursor-pointer">Delete</button>
                      </div>
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
