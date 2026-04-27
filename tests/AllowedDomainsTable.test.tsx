import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SupabaseMock } from "./supabaseMock";

const mock = new SupabaseMock();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => mock.client() }));

import AllowedDomainsTable from "@/components/AllowedDomainsTable";
const navigateTo = vi.fn();

describe("AllowedDomainsTable — CRUD with audit fields", () => {
  beforeEach(() => {
    mock.resetCalls();
    mock.selectQueue.clear();
    mock.insertQueue = []; mock.updateQueue = []; mock.deleteQueue = [];
  });

  for (const run of [1, 2, 3]) {
    it(`run ${run}: rows render`, async () => {
      mock.queueSelect("allowed_signup_domains", {
        data: [{ id: 1, apex_domain: "columbia.edu", created_datetime_utc: "2026-01-01T00:00:00Z" }],
        error: null, count: 1,
      });
      render(<AllowedDomainsTable navigateTo={navigateTo} filter={null} userId="u-1" />);
      expect(await screen.findByText("columbia.edu")).toBeInTheDocument();
    });

    it(`run ${run}: insert writes audit fields and apex_domain (trimmed)`, async () => {
      mock.queueSelect("allowed_signup_domains", { data: [], error: null, count: 0 });
      mock.queueInsert({ data: null, error: null });
      mock.queueSelect("allowed_signup_domains", { data: [], error: null, count: 0 });
      render(<AllowedDomainsTable navigateTo={navigateTo} filter={null} userId="u-1" />);
      await screen.findByText("0 domains");

      fireEvent.change(screen.getByPlaceholderText("e.g. columbia.edu"), { target: { value: "  barnard.edu  " } });
      fireEvent.click(screen.getByRole("button", { name: "Add" }));

      await waitFor(() => {
        const ins = mock.calls.find((c) => c.op === "insert");
        expect(ins!.payload).toEqual({
          apex_domain: "barnard.edu",
          created_by_user_id: "u-1",
          modified_by_user_id: "u-1",
        });
      });
    });

    it(`run ${run}: edit + save sends UPDATE with modified_by_user_id`, async () => {
      mock.queueSelect("allowed_signup_domains", {
        data: [{ id: 7, apex_domain: "old.edu", created_datetime_utc: "2026-01-01T00:00:00Z" }],
        error: null, count: 1,
      });
      mock.queueUpdate({ data: null, error: null });
      mock.queueSelect("allowed_signup_domains", { data: [], error: null, count: 0 });
      render(<AllowedDomainsTable navigateTo={navigateTo} filter={null} userId="u-1" />);
      await screen.findByText("old.edu");
      fireEvent.click(screen.getByRole("button", { name: "Edit" }));
      const input = screen.getByDisplayValue("old.edu");
      fireEvent.change(input, { target: { value: "new.edu" } });
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => {
        const upd = mock.calls.find((c) => c.op === "update");
        expect(upd!.payload).toEqual({ apex_domain: "new.edu", modified_by_user_id: "u-1" });
        expect(upd!.filters).toEqual(expect.arrayContaining([{ kind: "eq", column: "id", value: 7 }]));
      });
    });

    it(`run ${run}: delete confirmed sends DELETE eq id`, async () => {
      mock.queueSelect("allowed_signup_domains", {
        data: [{ id: 9, apex_domain: "x.edu", created_datetime_utc: "2026-01-01T00:00:00Z" }],
        error: null, count: 1,
      });
      mock.queueDelete({ data: null, error: null });
      mock.queueSelect("allowed_signup_domains", { data: [], error: null, count: 0 });
      render(<AllowedDomainsTable navigateTo={navigateTo} filter={null} userId="u-1" />);
      await screen.findByText("x.edu");
      fireEvent.click(screen.getByRole("button", { name: "Delete" }));
      fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
      await waitFor(() => {
        const del = mock.calls.find((c) => c.op === "delete");
        expect(del!.filters).toEqual(expect.arrayContaining([{ kind: "eq", column: "id", value: 9 }]));
      });
    });
  }
});
