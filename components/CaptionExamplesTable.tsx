"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import { createClient } from "@/lib/supabase/client";
import type { NavFilter } from "./AdminShell";

interface CaptionExample {
  id: number;
  image_description: string | null;
  caption: string | null;
  explanation: string | null;
  priority: number | null;
  image_id: string | null;
  created_datetime_utc: string;
  modified_datetime_utc: string | null;
}

const PAGE_SIZE = 25;
type SortField = "created_datetime_utc" | "priority";
type SortDir = "asc" | "desc";

export default function CaptionExamplesTable({ filter, userId }: { navigateTo: (section: string, filter?: NavFilter) => void; filter: NavFilter | null; userId: string }) {
  const [rows, setRows] = useState<CaptionExample[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [sortField, setSortField] = useState<SortField>("created_datetime_utc");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Create form
  const [newImageDescription, setNewImageDescription] = useState("");
  const [newCaption, setNewCaption] = useState("");
  const [newExplanation, setNewExplanation] = useState("");
  const [newPriority, setNewPriority] = useState<number>(0);
  const [creating, setCreating] = useState(false);

  // Edit
  const [editId, setEditId] = useState<number | null>(null);
  const [editImageDescription, setEditImageDescription] = useState("");
  const [editCaption, setEditCaption] = useState("");
  const [editExplanation, setEditExplanation] = useState("");
  const [editPriority, setEditPriority] = useState<number>(0);

  // Delete
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    let query = supabase
      .from("caption_examples")
      .select("id, image_description, caption, explanation, priority, image_id, created_datetime_utc, modified_datetime_utc", { count: "exact" });

    if (filter?.field === "image_id") query = query.eq("image_id", filter.value);

    const { data, count } = await query
      .order(sortField, { ascending: sortDir === "asc" })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
      .limit(PAGE_SIZE);

    setRows((data ?? []) as CaptionExample[]);
    setTotal(count ?? 0);
    setLoading(false);
  }, [page, sortField, sortDir, filter]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const handleCreate = async () => {
    if (!newCaption.trim()) return;
    setCreating(true);
    const supabase = createClient();
    await supabase.from("caption_examples").insert({
      image_description: newImageDescription.trim() || null,
      caption: newCaption.trim(),
      explanation: newExplanation.trim() || null,
      priority: newPriority,
      created_by_user_id: userId,
      modified_by_user_id: userId,
    });
    setNewImageDescription(""); setNewCaption(""); setNewExplanation(""); setNewPriority(0);
    setCreating(false);
    fetchRows();
  };

  const handleUpdate = async (id: number) => {
    const supabase = createClient();
    await supabase.from("caption_examples").update({
      image_description: editImageDescription.trim() || null,
      caption: editCaption.trim(),
      explanation: editExplanation.trim() || null,
      priority: editPriority,
      modified_by_user_id: userId,
    }).eq("id", id);
    setEditId(null);
    fetchRows();
  };

  const handleDelete = async (id: number) => {
    const supabase = createClient();
    await supabase.from("caption_examples").delete().eq("id", id);
    setDeleteId(null);
    fetchRows();
  };

  const startEdit = (row: CaptionExample) => {
    setEditId(row.id);
    setEditImageDescription(row.image_description ?? "");
    setEditCaption(row.caption ?? "");
    setEditExplanation(row.explanation ?? "");
    setEditPriority(row.priority ?? 0);
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
      <h2 className="text-xl font-bold text-neutral-900 mb-4">Caption Examples</h2>

      {/* Create form */}
      <div className="bg-white rounded-lg border border-neutral-200 p-4 mb-4">
        <h3 className="text-sm font-semibold text-neutral-700 mb-2">Add Caption Example</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
          <input type="text" placeholder="Image description" value={newImageDescription} onChange={(e) => setNewImageDescription(e.target.value)} className="border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400" />
          <input type="text" placeholder="Caption" value={newCaption} onChange={(e) => setNewCaption(e.target.value)} className="border border-neutral-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-400" />
        </div>
        <div className="flex items-center gap-2">
          <input type="text" placeholder="Explanation" value={newExplanation} onChange={(e) => setNewExplanation(e.target.value)} className="border border-neutral-300 rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-neutral-400" />
          <input type="number" placeholder="Priority" value={newPriority} onChange={(e) => setNewPriority(Number(e.target.value))} className="border border-neutral-300 rounded-lg px-3 py-2 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-neutral-400" />
          <button onClick={handleCreate} disabled={creating || !newCaption.trim()} className="bg-neutral-900 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-neutral-800 disabled:opacity-40 cursor-pointer disabled:cursor-default">Add</button>
        </div>
      </div>

      <span className="text-xs text-neutral-400 mb-4 block">{total} examples</span>

      <div className="bg-white rounded-lg border border-neutral-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-200">
              <th className="text-left px-3 py-2 font-medium text-neutral-600 w-6"></th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">ID</th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">Image Desc</th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">Caption</th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600 cursor-pointer hover:text-neutral-900 select-none whitespace-nowrap" onClick={() => toggleSort("priority")}>Priority{sortIcon("priority")}</th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600 cursor-pointer hover:text-neutral-900 select-none whitespace-nowrap" onClick={() => toggleSort("created_datetime_utc")}>Created{sortIcon("created_datetime_utc")}</th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading ? (
              <tr><td colSpan={7} className="px-3 py-4 text-neutral-500">Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-4 text-neutral-500">No examples found.</td></tr>
            ) : (
              rows.map((r) => (
                <Fragment key={r.id}>
                  <tr className="hover:bg-neutral-50 cursor-pointer" onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}>
                    <td className="px-3 py-2 text-neutral-400 text-xs">{expandedId === r.id ? "v" : ">"}</td>
                    <td className="px-3 py-2 text-neutral-500 font-mono text-xs">{r.id}</td>
                    <td className="px-3 py-2">
                      {editId === r.id ? (
                        <input type="text" value={editImageDescription} onChange={(e) => setEditImageDescription(e.target.value)} onClick={(e) => e.stopPropagation()} className="border border-neutral-300 rounded px-2 py-1 text-sm w-full" />
                      ) : (
                        <span className="text-neutral-600 max-w-[150px] truncate block">{r.image_description ?? "-"}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {editId === r.id ? (
                        <input type="text" value={editCaption} onChange={(e) => setEditCaption(e.target.value)} onClick={(e) => e.stopPropagation()} className="border border-neutral-300 rounded px-2 py-1 text-sm w-full" />
                      ) : (
                        <span className="text-neutral-700 max-w-[200px] truncate block">{r.caption ?? "-"}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {editId === r.id ? (
                        <input type="number" value={editPriority} onChange={(e) => setEditPriority(Number(e.target.value))} onClick={(e) => e.stopPropagation()} className="border border-neutral-300 rounded px-2 py-1 text-sm w-16" />
                      ) : (
                        <span className="text-neutral-600 text-xs">{r.priority ?? 0}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-neutral-500 text-xs whitespace-nowrap">
                      {new Date(r.created_datetime_utc).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
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
                  {expandedId === r.id && (
                    <tr>
                      <td colSpan={7} className="p-0">
                        <div className="bg-neutral-50 border-t border-neutral-200 p-5 space-y-3">
                          <div>
                            <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1">Full Image Description</h4>
                            <p className="text-sm text-neutral-700 whitespace-pre-wrap">{r.image_description || <span className="text-neutral-400 italic">None</span>}</p>
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1">Full Caption</h4>
                            <p className="text-sm text-neutral-700 whitespace-pre-wrap">{r.caption || <span className="text-neutral-400 italic">None</span>}</p>
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1">Full Explanation</h4>
                            <p className="text-sm text-neutral-700 whitespace-pre-wrap">{r.explanation || <span className="text-neutral-400 italic">None</span>}</p>
                          </div>
                          {r.image_id && (
                            <div>
                              <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1">Image ID</h4>
                              <p className="text-xs font-mono text-neutral-600">{r.image_id}</p>
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
