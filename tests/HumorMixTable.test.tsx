import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SupabaseMock } from "./supabaseMock";

const mock = new SupabaseMock();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => mock.client() }));

import HumorMixTable from "@/components/HumorMixTable";
const navigateTo = vi.fn();

describe("HumorMixTable — edit-only flow", () => {
  beforeEach(() => {
    mock.resetCalls();
    mock.selectQueue.clear();
    mock.insertQueue = []; mock.updateQueue = []; mock.deleteQueue = [];
  });

  for (const run of [1, 2, 3]) {
    it(`run ${run}: queries the humor_flavor_mix table (matches admin code)`, async () => {
      mock.queueSelect("humor_flavor_mix", {
        data: [{ id: 1, humor_flavor_id: 11, caption_count: 5, created_datetime_utc: "2026-01-01T00:00:00Z" }],
        error: null, count: 1,
      });
      render(<HumorMixTable navigateTo={navigateTo} filter={null} userId="u-1" />);
      expect(await screen.findByText("5")).toBeInTheDocument();
      const sel = mock.calls.find((c) => c.op === "select");
      expect(sel!.table).toBe("humor_flavor_mix");
    });

    it(`run ${run}: edit caption_count writes update with modified_by_user_id`, async () => {
      mock.queueSelect("humor_flavor_mix", {
        data: [{ id: 1, humor_flavor_id: 11, caption_count: 5, created_datetime_utc: "2026-01-01T00:00:00Z" }],
        error: null, count: 1,
      });
      mock.queueUpdate({ data: null, error: null });
      mock.queueSelect("humor_flavor_mix", { data: [], error: null, count: 0 });
      render(<HumorMixTable navigateTo={navigateTo} filter={null} userId="u-1" />);
      await screen.findByText("5");
      fireEvent.click(screen.getByRole("button", { name: "Edit" }));
      const input = screen.getByDisplayValue("5");
      fireEvent.change(input, { target: { value: "12" } });
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => {
        const upd = mock.calls.find((c) => c.op === "update");
        expect(upd!.payload).toEqual({ caption_count: 12, modified_by_user_id: "u-1" });
        expect(upd!.filters).toEqual(expect.arrayContaining([{ kind: "eq", column: "id", value: 1 }]));
      });
    });
  }
});
