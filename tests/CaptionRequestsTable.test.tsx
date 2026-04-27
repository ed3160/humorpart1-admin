import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { SupabaseMock } from "./supabaseMock";

const mock = new SupabaseMock();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => mock.client() }));

import CaptionRequestsTable from "@/components/CaptionRequestsTable";
const navigateTo = vi.fn();

describe("CaptionRequestsTable — filter handling (bug fix verification)", () => {
  beforeEach(() => {
    mock.resetCalls();
    mock.selectQueue.clear();
  });

  for (const run of [1, 2, 3]) {
    it(`run ${run}: filter=id is honored (NEW after 885d79d)`, async () => {
      mock.queueSelect("caption_requests", { data: [], error: null, count: 0 });
      render(<CaptionRequestsTable navigateTo={navigateTo} filter={{ field: "id", value: "8745" }} />);
      await waitFor(() => {
        const sel = mock.calls.find((c) => c.table === "caption_requests" && c.op === "select");
        expect(sel!.filters).toEqual(expect.arrayContaining([{ kind: "eq", column: "id", value: "8745" }]));
      });
    });

    it(`run ${run}: filter=image_id still works`, async () => {
      mock.queueSelect("caption_requests", { data: [], error: null, count: 0 });
      render(<CaptionRequestsTable navigateTo={navigateTo} filter={{ field: "image_id", value: "img-1" }} />);
      await waitFor(() => {
        const sel = mock.calls.find((c) => c.table === "caption_requests" && c.op === "select");
        expect(sel!.filters).toEqual(expect.arrayContaining([{ kind: "eq", column: "image_id", value: "img-1" }]));
      });
    });

    it(`run ${run}: filter=profile_id still works`, async () => {
      mock.queueSelect("caption_requests", { data: [], error: null, count: 0 });
      render(<CaptionRequestsTable navigateTo={navigateTo} filter={{ field: "profile_id", value: "p-1" }} />);
      await waitFor(() => {
        const sel = mock.calls.find((c) => c.table === "caption_requests" && c.op === "select");
        expect(sel!.filters).toEqual(expect.arrayContaining([{ kind: "eq", column: "profile_id", value: "p-1" }]));
      });
    });

    it(`run ${run}: no filter → no eq clause for id/image_id/profile_id`, async () => {
      mock.queueSelect("caption_requests", { data: [], error: null, count: 0 });
      render(<CaptionRequestsTable navigateTo={navigateTo} filter={null} />);
      await waitFor(() => {
        const sel = mock.calls.find((c) => c.table === "caption_requests" && c.op === "select");
        const eqFilters = sel!.filters.filter((f) => f.kind === "eq");
        expect(eqFilters).toHaveLength(0);
      });
    });
  }
});
