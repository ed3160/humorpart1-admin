import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SupabaseMock } from "./supabaseMock";

const mock = new SupabaseMock();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => mock.client() }));

import CaptionsTable from "@/components/CaptionsTable";
const navigateTo = vi.fn();

describe("CaptionsTable — filters / search / sort / expand-row vote summary", () => {
  beforeEach(() => {
    mock.resetCalls();
    mock.selectQueue.clear();
  });

  for (const run of [1, 2, 3]) {
    it(`run ${run}: rows render (with content not null filter)`, async () => {
      mock.queueSelect("captions", {
        data: [{ id: "c-1", content: "haha", image_id: "img-1", profile_id: "p-1", is_public: true, created_datetime_utc: "2026-01-01T00:00:00Z", humor_flavor_id: 1, like_count: 5, is_featured: false, caption_request_id: null }],
        error: null, count: 1,
      });
      render(<CaptionsTable navigateTo={navigateTo} filter={null} />);
      expect(await screen.findByText("haha")).toBeInTheDocument();
      const sel = mock.calls.find((c) => c.table === "captions" && c.op === "select");
      // .not("content", "is", null) translates to a kind="not.is" filter
      expect(sel!.filters.some((f) => f.kind === "not.is" && f.column === "content")).toBe(true);
    });

    it(`run ${run}: visibility=Public only adds eq is_public=true`, async () => {
      mock.queueSelect("captions", { data: [], error: null, count: 0 });
      mock.queueSelect("captions", { data: [], error: null, count: 0 });
      render(<CaptionsTable navigateTo={navigateTo} filter={null} />);
      await screen.findByText("0 captions");
      fireEvent.change(screen.getByRole("combobox"), { target: { value: "yes" } });
      await waitFor(() => {
        const sel = mock.calls.filter((c) => c.table === "captions" && c.op === "select").pop();
        expect(sel!.filters).toEqual(expect.arrayContaining([{ kind: "eq", column: "is_public", value: true }]));
      });
    });

    it(`run ${run}: search adds .ilike("content", "%term%")`, async () => {
      mock.queueSelect("captions", { data: [], error: null, count: 0 });
      mock.queueSelect("captions", { data: [], error: null, count: 0 });
      render(<CaptionsTable navigateTo={navigateTo} filter={null} />);
      await screen.findByText("0 captions");
      fireEvent.change(screen.getByPlaceholderText("Search by content..."), { target: { value: "lol" } });
      await waitFor(() => {
        const sel = mock.calls.filter((c) => c.table === "captions" && c.op === "select").pop();
        expect(sel!.filters).toEqual(expect.arrayContaining([{ kind: "ilike", column: "content", value: "%lol%" }]));
      });
    });

    it(`run ${run}: filter ?field=image_id narrows query`, async () => {
      mock.queueSelect("captions", { data: [], error: null, count: 0 });
      render(<CaptionsTable navigateTo={navigateTo} filter={{ field: "image_id", value: "img-42" }} />);
      await waitFor(() => {
        const sel = mock.calls.find((c) => c.table === "captions" && c.op === "select");
        expect(sel!.filters).toEqual(expect.arrayContaining([{ kind: "eq", column: "image_id", value: "img-42" }]));
      });
    });

    it(`run ${run}: expand-row fetches image + votes and computes up/down`, async () => {
      mock.queueSelect("captions", {
        data: [{ id: "c-1", content: "haha", image_id: "img-1", profile_id: "p-1", is_public: true, created_datetime_utc: "2026-01-01T00:00:00Z", humor_flavor_id: 1, like_count: 5, is_featured: false, caption_request_id: null }],
        error: null, count: 1,
      });
      // single() on images
      mock.queueSelect("images", { data: [{ id: "img-1", url: "https://x.png" }], error: null });
      // votes for the caption
      mock.queueSelect("caption_votes", { data: [{ vote_value: 1 }, { vote_value: 1 }, { vote_value: -1 }], error: null });
      render(<CaptionsTable navigateTo={navigateTo} filter={null} />);
      await screen.findByText("haha");

      fireEvent.click(screen.getByText("haha"));
      // The expand row's vote summary should compute up=2, down=1
      await waitFor(() => {
        // Up count = 2 in green; total = 3
        expect(screen.getByText("Upvotes")).toBeInTheDocument();
        expect(screen.getAllByText("2").length).toBeGreaterThan(0);
        expect(screen.getAllByText("1").length).toBeGreaterThan(0);
        expect(screen.getAllByText("3").length).toBeGreaterThan(0);
      });
    });
  }
});
