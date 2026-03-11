"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Stats {
  images: number;
  captions: number;
  profiles: number;
  votes: number;
}

interface RecentCaption {
  id: string;
  content: string;
  created_datetime_utc: string;
}

import type { NavFilter } from "./AdminShell";

export default function Dashboard({ navigateTo }: { navigateTo: (section: "profiles" | "images" | "captions", filter?: NavFilter) => void }) {
  const [stats, setStats] = useState<Stats>({
    images: 0,
    captions: 0,
    profiles: 0,
    votes: 0,
  });
  const [recentCaptions, setRecentCaptions] = useState<RecentCaption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();

      const [imagesRes, captionsRes, profilesRes, votesRes, recentRes] =
        await Promise.all([
          supabase.from("images").select("*", { count: "exact", head: true }),
          supabase.from("captions").select("*", { count: "exact", head: true }),
          supabase.from("profiles").select("*", { count: "exact", head: true }),
          supabase.from("caption_votes").select("*", { count: "exact", head: true }),
          supabase
            .from("captions")
            .select("id, content, created_datetime_utc")
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

      setRecentCaptions(recentRes.data ?? []);
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

      <h3 className="text-lg font-semibold text-neutral-900 mb-3">
        Recent Captions
      </h3>
      <div className="bg-white rounded-lg border border-neutral-200 divide-y divide-neutral-100">
        {recentCaptions.length === 0 ? (
          <div className="p-4 text-neutral-500 text-sm">
            No captions found.
          </div>
        ) : (
          recentCaptions.map((caption) => (
            <div key={caption.id} className="p-3 flex justify-between gap-4">
              <span className="text-sm text-neutral-700 truncate flex-1">
                {caption.content}
              </span>
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
