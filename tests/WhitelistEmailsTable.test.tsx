import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SupabaseMock } from "./supabaseMock";

const mock = new SupabaseMock();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => mock.client() }));

import WhitelistEmailsTable from "@/components/WhitelistEmailsTable";
const navigateTo = vi.fn();

describe("WhitelistEmailsTable — CRUD with audit fields", () => {
  beforeEach(() => {
    mock.resetCalls();
    mock.selectQueue.clear();
    mock.insertQueue = []; mock.updateQueue = []; mock.deleteQueue = [];
  });

  for (const run of [1, 2, 3]) {
    it(`run ${run}: rows render`, async () => {
      mock.queueSelect("whitelist_email_addresses", {
        data: [{ id: 1, email_address: "a@b.com", created_datetime_utc: "2026-01-01T00:00:00Z", modified_datetime_utc: null }],
        error: null, count: 1,
      });
      render(<WhitelistEmailsTable navigateTo={navigateTo} filter={null} userId="u-1" />);
      expect(await screen.findByText("a@b.com")).toBeInTheDocument();
    });

    it(`run ${run}: insert payload includes email + audit fields`, async () => {
      mock.queueSelect("whitelist_email_addresses", { data: [], error: null, count: 0 });
      mock.queueInsert({ data: null, error: null });
      mock.queueSelect("whitelist_email_addresses", { data: [], error: null, count: 0 });
      render(<WhitelistEmailsTable navigateTo={navigateTo} filter={null} userId="u-1" />);
      await screen.findByText("0 emails");
      fireEvent.change(screen.getByPlaceholderText("user@example.com"), { target: { value: "x@y.com" } });
      fireEvent.click(screen.getByRole("button", { name: "Add" }));
      await waitFor(() => {
        const ins = mock.calls.find((c) => c.op === "insert");
        expect(ins!.payload).toEqual({ email_address: "x@y.com", created_by_user_id: "u-1", modified_by_user_id: "u-1" });
      });
    });

    it(`run ${run}: edit cancel does not call update`, async () => {
      mock.queueSelect("whitelist_email_addresses", {
        data: [{ id: 1, email_address: "a@b.com", created_datetime_utc: "2026-01-01T00:00:00Z", modified_datetime_utc: null }],
        error: null, count: 1,
      });
      render(<WhitelistEmailsTable navigateTo={navigateTo} filter={null} userId="u-1" />);
      await screen.findByText("a@b.com");
      fireEvent.click(screen.getByRole("button", { name: "Edit" }));
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(mock.calls.find((c) => c.op === "update")).toBeUndefined();
    });
  }
});
