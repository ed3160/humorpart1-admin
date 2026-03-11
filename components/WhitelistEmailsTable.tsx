"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { NavFilter } from "./AdminShell";

interface WhitelistEmail {
  id: number;
  email_address: string;
  created_datetime_utc: string;
  modified_datetime_utc: string | null;
}

const PAGE_SIZE = 25;
type SortField = "created_datetime_utc" | "email_address";
type SortDir = "asc" | "desc";

export default function WhitelistEmailsTable({ filter }: { navigateTo: (section: string, filter?: NavFilter) => void; filter: NavFilter | null }) {
  const [rows, setRows] = useState<WhitelistEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [sortField, setSortField] = useState<SortField>("created_datetime_utc");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Create
  const [newEmail, setNewEmail] = useState("");
  const [creating, setCreating] = useState(false);

  // Edit
  const [editId, setEditId] = useState<number | null>(null);
  const [editEmail, setEditEmail] = useState("");

  // Delete
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    let query = supabase
      .from("whitelist_email_addresses")
      .select("id, email_address, created_datetime_utc, modified_datetime_utc", { count: "exact" });

    if (filter?.field === "id") query = query.eq("id", filter.value);

    const { data, count } = await query
      .order(sortField, { ascending: sortDir === "asc" })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
      .limit(PAGE_SIZE);

    setRows((data ?? []) as WhitelistEmail[]);
    setTotal(count ?? 0);
    setLoading(false);
  }, [page, sortField, sortDir, filter]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const handleCreate = async () => {
    if (!newEmail.trim()) return;
    setCreating(true);
    const supabase = createClient();
    await supabase.from("whitelist_email_addresses").insert({ email_address: newEmail.trim() });
    setNewEmail("");
    setCreating(false);
    fetchRows();
  };

  const handleUpdate = async (id: number) => {
    const supabase = createClient();
    await supabase.from("whitelist_email_addresses").update({ email_address: editEmail.trim() }).eq("id", id);
    setEditId(null);
    fetchRows();
  };

  const handleDelete = async (id: number) => {
    const supabase = createClient();
    await supabase.from("whitelist_email_addresses").delete().eq("id", id);
    setDeleteId(null);
    fetchRows();
  };

  const startEdit = (row: WhitelistEmail) => {
    setEditId(row.id);
    setEditEmail(row.email_address);
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
      <h2 className="text-xl font-bold text-neutral-900 mb-4">Whitelisted Emails</h2>

      {/* Create form */}
      <div className="bg-white rounded-lg border border-neutral-200 p-4 mb-4">
        <h3 className="text-sm font-semibold text-neutral-700 mb-2">Add Email</h3>
        <div className="flex items-center gap-2">
          <input type="email" placeholder="user@example.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="border border-neutral-300 rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-neutral-400" />
          <button onClick={handleCreate} disabled={creating || !newEmail.trim()} className="bg-neutral-900 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-neutral-800 disabled:opacity-40 cursor-pointer disabled:cursor-default">Add</button>
        </div>
      </div>

      <span className="text-xs text-neutral-400 mb-4 block">{total} emails</span>

      <div className="bg-white rounded-lg border border-neutral-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-200">
              <th className="text-left px-3 py-2 font-medium text-neutral-600">ID</th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600 cursor-pointer hover:text-neutral-900 select-none whitespace-nowrap" onClick={() => toggleSort("email_address")}>Email{sortIcon("email_address")}</th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600 cursor-pointer hover:text-neutral-900 select-none whitespace-nowrap" onClick={() => toggleSort("created_datetime_utc")}>Created{sortIcon("created_datetime_utc")}</th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading ? (
              <tr><td colSpan={4} className="px-3 py-4 text-neutral-500">Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={4} className="px-3 py-4 text-neutral-500">No emails found.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="hover:bg-neutral-50">
                  <td className="px-3 py-2 text-neutral-500 font-mono text-xs">{r.id}</td>
                  <td className="px-3 py-2">
                    {editId === r.id ? (
                      <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="border border-neutral-300 rounded px-2 py-1 text-sm w-full" />
                    ) : (
                      <span className="text-neutral-700">{r.email_address}</span>
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
