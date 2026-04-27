import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SupabaseMock } from "./supabaseMock";

const mock = new SupabaseMock();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => mock.client() }));

import TermsTable from "@/components/TermsTable";
const navigateTo = vi.fn();

describe("TermsTable — Add/Edit/Delete + search + filter=term_type_id", () => {
  beforeEach(() => {
    mock.resetCalls();
    mock.selectQueue.clear();
    mock.insertQueue = []; mock.updateQueue = []; mock.deleteQueue = [];
  });

  for (const run of [1, 2, 3]) {
    it(`run ${run}: insert sends full payload with audit fields`, async () => {
      mock.queueSelect("term_types", { data: [{ id: 1, name: "noun" }], error: null });
      mock.queueSelect("terms", { data: [], error: null, count: 0 });
      mock.queueInsert({ data: null, error: null });
      mock.queueSelect("terms", { data: [], error: null, count: 0 });
      render(<TermsTable navigateTo={navigateTo} filter={null} userId="u-1" />);
      await screen.findByText("0 terms");

      fireEvent.change(screen.getByPlaceholderText("Term"), { target: { value: "irony" } });
      fireEvent.change(screen.getByPlaceholderText("Definition"), { target: { value: "saying the opposite" } });
      fireEvent.change(screen.getByPlaceholderText("Example"), { target: { value: "what a great day (in a storm)" } });
      fireEvent.change(screen.getByPlaceholderText("Priority"), { target: { value: "3" } });
      fireEvent.click(screen.getByRole("button", { name: "Add" }));

      await waitFor(() => {
        const ins = mock.calls.find((c) => c.op === "insert");
        expect(ins!.payload).toMatchObject({
          term: "irony",
          definition: "saying the opposite",
          example: "what a great day (in a storm)",
          priority: 3,
          created_by_user_id: "u-1",
          modified_by_user_id: "u-1",
        });
      });
    });

    it(`run ${run}: search applies .or(term ilike, definition ilike)`, async () => {
      mock.queueSelect("term_types", { data: [], error: null });
      mock.queueSelect("terms", { data: [], error: null, count: 0 });
      mock.queueSelect("terms", { data: [], error: null, count: 0 });
      render(<TermsTable navigateTo={navigateTo} filter={null} userId="u-1" />);
      await screen.findByText("0 terms");

      fireEvent.change(screen.getByPlaceholderText("Search term/definition..."), { target: { value: "iron" } });

      await waitFor(() => {
        const sel = mock.calls.filter((c) => c.table === "terms" && c.op === "select");
        const lastSel = sel[sel.length - 1];
        const orFilter = lastSel.filters.find((f) => f.kind === "or");
        expect(orFilter).toBeTruthy();
        expect(orFilter!.raw).toBe("term.ilike.%iron%,definition.ilike.%iron%");
      });
    });

    it(`run ${run}: filter ?field=term_type_id narrows query`, async () => {
      mock.queueSelect("term_types", { data: [], error: null });
      mock.queueSelect("terms", { data: [], error: null, count: 0 });
      render(<TermsTable navigateTo={navigateTo} filter={{ field: "term_type_id", value: "2" }} userId="u-1" />);
      await waitFor(() => {
        const sel = mock.calls.find((c) => c.table === "terms" && c.op === "select");
        expect(sel!.filters).toEqual(expect.arrayContaining([{ kind: "eq", column: "term_type_id", value: "2" }]));
      });
    });

    it(`run ${run}: edit + save sends UPDATE with modified_by_user_id`, async () => {
      mock.queueSelect("term_types", { data: [], error: null });
      mock.queueSelect("terms", {
        data: [{ id: 4, term: "t", definition: "d", example: "e", priority: 0, term_type_id: null, created_datetime_utc: "2026-01-01T00:00:00Z", modified_datetime_utc: null }],
        error: null, count: 1,
      });
      mock.queueUpdate({ data: null, error: null });
      mock.queueSelect("terms", { data: [], error: null, count: 0 });
      render(<TermsTable navigateTo={navigateTo} filter={null} userId="u-1" />);
      await screen.findByText("1 terms");
      fireEvent.click(screen.getByRole("button", { name: "Edit" }));
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => {
        const upd = mock.calls.find((c) => c.op === "update");
        expect(upd!.payload).toMatchObject({ term: "t", modified_by_user_id: "u-1" });
        expect(upd!.payload).not.toHaveProperty("created_by_user_id");
      });
    });
  }
});
