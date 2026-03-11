"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { NavFilter } from "./AdminShell";
import FkLink from "./FkLink";

interface ImageRow {
  id: string;
  url: string;
  profile_id: string;
  is_public: boolean;
  created_datetime_utc: string;
}

const API_BASE = "https://api.almostcrackd.ai";
const ACCEPTED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/heic"];
const PAGE_SIZE = 25;

type UploadStep = "idle" | "uploading" | "registering" | "generating" | "done" | "error";
const STEP_LABELS: Record<UploadStep, string> = {
  idle: "",
  uploading: "Uploading...",
  registering: "Processing...",
  generating: "Generating captions...",
  done: "Done",
  error: "Failed",
};

type SortField = "created_datetime_utc" | "is_public";
type SortDir = "asc" | "desc";

export default function ImagesTable({ navigateTo, filter }: { navigateTo: (section: "profiles" | "images" | "captions", filter?: NavFilter) => void; filter: NavFilter | null }) {
  const [images, setImages] = useState<ImageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [sortField, setSortField] = useState<SortField>("created_datetime_utc");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filterPublic, setFilterPublic] = useState<"all" | "yes" | "no">("all");

  // Preview
  const [previewImg, setPreviewImg] = useState<ImageRow | null>(null);

  // Create form
  const [newUrl, setNewUrl] = useState("");
  const [newIsPublic, setNewIsPublic] = useState(false);
  const [creating, setCreating] = useState(false);

  // Upload state
  const [uploadStep, setUploadStep] = useState<UploadStep>("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadCaptions, setUploadCaptions] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState("");
  const [editIsPublic, setEditIsPublic] = useState(false);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchImages = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    let query = supabase
      .from("images")
      .select("id, url, profile_id, is_public, created_datetime_utc", { count: "exact" })
      .order(sortField, { ascending: sortDir === "asc" });

    if (filterPublic === "yes") query = query.eq("is_public", true);
    if (filterPublic === "no") query = query.eq("is_public", false);
    if (filter?.field === "profile_id") query = query.eq("profile_id", filter.value);

    const { data, count } = await query
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
      .limit(PAGE_SIZE);

    setImages(data ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  }, [page, sortField, sortDir, filterPublic, filter]);

  useEffect(() => { fetchImages(); }, [fetchImages]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
    setPage(0);
  };

  const sortIcon = (field: SortField) => {
    if (sortField !== field) return "";
    return sortDir === "asc" ? " ^" : " v";
  };

  const handleCreate = async () => {
    if (!newUrl.trim()) return;
    setCreating(true);
    const supabase = createClient();
    await supabase.from("images").insert({ url: newUrl.trim(), is_public: newIsPublic });
    setNewUrl("");
    setNewIsPublic(false);
    setCreating(false);
    fetchImages();
  };

  const handleUpdate = async (id: string) => {
    const supabase = createClient();
    await supabase.from("images").update({ url: editUrl, is_public: editIsPublic }).eq("id", id);
    setEditId(null);
    fetchImages();
  };

  const handleDelete = async (id: string) => {
    const supabase = createClient();
    await supabase.from("images").delete().eq("id", id);
    setDeleteId(null);
    fetchImages();
  };

  const handleUpload = async (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setUploadError("Unsupported file type");
      return;
    }
    setUploadError(null);
    setUploadCaptions([]);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { setUploadError("Not authenticated"); return; }

      setUploadStep("uploading");
      const presignedRes = await fetch(`${API_BASE}/pipeline/generate-presigned-url`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type }),
      });
      if (!presignedRes.ok) throw new Error(await presignedRes.text());
      const { presignedUrl, cdnUrl } = await presignedRes.json();

      await fetch(presignedUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });

      setUploadStep("registering");
      const registerRes = await fetch(`${API_BASE}/pipeline/upload-image-from-url`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: cdnUrl, isCommonUse: false }),
      });
      if (!registerRes.ok) throw new Error(await registerRes.text());
      const { imageId } = await registerRes.json();

      setUploadStep("generating");
      const captionRes = await fetch(`${API_BASE}/pipeline/generate-captions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ imageId }),
      });
      if (!captionRes.ok) throw new Error(await captionRes.text());
      const captionData = await captionRes.json();
      const list = Array.isArray(captionData) ? captionData : captionData.captions ?? [captionData];
      setUploadCaptions(list.map((c: Record<string, unknown>) => String(c.content ?? c.caption_text ?? c.text ?? "")));
      setUploadStep("done");
      fetchImages();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
      setUploadStep("error");
    }
  };

  const startEdit = (img: ImageRow) => {
    setEditId(img.id);
    setEditUrl(img.url);
    setEditIsPublic(img.is_public);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <h2 className="text-xl font-bold text-neutral-900 mb-4">Images</h2>

      {/* Actions row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Add by URL */}
        <div className="bg-white rounded-lg border border-neutral-200 p-4">
          <h3 className="text-sm font-semibold text-neutral-700 mb-2">Add by URL</h3>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="https://..."
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              className="border border-neutral-300 rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-neutral-400"
            />
            <label className="flex items-center gap-1.5 text-xs text-neutral-600 whitespace-nowrap">
              <input type="checkbox" checked={newIsPublic} onChange={(e) => setNewIsPublic(e.target.checked)} />
              Public
            </label>
            <button
              onClick={handleCreate}
              disabled={creating || !newUrl.trim()}
              className="bg-neutral-900 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-neutral-800 disabled:opacity-40 cursor-pointer disabled:cursor-default"
            >
              Add
            </button>
          </div>
        </div>

        {/* Upload file */}
        <div className="bg-white rounded-lg border border-neutral-200 p-4">
          <h3 className="text-sm font-semibold text-neutral-700 mb-2">Upload + Generate Captions</h3>
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES.join(",")}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
              className="text-sm text-neutral-600 file:mr-2 file:rounded-lg file:border-0 file:bg-neutral-900 file:text-white file:px-3 file:py-1.5 file:text-xs file:font-medium file:cursor-pointer"
            />
            {uploadStep !== "idle" && (
              <span className={`text-xs font-medium whitespace-nowrap ${
                uploadStep === "done" ? "text-green-600" : uploadStep === "error" ? "text-red-600" : "text-neutral-500"
              }`}>{STEP_LABELS[uploadStep]}</span>
            )}
          </div>
          {uploadError && <p className="text-xs text-red-600 mt-2">{uploadError}</p>}
          {uploadCaptions.length > 0 && (
            <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
              {uploadCaptions.map((c, i) => (
                <p key={i} className="text-xs text-neutral-700 bg-neutral-50 rounded px-2 py-1">{c}</p>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      {filter && (
        <div className="flex items-center gap-2 mb-3 p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
          Filtered by {filter.field}: <code className="bg-blue-100 px-1 rounded">{filter.value.slice(0, 12)}...</code>
          <button onClick={() => navigateTo("images")} className="ml-auto text-blue-500 hover:text-blue-700 underline cursor-pointer">Clear</button>
        </div>
      )}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-xs text-neutral-500">Filter:</span>
        <select
          value={filterPublic}
          onChange={(e) => { setFilterPublic(e.target.value as "all" | "yes" | "no"); setPage(0); }}
          className="text-xs border border-neutral-300 rounded-lg px-2 py-1.5 bg-white text-neutral-700"
        >
          <option value="all">All</option>
          <option value="yes">Public only</option>
          <option value="no">Private only</option>
        </select>
        <span className="text-xs text-neutral-400 ml-auto">{total} images</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-neutral-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-200">
              <th className="text-left px-3 py-2 font-medium text-neutral-600">Image</th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">URL</th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">Profile</th>
              <th
                className="text-left px-3 py-2 font-medium text-neutral-600 cursor-pointer hover:text-neutral-900 select-none"
                onClick={() => toggleSort("is_public")}
              >
                Public{sortIcon("is_public")}
              </th>
              <th
                className="text-left px-3 py-2 font-medium text-neutral-600 cursor-pointer hover:text-neutral-900 select-none"
                onClick={() => toggleSort("created_datetime_utc")}
              >
                Created{sortIcon("created_datetime_utc")}
              </th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {loading ? (
              <tr><td colSpan={6} className="px-3 py-4 text-neutral-500">Loading...</td></tr>
            ) : images.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-4 text-neutral-500">No images found.</td></tr>
            ) : (
              images.map((img) => (
                <tr key={img.id} className="hover:bg-neutral-50">
                  <td className="px-3 py-2">
                    {img.url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={img.url}
                        alt=""
                        className="w-16 h-16 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setPreviewImg(img)}
                      />
                    ) : (
                      <div className="w-16 h-16 bg-neutral-100 rounded-lg flex items-center justify-center text-neutral-400 text-xs">N/A</div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {editId === img.id ? (
                      <input
                        type="text"
                        value={editUrl}
                        onChange={(e) => setEditUrl(e.target.value)}
                        className="border border-neutral-300 rounded px-2 py-1 text-sm w-full"
                      />
                    ) : (
                      <span className="text-neutral-700 truncate block max-w-[200px]" title={img.url}>{img.url}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {img.profile_id ? (
                      <FkLink label={img.profile_id.slice(0, 8) + "..."} id={img.profile_id} section="profiles" field="id" navigateTo={navigateTo} />
                    ) : "-"}
                  </td>
                  <td className="px-3 py-2">
                    {editId === img.id ? (
                      <input type="checkbox" checked={editIsPublic} onChange={(e) => setEditIsPublic(e.target.checked)} />
                    ) : (
                      <span className={img.is_public ? "text-green-600 text-xs font-medium" : "text-neutral-400 text-xs"}>
                        {img.is_public ? "Yes" : "No"}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-neutral-500 text-xs whitespace-nowrap">
                    {new Date(img.created_datetime_utc).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2">
                    {editId === img.id ? (
                      <div className="flex gap-2">
                        <button onClick={() => handleUpdate(img.id)} className="text-xs text-green-600 hover:underline cursor-pointer">Save</button>
                        <button onClick={() => setEditId(null)} className="text-xs text-neutral-400 hover:underline cursor-pointer">Cancel</button>
                      </div>
                    ) : deleteId === img.id ? (
                      <div className="flex gap-2">
                        <button onClick={() => handleDelete(img.id)} className="text-xs text-red-600 hover:underline cursor-pointer">Confirm</button>
                        <button onClick={() => setDeleteId(null)} className="text-xs text-neutral-400 hover:underline cursor-pointer">Cancel</button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button onClick={() => startEdit(img)} className="text-xs text-blue-600 hover:underline cursor-pointer">Edit</button>
                        <button onClick={() => setDeleteId(img.id)} className="text-xs text-red-500 hover:underline cursor-pointer">Delete</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center gap-2 mt-4 text-sm">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1 rounded border border-neutral-300 disabled:opacity-40 hover:bg-neutral-100 cursor-pointer disabled:cursor-default"
          >
            Prev
          </button>
          <span className="text-neutral-500">Page {page + 1} of {totalPages}</span>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 rounded border border-neutral-300 disabled:opacity-40 hover:bg-neutral-100 cursor-pointer disabled:cursor-default"
          >
            Next
          </button>
        </div>
      )}

      {/* Image preview modal */}
      {previewImg && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-8"
          onClick={() => setPreviewImg(null)}
        >
          <div className="max-w-3xl max-h-[80vh] relative" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewImg.url} alt="" className="max-w-full max-h-[80vh] rounded-lg object-contain" />
            <button
              onClick={() => setPreviewImg(null)}
              className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm hover:bg-black/70 cursor-pointer"
            >
              X
            </button>
            <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-3 rounded-b-lg">
              <span className="font-mono">{previewImg.id}</span>
              <span className="mx-2">|</span>
              <span>{previewImg.is_public ? "Public" : "Private"}</span>
              <span className="mx-2">|</span>
              <span>{new Date(previewImg.created_datetime_utc).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
