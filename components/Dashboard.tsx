"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { NavFilter } from "./AdminShell";

interface Stats {
  images: number;
  captions: number;
  profiles: number;
  votes: number;
}

interface RecentCaption {
  id: string;
  content: string;
  image_id: string;
  created_datetime_utc: string;
}

interface TopVotedCaption {
  captionId: string;
  content: string;
  voteCount: number;
  imageUrl: string | null;
}

interface MostCaptionedImage {
  imageId: string;
  imageUrl: string | null;
  captionCount: number;
}

export default function Dashboard({ navigateTo }: { navigateTo: (section: "profiles" | "images" | "captions", filter?: NavFilter) => void }) {
  const [stats, setStats] = useState<Stats>({ images: 0, captions: 0, profiles: 0, votes: 0 });
  const [recentCaptions, setRecentCaptions] = useState<RecentCaption[]>([]);
  const [recentImageUrls, setRecentImageUrls] = useState<Record<string, string>>({});
  const [topVoted, setTopVoted] = useState<TopVotedCaption[]>([]);
  const [mostCaptioned, setMostCaptioned] = useState<MostCaptionedImage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();

      // Basic stats + recent captions (same as before)
      const [imagesRes, captionsRes, profilesRes, votesRes, recentRes] =
        await Promise.all([
          supabase.from("images").select("*", { count: "exact", head: true }),
          supabase.from("captions").select("*", { count: "exact", head: true }),
          supabase.from("profiles").select("*", { count: "exact", head: true }),
          supabase.from("caption_votes").select("*", { count: "exact", head: true }),
          supabase
            .from("captions")
            .select("id, content, image_id, created_datetime_utc")
            .not("content", "is", null)
            .order("created_datetime_utc", { ascending: false })
            .limit(10),
        ]);

      setStats({
        images: imagesRes.count ?? 0,
        captions: captionsRes.count ?? 0,
        profiles: profilesRes.count ?? 0,
        votes: votesRes.count ?? 0,
      });

      const recent = (recentRes.data ?? []) as RecentCaption[];
      setRecentCaptions(recent);

      // Fetch image URLs for recent captions
      const recentImageIds = [...new Set(recent.map((c) => c.image_id).filter(Boolean))];
      if (recentImageIds.length > 0) {
        const { data: recentImgs } = await supabase
          .from("images")
          .select("id, url")
          .in("id", recentImageIds);
        const urlMap: Record<string, string> = {};
        for (const img of recentImgs ?? []) {
          urlMap[img.id] = img.url;
        }
        setRecentImageUrls(urlMap);
      }

      // --- Top Voted Captions ---
      // Step 1: Fetch all caption_votes (limited to a reasonable amount)
      const { data: allVotes } = await supabase
        .from("caption_votes")
        .select("caption_id")
        .limit(10000);

      if (allVotes && allVotes.length > 0) {
        // Step 2: Count votes per caption client-side
        const voteCounts: Record<string, number> = {};
        for (const v of allVotes) {
          voteCounts[v.caption_id] = (voteCounts[v.caption_id] || 0) + 1;
        }

        // Step 3: Get top 5 caption IDs by vote count
        const topCaptionIds = Object.entries(voteCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([id, count]) => ({ id, count }));

        if (topCaptionIds.length > 0) {
          // Step 4: Fetch those captions
          const { data: topCaps } = await supabase
            .from("captions")
            .select("id, content, image_id")
            .in("id", topCaptionIds.map((t) => t.id));

          // Step 5: Fetch images for those captions
          const topImageIds = [...new Set((topCaps ?? []).map((c) => c.image_id).filter(Boolean))];
          let topImageMap: Record<string, string> = {};
          if (topImageIds.length > 0) {
            const { data: topImgs } = await supabase
              .from("images")
              .select("id, url")
              .in("id", topImageIds);
            for (const img of topImgs ?? []) {
              topImageMap[img.id] = img.url;
            }
          }

          // Combine
          const topVotedList: TopVotedCaption[] = topCaptionIds
            .map(({ id, count }) => {
              const cap = (topCaps ?? []).find((c) => c.id === id);
              return {
                captionId: id,
                content: cap?.content ?? "",
                voteCount: count,
                imageUrl: cap?.image_id ? topImageMap[cap.image_id] ?? null : null,
              };
            })
            .filter((t) => t.content);
          setTopVoted(topVotedList);
        }
      }

      // --- Most Captioned Images ---
      // Fetch captions grouped by image_id (client-side grouping)
      const { data: allCaps } = await supabase
        .from("captions")
        .select("image_id")
        .not("content", "is", null)
        .not("image_id", "is", null)
        .limit(10000);

      if (allCaps && allCaps.length > 0) {
        const capCounts: Record<string, number> = {};
        for (const c of allCaps) {
          if (c.image_id) capCounts[c.image_id] = (capCounts[c.image_id] || 0) + 1;
        }

        const topImageEntries = Object.entries(capCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);

        const topImgIds = topImageEntries.map(([id]) => id);
        let imgUrlMap: Record<string, string> = {};
        if (topImgIds.length > 0) {
          const { data: imgs } = await supabase
            .from("images")
            .select("id, url")
            .in("id", topImgIds);
          for (const img of imgs ?? []) {
            imgUrlMap[img.id] = img.url;
          }
        }

        setMostCaptioned(
          topImageEntries.map(([id, count]) => ({
            imageId: id,
            imageUrl: imgUrlMap[id] ?? null,
            captionCount: count,
          }))
        );
      }

      setLoading(false);
    };

    fetchData();
  }, []);

  if (loading) {
    return <div className="text-neutral-500">Loading dashboard...</div>;
  }

  const statCards: { label: string; value: number; section?: "profiles" | "images" | "captions" }[] = [
    { label: "Images", value: stats.images, section: "images" },
    { label: "Captions", value: stats.captions, section: "captions" },
    { label: "Profiles", value: stats.profiles, section: "profiles" },
    { label: "Votes", value: stats.votes },
  ];

  return (
    <div>
      <h2 className="text-xl font-bold text-neutral-900 mb-6">Dashboard</h2>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((card) => (
          <div
            key={card.label}
            onClick={() => card.section && navigateTo(card.section)}
            className={`bg-white rounded-lg border border-neutral-200 p-4 ${card.section ? "cursor-pointer hover:border-neutral-400 transition-colors" : ""}`}
          >
            <div className="text-sm text-neutral-500 mb-1">{card.label}</div>
            <div className="text-2xl font-bold text-neutral-900">
              {card.value.toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {/* Two-column layout for top voted + most captioned */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Top Voted Captions */}
        <div>
          <h3 className="text-lg font-semibold text-neutral-900 mb-3">Top Voted Captions</h3>
          <div className="bg-white rounded-lg border border-neutral-200 divide-y divide-neutral-100">
            {topVoted.length === 0 ? (
              <div className="p-4 text-neutral-500 text-sm">No vote data available.</div>
            ) : (
              topVoted.map((item) => (
                <div key={item.captionId} className="p-3 flex items-start gap-3">
                  {item.imageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={item.imageUrl} alt="" className="w-10 h-10 object-cover rounded shrink-0" />
                  ) : (
                    <div className="w-10 h-10 bg-neutral-100 rounded shrink-0 flex items-center justify-center text-neutral-400 text-xs">--</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-neutral-700 truncate">{item.content}</p>
                    <p className="text-xs text-neutral-400 mt-0.5">{item.voteCount} vote{item.voteCount !== 1 ? "s" : ""}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Most Captioned Images */}
        <div>
          <h3 className="text-lg font-semibold text-neutral-900 mb-3">Most Captioned Images</h3>
          <div className="bg-white rounded-lg border border-neutral-200 divide-y divide-neutral-100">
            {mostCaptioned.length === 0 ? (
              <div className="p-4 text-neutral-500 text-sm">No data available.</div>
            ) : (
              mostCaptioned.map((item) => (
                <div key={item.imageId} className="p-3 flex items-center gap-3">
                  {item.imageUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={item.imageUrl} alt="" className="w-10 h-10 object-cover rounded shrink-0" />
                  ) : (
                    <div className="w-10 h-10 bg-neutral-100 rounded shrink-0 flex items-center justify-center text-neutral-400 text-xs">--</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-neutral-500 font-mono truncate">{item.imageId}</p>
                    <p className="text-xs text-neutral-400 mt-0.5">{item.captionCount} caption{item.captionCount !== 1 ? "s" : ""}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <h3 className="text-lg font-semibold text-neutral-900 mb-3">Recent Activity</h3>
      <div className="bg-white rounded-lg border border-neutral-200 divide-y divide-neutral-100">
        {recentCaptions.length === 0 ? (
          <div className="p-4 text-neutral-500 text-sm">No captions found.</div>
        ) : (
          recentCaptions.map((caption) => (
            <div key={caption.id} className="p-3 flex items-start gap-3">
              {caption.image_id && recentImageUrls[caption.image_id] ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={recentImageUrls[caption.image_id]} alt="" className="w-10 h-10 object-cover rounded shrink-0" />
              ) : (
                <div className="w-10 h-10 bg-neutral-100 rounded shrink-0 flex items-center justify-center text-neutral-400 text-xs">--</div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-neutral-700 truncate">{caption.content}</p>
              </div>
              <span className="text-xs text-neutral-400 shrink-0">
                {new Date(caption.created_datetime_utc).toLocaleDateString()}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
