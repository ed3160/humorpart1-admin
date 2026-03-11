"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import { createClient } from "@/lib/supabase/client";
import type { NavFilter } from "./AdminShell";
import FkLink from "./FkLink";

interface Caption {
  id: string;
  content: string;
  image_id: string;
  profile_id: string;
  is_public: boolean;
  created_datetime_utc: string;
  humor_flavor_id: number | null;
  like_count: number | null;
  is_featured: boolean | null;
  caption_request_id: string | null;
}

interface ImageInfo {
  id: string;
  url: string;
}

interface VoteRow {
  vote_value: number;
}

const PAGE_SIZE = 25;
type SortField = "created_datetime_utc" | "is_public";
type SortDir = "asc" | "desc";

export default function CaptionsTable({ navigateTo, filter }: { navigateTo: (section: string, filter?: NavFilter) => void; filter: NavFilter | null }) {
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [total, setTotal] = useState(0);
  const [sortField, setSortField] = useState<SortField>("created_datetime_utc");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filterPublic, setFilterPublic] = useState<"all" | "yes" | "no">("all");

  // Expandable detail
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailImage, setDetailImage] = useState<ImageInfo | null>(null);
  const [detailVotes, setDetailVotes] = useState<{ up: number; down: number }>({ up: 0, down: 0 });
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchCaptions = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    let query = supabase
      .from("captions")
      .select("id, content, image_id, profile_id, is_public, created_datetime_utc, humor_flavor_id, like_count, is_featured, caption_request_id", { count: "exact" })
      .not("content", "is", null);

    if (search.trim()) query = query.ilike("content", `%${search.trim()}%`);
    if (filterPublic === "yes") query = query.eq("is_public", true);
    if (filterPublic === "no") query = query.eq("is_public", false);
    if (filter?.field === "image_id") query = query.eq("image_id", filter.value);
    if (filter?.field === "profile_id") query = query.eq("profile_id", filter.value);

    const { data, count } = await query
      .order(sortField, { ascending: sortDir === "asc" })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
      .limit(PAGE_SIZE);

    setCaptions(data ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  }, [page, search, sortField, sortDir, filterPublic, filter]);

  useEffect(() => { fetchCaptions(); }, [fetchCaptions]);

  const fetchDetail = useCallback(async (caption: Caption) => {
    setDetailLoading(true);
    setDetailImage(null);
    setDetailVotes({ up: 0, down: 0 });
    const supabase = createClient();

    // Fetch linked image
    if (caption.image_id) {
      const { data: imgData } = await supabase
        .from("images")
        .select("id, url")
        .eq("id", caption.image_id)
        .single();
      if (imgData) setDetailImage(imgData as ImageInfo);
    }

    // Fetch votes
    const { data: votesData } = await supabase
      .from("caption_votes")
      .select("vote_value")
      .eq("caption_id", caption.id);

    let up = 0;
    let down = 0;
    for (const v of (votesData ?? []) as VoteRow[]) {
      if (v.vote_value === 1) up++;
      else if (v.vote_value === -1) down++;
    }
    setDetailVotes({ up, down });
    setDetailLoading(false);
  }, []);

  const toggleExpand = (caption: Caption) => {
    if (expandedId === caption.id) {
      setExpandedId(null);
    } else {
      setExpandedId(caption.id);
      fetchDetail(caption);
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
      <h2 className="text-xl font-bold text-neutral-900 mb-4">Captions</h2>

      {filter && (
        <div className="flex items-center gap-2 mb-3 p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
          Filtered by {filter.field}: <code className="bg-blue-100 px-1 rounded">{filter.value.slice(0, 12)}...</code>
          <button onClick={() => navigateTo("captions")} className="ml-auto text-blue-500 hover:text-blue-700 underline cursor-pointer">Clear</button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by content..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          className="border border-neutral-300 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-neutral-400"
        />
        <select
          value={filterPublic}
          onChange={(e) => { setFilterPublic(e.target.value as "all" | "yes" | "no"); setPage(0); }}
          className="text-xs border border-neutral-300 rounded-lg px-2 py-1.5 bg-white text-neutral-700"
        >
          <option value="all">All visibility</option>
          <option value="yes">Public only</option>
          <option value="no">Private only</option>
        </select>
        <span className="text-xs text-neutral-400 ml-auto">{total} captions</span>
      </div>

      <div className="bg-white rounded-lg border border-neutral-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-200">
              <th className="text-left px-3 py-2 font-medium text-neutral-600 w-6"></th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">Content</th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">Image ID</th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">Profile</th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">Flavor</th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">Likes</th>
              <th
                className="text-left px-3 py-2 font-medium text-neutral-600 cursor-pointer hover:text-neutral-900 select-none whitespace-nowrap"
                onClick={() => toggleSort("is_public")}
              >
                Public{sortIcon("is_public")}
              </th>
              <th className="text-left px-3 py-2 font-medium text-neutral-600">Featured</th>
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
              <tr><td colSpan={9} className="px-3 py-4 text-neutral-500">Loading...</td></tr>
            ) : captions.length === 0 ? (
              <tr><td colSpan={9} className="px-3 py-4 text-neutral-500">No captions found.</td></tr>
            ) : (
              captions.map((c) => (
                <Fragment key={c.id}>
                  <tr className="hover:bg-neutral-50 cursor-pointer" onClick={() => toggleExpand(c)}>
                    <td className="px-3 py-2 text-neutral-400 text-xs">
                      {expandedId === c.id ? "v" : ">"}
                    </td>
                    <td className="px-3 py-2 text-neutral-700 max-w-md truncate" title={c.content}>{c.content}</td>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      {c.image_id ? <FkLink label={c.image_id.slice(0, 8) + "..."} id={c.image_id} section="images" field="id" navigateTo={navigateTo} /> : "-"}
                    </td>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      {c.profile_id ? <FkLink label={c.profile_id.slice(0, 8) + "..."} id={c.profile_id} section="profiles" field="id" navigateTo={navigateTo} /> : "-"}
                    </td>
                    <td className="px-3 py-2 text-xs text-neutral-500 font-mono">
                      {c.humor_flavor_id ?? "-"}
                    </td>
                    <td className="px-3 py-2 text-xs text-neutral-600">{c.like_count ?? 0}</td>
                    <td className="px-3 py-2">
                      <span className={c.is_public ? "text-green-600 text-xs font-medium" : "text-neutral-400 text-xs"}>
                        {c.is_public ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={c.is_featured ? "text-green-600 text-xs font-medium" : "text-neutral-400 text-xs"}>
                        {c.is_featured ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-neutral-500 text-xs whitespace-nowrap">
                      {new Date(c.created_datetime_utc).toLocaleDateString()}
                    </td>
                  </tr>

                  {/* Expanded detail row */}
                  {expandedId === c.id && (
                    <tr>
                      <td colSpan={9} className="p-0">
                        <div className="bg-neutral-50 border-t border-neutral-200 p-5">
                          {detailLoading ? (
                            <p className="text-sm text-neutral-500">Loading details...</p>
                          ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                              {/* Left: Linked Image */}
                              <div>
                                <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Linked Image</h4>
                                {detailImage ? (
                                  <div>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={detailImage.url} alt="" className="w-[160px] h-[160px] object-cover rounded-lg" />
                                    <p className="text-xs text-neutral-400 mt-2 font-mono break-all">{detailImage.id}</p>
                                    <p className="text-xs text-neutral-400 mt-1 break-all">{detailImage.url}</p>
                                  </div>
                                ) : (
                                  <p className="text-sm text-neutral-400 italic">No linked image</p>
                                )}
                              </div>

                              {/* Middle: Full caption content */}
                              <div className="space-y-3">
                                <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Caption Details</h4>
                                <div>
                                  <span className="text-xs font-medium text-neutral-500">Full Content</span>
                                  <p className="text-sm text-neutral-800 mt-0.5 whitespace-pre-wrap">{c.content}</p>
                                </div>
                                <div>
                                  <span className="text-xs font-medium text-neutral-500">Caption ID</span>
                                  <p className="text-xs text-neutral-600 font-mono mt-0.5">{c.id}</p>
                                </div>
                                {c.caption_request_id && (
                                  <div>
                                    <span className="text-xs font-medium text-neutral-500">Caption Request ID</span>
                                    <p className="text-xs text-neutral-600 font-mono mt-0.5">{c.caption_request_id}</p>
                                  </div>
                                )}
                                <div className="flex gap-4">
                                  <div>
                                    <span className="text-xs font-medium text-neutral-500">Humor Flavor</span>
                                    <p className="text-xs text-neutral-600 font-mono mt-0.5">{c.humor_flavor_id || "None"}</p>
                                  </div>
                                  <div>
                                    <span className="text-xs font-medium text-neutral-500">Like Count</span>
                                    <p className="text-sm text-neutral-800 mt-0.5">{c.like_count ?? 0}</p>
                                  </div>
                                </div>
                                <div className="flex gap-4">
                                  <div>
                                    <span className="text-xs font-medium text-neutral-500">Featured</span>
                                    <p className="text-sm text-neutral-800 mt-0.5">{c.is_featured ? "Yes" : "No"}</p>
                                  </div>
                                  <div>
                                    <span className="text-xs font-medium text-neutral-500">Public</span>
                                    <p className="text-sm text-neutral-800 mt-0.5">{c.is_public ? "Yes" : "No"}</p>
                                  </div>
                                </div>
                              </div>

                              {/* Right: Vote summary */}
                              <div>
                                <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Votes</h4>
                                <div className="bg-white rounded-lg border border-neutral-200 p-4">
                                  <div className="flex items-center gap-6">
                                    <div className="text-center">
                                      <p className="text-2xl font-bold text-green-600">{detailVotes.up}</p>
                                      <p className="text-xs text-neutral-500 mt-1">Upvotes</p>
                                    </div>
                                    <div className="text-center">
                                      <p className="text-2xl font-bold text-red-500">{detailVotes.down}</p>
                                      <p className="text-xs text-neutral-500 mt-1">Downvotes</p>
                                    </div>
                                    <div className="text-center">
                                      <p className="text-2xl font-bold text-neutral-700">{detailVotes.up + detailVotes.down}</p>
                                      <p className="text-xs text-neutral-500 mt-1">Total</p>
                                    </div>
                                  </div>
                                  {(detailVotes.up + detailVotes.down) > 0 && (
                                    <div className="mt-3">
                                      <div className="w-full bg-neutral-200 rounded-full h-2">
                                        <div
                                          className="bg-green-500 h-2 rounded-full"
                                          style={{ width: `${(detailVotes.up / (detailVotes.up + detailVotes.down)) * 100}%` }}
                                        />
                                      </div>
                                      <p className="text-xs text-neutral-500 mt-1">
                                        {Math.round((detailVotes.up / (detailVotes.up + detailVotes.down)) * 100)}% positive
                                      </p>
                                    </div>
                                  )}
                                </div>
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
