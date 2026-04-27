import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SupabaseMock } from "./supabaseMock";

const mock = new SupabaseMock();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => mock.client() }));

import CaptionExamplesTable from "@/components/CaptionExamplesTable";
const navigateTo = vi.fn();

describe("CaptionExamplesTable — Add/Edit/Delete + audit fields", () => {
  beforeEach(() => {
    mock.resetCalls();
    mock.selectQueue.clear();
    mock.insertQueue = []; mock.updateQueue = []; mock.deleteQueue = [];
  });

  for (const run of [1, 2, 3]) {
    it(`run ${run}: insert payload includes caption + priority + audit fields`, async () => {
      mock.queueSelect("caption_examples", { data: [], error: null, count: 0 });
      mock.queueInsert({ data: null, error: null });
      mock.queueSelect("caption_examples", { data: [], error: null, count: 0 });
      render(<CaptionExamplesTable navigateTo={navigateTo} filter={null} userId="u-1" />);
      await screen.findByText("0 examples");

      fireEvent.change(screen.getByPlaceholderText("Image description"), { target: { value: "a dog" } });
      fireEvent.change(screen.getByPlaceholderText("Caption"), { target: { value: "woof" } });
      fireEvent.change(screen.getByPlaceholderText("Explanation"), { target: { value: "puppy on couch" } });
      fireEvent.change(screen.getByPlaceholderText("Priority"), { target: { value: "5" } });
      fireEvent.click(screen.getByRole("button", { name: "Add" }));

      await waitFor(() => {
        const ins = mock.calls.find((c) => c.op === "insert");
        expect(ins!.payload).toMatchObject({
          image_description: "a dog",
          caption: "woof",
          explanation: "puppy on couch",
          priority: 5,
          created_by_user_id: "u-1",
          modified_by_user_id: "u-1",
        });
      });
    });

    it(`run ${run}: filter ?field=image_id narrows query`, async () => {
      mock.queueSelect("caption_examples", { data: [], error: null, count: 0 });
      render(<CaptionExamplesTable navigateTo={navigateTo} filter={{ field: "image_id", value: "img-42" }} userId="u-1" />);
      await waitFor(() => {
        const sel = mock.calls.find((c) => c.table === "caption_examples" && c.op === "select");
        expect(sel!.filters).toEqual(expect.arrayContaining([{ kind: "eq", column: "image_id", value: "img-42" }]));
      });
    });

    it(`run ${run}: Add disabled when caption is empty / whitespace-only`, async () => {
      mock.queueSelect("caption_examples", { data: [], error: null, count: 0 });
      render(<CaptionExamplesTable navigateTo={navigateTo} filter={null} userId="u-1" />);
      const addBtn = screen.getByRole("button", { name: "Add" });
      expect(addBtn).toBeDisabled();
      fireEvent.change(screen.getByPlaceholderText("Caption"), { target: { value: "   " } });
      expect(addBtn).toBeDisabled();
      fireEvent.change(screen.getByPlaceholderText("Caption"), { target: { value: "ok" } });
      expect(addBtn).not.toBeDisabled();
    });

    it(`run ${run}: edit + save sends UPDATE with modified_by_user_id`, async () => {
      mock.queueSelect("caption_examples", {
        data: [{ id: 1, image_description: "d", caption: "c", explanation: "e", priority: 0, image_id: null, created_datetime_utc: "2026-01-01T00:00:00Z", modified_datetime_utc: null }],
        error: null, count: 1,
      });
      mock.queueUpdate({ data: null, error: null });
      mock.queueSelect("caption_examples", { data: [], error: null, count: 0 });
      render(<CaptionExamplesTable navigateTo={navigateTo} filter={null} userId="u-1" />);
      await screen.findByText("1 examples");
      fireEvent.click(screen.getByRole("button", { name: "Edit" }));
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => {
        const upd = mock.calls.find((c) => c.op === "update");
        expect(upd!.payload).toMatchObject({ caption: "c", modified_by_user_id: "u-1" });
        expect(upd!.payload).not.toHaveProperty("created_by_user_id"); // updates must not stamp created_by
      });
    });

    it(`run ${run}: delete confirmed sends DELETE eq id`, async () => {
      mock.queueSelect("caption_examples", {
        data: [{ id: 5, image_description: "", caption: "x", explanation: "", priority: 0, image_id: null, created_datetime_utc: "2026-01-01T00:00:00Z", modified_datetime_utc: null }],
        error: null, count: 1,
      });
      mock.queueDelete({ data: null, error: null });
      mock.queueSelect("caption_examples", { data: [], error: null, count: 0 });
      render(<CaptionExamplesTable navigateTo={navigateTo} filter={null} userId="u-1" />);
      await screen.findByText("1 examples");
      fireEvent.click(screen.getByRole("button", { name: "Delete" }));
      fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
      await waitFor(() => {
        const del = mock.calls.find((c) => c.op === "delete");
        expect(del!.filters).toEqual(expect.arrayContaining([{ kind: "eq", column: "id", value: 5 }]));
      });
    });
  }
});
