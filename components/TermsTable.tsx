"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { NavFilter } from "./AdminShell";

interface Term {
  id: number;
  term: string;
  definition: string | null;
  example: string | null;
  priority: number | null;
  term_type_id: number | null;
  created_datetime_utc: string;
  modified_datetime_utc: string | null;
}

interface TermType {
  id: number;
  name: string;
}

const PAGE_SIZE = 25;
type SortField = "created_datetime_utc" | "term" | "priority";
type SortDir = "asc" | "desc";

export default function TermsTable({ filter, userId }: { navigateTo: (section: string, filter?: NavFilter) => void; filter: NavFilter | null; userId: string }) {
  const [rows, setRows] = useState<Term[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("created_datetime_utc");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [termTypes, setTermTypes] = useState<TermType[]>([]);

  // Create form
  const [newTerm, setNewTerm] = useState("");
  const [newDefinition, setNewDefinition] = useState("");
  const [newExample, setNewExample] = useState("");
  const [newPriority, setNewPriority] = useState<number>(0);
  const [newTermTypeId, setNewTermTypeId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  // Edit
  const [editId, setEditId] = useState<number | null>(null);
  const [editTerm, setEditTerm] = useState("");
  const [editDefinition, setEditDefinition] = useState("");
  const [editExample, setEditExample] = useState("");
  const [editPriority, setEditPriority] = useState<number>(0);
  const [editTermTypeId, setEditTermTypeId] = useState<number | null>(null);

  // Delete
  const [deleteId, setDeleteId] = useState<number | null>(null);

  useEffect(() => {
    const fetchTermTypes = async () => {
      const supabase = createClient();
      const { data } = await supabase.from("term_types").select("id, name").order("name");
      setTermTypes((data ?? []) as TermType[]);
    };
    fetchTermTypes();
  }, []);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    let query = supabase
      .from("terms")
      .select("id, term, definition, example, priority, term_type_id, created_datetime_utc, modified_datetime_utc", { count: "exact" });

    if (search.trim()) {
      query = query.or(`term.ilike.%${search.trim()}%,definition.ilike.%${search.trim()}%`);
    }
    if (filter?.field === "term_type_id") query = query.eq("term_type_id", filter.value);

    const { data, count } = await query
      .order(sortField, { ascending: sortDir === "asc" })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
      .limit(PAGE_SIZE);

    setRows((data ?? []) as Term[]);
    setTotal(count ?? 0);
    setLoading(false);
  }, [page, search, sortField, sortDir, filter]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const handleCreate = async () => {
    if (!newTerm.trim()) return;
    setCreating(true);
    const supabase = createClient();
    await supabase.from("terms").insert({
      term: newTerm.trim(),
      definition: newDefinition.trim() || null,
      example: newExample.trim() || null,
      priority: newPriority,
      term_type_id: newTermTypeId,
      created_by_user_id: userId,
      modified_by_user_id: userId,
    });
    setNewTerm(""); setNewDefinition(""); setNewExample(""); setNewPriority(0); setNewTermTypeId(null);
    setCreating(false);
    fetchRows();
  };

  const handleUpdate = async (id: number) => {
    const supabase = createClient();
    await supabase.from("terms").update({
      term: editTerm.trim(),
      definition: editDefinition.trim() || null,
      example: editExample.trim() || null,
      priority: editPriority,
      term_type_id: editTermTypeId,
      modified_by_user_id: userId,
    }).eq("id", id);
    setEditId(null);
    fetchRows();
  };

  const handleDelete = async (id: number) => {
    const supabase = createClient();
    await supabase.from("terms").delete().eq("id", id);
    setDeleteId(null);
    fetchRows();
  };

  const startEdit = (row: Term) => {
    setEditId(row.id);
    setEditTerm(row.term);
    setEditDefinition(row.definition ?? "");
    setEditExample(row.example ?? "");
    setEditPriority(row.priority ?? 0);
    setEditTermTypeId(row.term_type_id);
  };

  const getTermTypeName = (id: number | null) => {
    if (id === null) return "-";
    const t = termTypes.find((tt) => tt.id === id);
    return t ? t.name : String(id);
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
      <h2 className="text-xl font-bold text-neutral-900 mb-4">Terms</h2>

      {/* Create form */}
      <div className="bg-white rounded-lg border border-neutral-200 p-4 mb-4">
        <h3 className="text-sm font-semibold text-neutral-700 mb-2">Add Term</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
          <input type="text" placeholder="Term" value={newTerm} onChange={(e) => setNewTerm(e.target.value)} className="border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400" />
          <input type="text" placeholder="Definition" value={newDefinition} onChange={(e) => setNewDefinition(e.target.value)} className="border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400" />
          <input type="text" placeholder="Example" value={newExample} onChange={(e) => setNewExample(e.target.value)} className="border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400" />
        </div>
        <div className="flex items-center gap-2">
          <input type="number" placeholder="Priority" value={newPriority} onChange={(e) => setNewPriority(Number(e.target.value))} className="border border-neutral-300 rounded-lg px-3 py-2 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-neutral-400" />
          <select value={newTermTypeId ?? ""} onChange={(e) => setNewTermTypeId(e.target.value ? Number(e.target.value) : null)} className="text-sm border border-neutral-300 rounded-lg px-2 py-2 bg-white text-neutral-700">
            <option value="">No type</option>
            {termTypes.map((tt) => <option key={tt.id} value={tt.id}>{tt.name}</option>)}
          </select>
          <button onClick={handleCreate} disabled={creating || !newTerm.trim()} className="bg-neutral-900 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-neutral-800 disabled:opacity-40 cursor-pointer disabled:cursor-default">Add</button>
        </div>
      </div>

      {/* Search */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input type="text" placeholder="Search term/definition..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="border border-neutral-300 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-neutral-400" />
        <span className="text-xs text-neutral-400 ml-auto">{total} terms</span>
      </div>

      <div className="bg-white rounded-lg border border-neutral-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-200">
              <th className="text-left px-3 py-2 font-medium text-neutral-600">ID</th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600 cursor-pointer hover:text-neutral-900 select-none whitespace-nowrap" onClick={() => toggleSort("term")}>Term{sortIcon("term")}</th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">Definition</th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">Example</th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600 cursor-pointer hover:text-neutral-900 select-none whitespace-nowrap" onClick={() => toggleSort("priority")}>Priority{sortIcon("priority")}</th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">Type</th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600 cursor-pointer hover:text-neutral-900 select-none whitespace-nowrap" onClick={() => toggleSort("created_datetime_utc")}>Created{sortIcon("created_datetime_utc")}</th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading ? (
              <tr><td colSpan={8} className="px-3 py-4 text-neutral-500">Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-4 text-neutral-500">No terms found.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="hover:bg-neutral-50">
                  <td className="px-3 py-2 text-neutral-500 font-mono text-xs">{r.id}</td>
                  <td className="px-3 py-2">
                    {editId === r.id ? (
                      <input type="text" value={editTerm} onChange={(e) => setEditTerm(e.target.value)} className="border border-neutral-300 rounded px-2 py-1 text-sm w-full" />
                    ) : (
                      <span className="text-neutral-700 font-medium">{r.term}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editId === r.id ? (
                      <input type="text" value={editDefinition} onChange={(e) => setEditDefinition(e.target.value)} className="border border-neutral-300 rounded px-2 py-1 text-sm w-full" />
                    ) : (
                      <span className="text-neutral-600 max-w-xs truncate block">{r.definition ?? "-"}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editId === r.id ? (
                      <input type="text" value={editExample} onChange={(e) => setEditExample(e.target.value)} className="border border-neutral-300 rounded px-2 py-1 text-sm w-full" />
                    ) : (
                      <span className="text-neutral-600 max-w-xs truncate block">{r.example ?? "-"}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editId === r.id ? (
                      <input type="number" value={editPriority} onChange={(e) => setEditPriority(Number(e.target.value))} className="border border-neutral-300 rounded px-2 py-1 text-sm w-16" />
                    ) : (
                      <span className="text-neutral-600 text-xs">{r.priority ?? 0}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editId === r.id ? (
                      <select value={editTermTypeId ?? ""} onChange={(e) => setEditTermTypeId(e.target.value ? Number(e.target.value) : null)} className="text-xs border border-neutral-300 rounded px-1 py-1 bg-white">
                        <option value="">None</option>
                        {termTypes.map((tt) => <option key={tt.id} value={tt.id}>{tt.name}</option>)}
                      </select>
                    ) : (
                      <span className="text-neutral-600 text-xs">{getTermTypeName(r.term_type_id)}</span>
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
