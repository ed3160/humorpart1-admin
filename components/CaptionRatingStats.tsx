"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { NavFilter } from "./AdminShell";
import FkLink from "./FkLink";

interface Summary {
  totalVotes: number;
  upvotes: number;
  downvotes: number;
  neutralVotes: number;
  studyVotes: number;
  captionsRated: number;
  uniqueVoters: number;
  totalCaptions: number;
}

interface CaptionStat {
  id: string;
  content: string;
  image_id: string | null;
  imageUrl?: string | null;
  score: number;
  voteCount?: number;
  upCount?: number;
  downCount?: number;
}

interface VoterStat {
  profile_id: string;
  count: number;
  upCount: number;
  downCount: number;
}

interface DayBucket {
  day: string;
  up: number;
  down: number;
  total: number;
}

interface HistogramBucket {
  bucket: string;
  count: number;
}

const CHUNK_SIZE = 1000;
const CONTROVERSY_MIN_VOTES = 5;

export default function CaptionRatingStats({
  navigateTo,
}: {
  navigateTo: (section: string, filter?: NavFilter) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [topRated, setTopRated] = useState<CaptionStat[]>([]);
  const [worstRated, setWorstRated] = useState<CaptionStat[]>([]);
  const [mostRated, setMostRated] = useState<CaptionStat[]>([]);
  const [mostControversial, setMostControversial] = useState<CaptionStat[]>([]);
  const [topVoters, setTopVoters] = useState<VoterStat[]>([]);
  const [dailyBuckets, setDailyBuckets] = useState<DayBucket[]>([]);
  const [scoreHistogram, setScoreHistogram] = useState<HistogramBucket[]>([]);

  useEffect(() => {
    const run = async () => {
      try {
        const supabase = createClient();

        setProgress("Fetching summary counts...");
        const [totalRes, upRes, downRes, neutralRes, studyRes, totalCapsRes] =
          await Promise.all([
            supabase.from("caption_votes").select("*", { count: "exact", head: true }),
            supabase.from("caption_votes").select("*", { count: "exact", head: true }).gt("vote_value", 0),
            supabase.from("caption_votes").select("*", { count: "exact", head: true }).lt("vote_value", 0),
            supabase.from("caption_votes").select("*", { count: "exact", head: true }).eq("vote_value", 0),
            supabase.from("caption_votes").select("*", { count: "exact", head: true }).eq("is_from_study", true),
            supabase.from("captions").select("*", { count: "exact", head: true }),
          ]);

        const totalVotes = totalRes.count ?? 0;

        setProgress(`Fetching ${totalVotes.toLocaleString()} votes...`);
        const pageCount = Math.ceil(totalVotes / CHUNK_SIZE);
        const chunkPromises = [];
        for (let i = 0; i < pageCount; i++) {
          const from = i * CHUNK_SIZE;
          const to = from + CHUNK_SIZE - 1;
          chunkPromises.push(
            supabase
              .from("caption_votes")
              .select("caption_id, profile_id, vote_value, created_datetime_utc")
              .range(from, to)
          );
        }
        const chunkResults = await Promise.all(chunkPromises);
        const allVotes: {
          caption_id: string;
          profile_id: string;
          vote_value: number;
          created_datetime_utc: string;
        }[] = [];
        for (const r of chunkResults) {
          if (r.data) allVotes.push(...r.data);
        }

        setProgress("Aggregating...");
        const perCaption: Record<string, { count: number; up: number; down: number; score: number }> = {};
        const perVoter: Record<string, { count: number; up: number; down: number }> = {};
        const perDay: Record<string, { up: number; down: number; total: number }> = {};

        for (const v of allVotes) {
          if (!perCaption[v.caption_id]) perCaption[v.caption_id] = { count: 0, up: 0, down: 0, score: 0 };
          const cAgg = perCaption[v.caption_id];
          cAgg.count += 1;
          cAgg.score += v.vote_value;
          if (v.vote_value > 0) cAgg.up += 1;
          else if (v.vote_value < 0) cAgg.down += 1;

          if (!perVoter[v.profile_id]) perVoter[v.profile_id] = { count: 0, up: 0, down: 0 };
          const vAgg = perVoter[v.profile_id];
          vAgg.count += 1;
          if (v.vote_value > 0) vAgg.up += 1;
          else if (v.vote_value < 0) vAgg.down += 1;

          const day = v.created_datetime_utc.slice(0, 10);
          if (!perDay[day]) perDay[day] = { up: 0, down: 0, total: 0 };
          perDay[day].total += 1;
          if (v.vote_value > 0) perDay[day].up += 1;
          else if (v.vote_value < 0) perDay[day].down += 1;
        }

        setSummary({
          totalVotes,
          upvotes: upRes.count ?? 0,
          downvotes: downRes.count ?? 0,
          neutralVotes: neutralRes.count ?? 0,
          studyVotes: studyRes.count ?? 0,
          captionsRated: Object.keys(perCaption).length,
          uniqueVoters: Object.keys(perVoter).length,
          totalCaptions: totalCapsRes.count ?? 0,
        });

        setProgress("Fetching caption details...");
        const [topRes, botRes] = await Promise.all([
          supabase
            .from("captions")
            .select("id, content, image_id, like_count")
            .not("content", "is", null)
            .order("like_count", { ascending: false })
            .limit(10),
          supabase
            .from("captions")
            .select("id, content, image_id, like_count")
            .not("content", "is", null)
            .order("like_count", { ascending: true })
            .limit(10),
        ]);

        const topCapsRaw = topRes.data ?? [];
        const botCapsRaw = botRes.data ?? [];

        const mostRatedEntries = Object.entries(perCaption)
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, 10);

        const mostControversialEntries = Object.entries(perCaption)
          .filter(([, agg]) => agg.count >= CONTROVERSY_MIN_VOTES)
          .sort((a, b) => {
            const ra = Math.abs(a[1].score) / a[1].count;
            const rb = Math.abs(b[1].score) / b[1].count;
            if (ra !== rb) return ra - rb;
            return b[1].count - a[1].count;
          })
          .slice(0, 10);

        const extraIds = Array.from(
          new Set([
            ...mostRatedEntries.map((e) => e[0]),
            ...mostControversialEntries.map((e) => e[0]),
          ])
        );

        const extraMap: Record<string, { id: string; content: string; image_id: string | null }> = {};
        if (extraIds.length > 0) {
          const { data } = await supabase
            .from("captions")
            .select("id, content, image_id")
            .in("id", extraIds);
          for (const c of data ?? []) extraMap[c.id] = c;
        }

        const allImageIds = Array.from(
          new Set(
            [
              ...topCapsRaw.map((c) => c.image_id),
              ...botCapsRaw.map((c) => c.image_id),
              ...Object.values(extraMap).map((c) => c.image_id),
            ].filter((id): id is string => Boolean(id))
          )
        );
        const imageMap: Record<string, string> = {};
        if (allImageIds.length > 0) {
          const { data: imgs } = await supabase
            .from("images")
            .select("id, url")
            .in("id", allImageIds);
          for (const img of imgs ?? []) imageMap[img.id] = img.url;
        }

        const makeCaptionStat = (
          id: string,
          content: string,
          imageId: string | null,
          score: number,
          aggCount?: number,
          up?: number,
          down?: number
        ): CaptionStat => ({
          id,
          content,
          image_id: imageId,
          imageUrl: imageId ? imageMap[imageId] ?? null : null,
          score,
          voteCount: aggCount,
          upCount: up,
          downCount: down,
        });

        setTopRated(
          topCapsRaw.map((c) =>
            makeCaptionStat(c.id, c.content, c.image_id, c.like_count ?? 0)
          )
        );
        setWorstRated(
          botCapsRaw.map((c) =>
            makeCaptionStat(c.id, c.content, c.image_id, c.like_count ?? 0)
          )
        );
        setMostRated(
          mostRatedEntries.map(([id, agg]) =>
            makeCaptionStat(
              id,
              extraMap[id]?.content ?? "",
              extraMap[id]?.image_id ?? null,
              agg.score,
              agg.count,
              agg.up,
              agg.down
            )
          )
        );
        setMostControversial(
          mostControversialEntries.map(([id, agg]) =>
            makeCaptionStat(
              id,
              extraMap[id]?.content ?? "",
              extraMap[id]?.image_id ?? null,
              agg.score,
              agg.count,
              agg.up,
              agg.down
            )
          )
        );

        const topVoterEntries = Object.entries(perVoter)
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, 10);
        setTopVoters(
          topVoterEntries.map(([pid, agg]) => ({
            profile_id: pid,
            count: agg.count,
            upCount: agg.up,
            downCount: agg.down,
          }))
        );

        const today = new Date();
        const buckets: DayBucket[] = [];
        for (let i = 29; i >= 0; i--) {
          const d = new Date(today);
          d.setUTCDate(d.getUTCDate() - i);
          const key = d.toISOString().slice(0, 10);
          const agg = perDay[key] ?? { up: 0, down: 0, total: 0 };
          buckets.push({ day: key, up: agg.up, down: agg.down, total: agg.total });
        }
        setDailyBuckets(buckets);

        const scoreBucketDefs: { label: string; test: (s: number) => boolean }[] = [
          { label: "< -10", test: (s) => s < -10 },
          { label: "-10 to -5", test: (s) => s <= -5 && s >= -10 },
          { label: "-4 to -1", test: (s) => s <= -1 && s >= -4 },
          { label: "0", test: (s) => s === 0 },
          { label: "1 to 4", test: (s) => s >= 1 && s <= 4 },
          { label: "5 to 10", test: (s) => s >= 5 && s <= 10 },
          { label: "> 10", test: (s) => s > 10 },
        ];
        const hist: HistogramBucket[] = scoreBucketDefs.map((b) => ({ bucket: b.label, count: 0 }));
        for (const agg of Object.values(perCaption)) {
          const idx = scoreBucketDefs.findIndex((b) => b.test(agg.score));
          if (idx >= 0) hist[idx].count += 1;
        }
        setScoreHistogram(hist);

        setProgress("");
        setLoading(false);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to load stats");
        setLoading(false);
      }
    };

    run();
  }, []);

  if (loading) {
    return (
      <div className="text-neutral-500">
        Loading rating stats{progress ? ` — ${progress}` : "..."}
      </div>
    );
  }

  if (error || !summary) {
    return <div className="text-red-600">Error: {error ?? "No data"}</div>;
  }

  const upvotePct =
    summary.totalVotes > 0 ? (summary.upvotes / summary.totalVotes) * 100 : 0;
  const downvotePct =
    summary.totalVotes > 0 ? (summary.downvotes / summary.totalVotes) * 100 : 0;
  const ratedPct =
    summary.totalCaptions > 0
      ? (summary.captionsRated / summary.totalCaptions) * 100
      : 0;
  const avgVotesPerCap =
    summary.captionsRated > 0 ? summary.totalVotes / summary.captionsRated : 0;
  const maxDaily = Math.max(1, ...dailyBuckets.map((b) => b.total));
  const maxHistCount = Math.max(1, ...scoreHistogram.map((b) => b.count));

  return (
    <div>
      <h2 className="text-xl font-bold text-neutral-900 mb-6">Caption Rating Stats</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Ratings" value={summary.totalVotes.toLocaleString()} />
        <StatCard
          label="Upvotes"
          value={summary.upvotes.toLocaleString()}
          sub={`${upvotePct.toFixed(1)}%`}
          subColor="text-green-600"
        />
        <StatCard
          label="Downvotes"
          value={summary.downvotes.toLocaleString()}
          sub={`${downvotePct.toFixed(1)}%`}
          subColor="text-red-600"
        />
        <StatCard label="Avg Votes / Rated Caption" value={avgVotesPerCap.toFixed(1)} />
        <StatCard
          label="Captions Rated"
          value={summary.captionsRated.toLocaleString()}
          sub={`${ratedPct.toFixed(1)}% of ${summary.totalCaptions.toLocaleString()}`}
        />
        <StatCard label="Unique Voters" value={summary.uniqueVoters.toLocaleString()} />
        <StatCard label="Neutral Votes" value={summary.neutralVotes.toLocaleString()} />
        <StatCard label="Study Votes" value={summary.studyVotes.toLocaleString()} />
      </div>

      <div className="bg-white rounded-lg border border-neutral-200 p-4 mb-8">
        <h3 className="text-lg font-semibold text-neutral-900 mb-3">Ratings — Last 30 Days</h3>
        <div className="flex gap-1 h-32">
          {dailyBuckets.map((b) => (
            <div
              key={b.day}
              className="flex-1 flex flex-col justify-end group relative min-w-0"
              title={`${b.day}: ${b.total} total (+${b.up} / -${b.down})`}
            >
              <div
                className="w-full bg-red-400"
                style={{ height: `${(b.down / maxDaily) * 100}%` }}
              />
              <div
                className="w-full bg-green-500"
                style={{ height: `${(b.up / maxDaily) * 100}%` }}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-neutral-500 mt-2">
          <span>{dailyBuckets[0]?.day}</span>
          <span>{dailyBuckets[dailyBuckets.length - 1]?.day}</span>
        </div>
        <div className="flex gap-4 text-xs text-neutral-600 mt-3">
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-green-500" /> Upvotes</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-400" /> Downvotes</div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-neutral-200 p-4 mb-8">
        <h3 className="text-lg font-semibold text-neutral-900 mb-1">Score Distribution</h3>
        <p className="text-xs text-neutral-500 mb-3">
          {summary.captionsRated.toLocaleString()} captions have been rated. Buckets show how many land in each total-score range.
        </p>
        <div className="space-y-2">
          {scoreHistogram.map((h) => (
            <div key={h.bucket} className="flex items-center gap-3">
              <div className="w-20 text-xs text-neutral-600 text-right shrink-0 font-mono">{h.bucket}</div>
              <div className="flex-1 bg-neutral-100 rounded h-5 relative overflow-hidden">
                <div
                  className="bg-blue-500 h-full"
                  style={{ width: `${(h.count / maxHistCount) * 100}%` }}
                />
              </div>
              <div className="w-20 text-xs text-neutral-700 text-right shrink-0 tabular-nums">
                {h.count.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <CaptionList title="Top Rated" items={topRated} navigateTo={navigateTo} />
        <CaptionList title="Worst Rated" items={worstRated} navigateTo={navigateTo} />
        <CaptionList
          title="Most Rated (by # votes)"
          items={mostRated}
          navigateTo={navigateTo}
          showVoteCount
          showUpDown
        />
        <CaptionList
          title={`Most Controversial (≥${CONTROVERSY_MIN_VOTES} votes)`}
          items={mostControversial}
          navigateTo={navigateTo}
          showVoteCount
          showUpDown
        />
      </div>

      <div className="bg-white rounded-lg border border-neutral-200 mb-8">
        <h3 className="text-lg font-semibold text-neutral-900 p-4 border-b border-neutral-100">Most Active Voters</h3>
        {topVoters.length === 0 ? (
          <div className="p-4 text-neutral-500 text-sm">No voter data.</div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {topVoters.map((v, idx) => (
              <div key={v.profile_id} className="p-3 flex items-center gap-3">
                <div className="w-6 text-xs text-neutral-400 shrink-0">#{idx + 1}</div>
                <div className="flex-1 min-w-0">
                  <FkLink
                    label={v.profile_id}
                    id={v.profile_id}
                    section="profiles"
                    field="id"
                    navigateTo={navigateTo}
                  />
                </div>
                <div className="text-xs shrink-0 tabular-nums">
                  <span className="font-semibold text-neutral-900">{v.count}</span>
                  <span className="text-neutral-500"> votes</span>
                  <span className="text-green-600 ml-2">+{v.upCount}</span>
                  <span className="text-red-500 ml-1">−{v.downCount}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  subColor,
}: {
  label: string;
  value: string;
  sub?: string;
  subColor?: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-neutral-200 p-4">
      <div className="text-sm text-neutral-500 mb-1">{label}</div>
      <div className="text-2xl font-bold text-neutral-900 tabular-nums">{value}</div>
      {sub && (
        <div className={`text-xs mt-1 tabular-nums ${subColor ?? "text-neutral-500"}`}>
          {sub}
        </div>
      )}
    </div>
  );
}

function CaptionList({
  title,
  items,
  navigateTo,
  showVoteCount,
  showUpDown,
}: {
  title: string;
  items: CaptionStat[];
  navigateTo: (section: string, filter?: NavFilter) => void;
  showVoteCount?: boolean;
  showUpDown?: boolean;
}) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-neutral-900 mb-3">{title}</h3>
      <div className="bg-white rounded-lg border border-neutral-200 divide-y divide-neutral-100">
        {items.length === 0 ? (
          <div className="p-4 text-neutral-500 text-sm">No data.</div>
        ) : (
          items.map((item, idx) => (
            <div key={item.id} className="p-3 flex items-start gap-3">
              <div className="w-6 text-xs text-neutral-400 shrink-0 pt-1">#{idx + 1}</div>
              {item.imageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={item.imageUrl}
                  alt=""
                  className="w-10 h-10 object-cover rounded shrink-0 cursor-pointer"
                  onClick={() =>
                    item.image_id &&
                    navigateTo("images", { field: "id", value: item.image_id })
                  }
                />
              ) : (
                <div className="w-10 h-10 bg-neutral-100 rounded shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-neutral-700 line-clamp-2">
                  {item.content || <em className="text-neutral-400">(no content)</em>}
                </p>
                <div className="text-xs text-neutral-500 mt-1 flex gap-2 items-center flex-wrap tabular-nums">
                  <span
                    className={
                      item.score > 0
                        ? "text-green-600 font-medium"
                        : item.score < 0
                        ? "text-red-500 font-medium"
                        : ""
                    }
                  >
                    score {item.score > 0 ? `+${item.score}` : item.score}
                  </span>
                  {showVoteCount && item.voteCount !== undefined && (
                    <span>· {item.voteCount} votes</span>
                  )}
                  {showUpDown && item.upCount !== undefined && (
                    <span>
                      · <span className="text-green-600">+{item.upCount}</span>{" "}
                      <span className="text-red-500">−{item.downCount}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
