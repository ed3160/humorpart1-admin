import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SupabaseMock } from "./supabaseMock";

const mock = new SupabaseMock();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => mock.client() }));

import LlmProvidersTable from "@/components/LlmProvidersTable";

const navigateTo = vi.fn();

describe("LlmProvidersTable — Add / Edit / Delete + audit fields", () => {
  beforeEach(() => {
    mock.resetCalls();
    mock.selectQueue.clear();
    mock.insertQueue = [];
    mock.updateQueue = [];
    mock.deleteQueue = [];
  });
  afterEach(() => navigateTo.mockReset());

  // 3x: each branch is exercised three times to mimic the "3 runs" requirement
  for (const run of [1, 2, 3]) {
    it(`run ${run}: renders rows fetched from llm_providers`, async () => {
      mock.queueSelect("llm_providers", {
        data: [{ id: 1, name: "OpenAI", created_datetime_utc: "2026-01-01T00:00:00Z" }],
        error: null,
        count: 1,
      });
      render(<LlmProvidersTable navigateTo={navigateTo} filter={null} userId="u-1" />);
      expect(await screen.findByText("OpenAI")).toBeInTheDocument();
      expect(screen.getByText("1 providers")).toBeInTheDocument();
    });

    it(`run ${run}: insert sends name + created_by_user_id + modified_by_user_id`, async () => {
      mock.queueSelect("llm_providers", { data: [], error: null, count: 0 });
      mock.queueInsert({ data: null, error: null });
      mock.queueSelect("llm_providers", { data: [], error: null, count: 0 }); // refresh
      render(<LlmProvidersTable navigateTo={navigateTo} filter={null} userId="u-1" />);
      await screen.findByText("0 providers");

      fireEvent.change(screen.getByPlaceholderText("Provider name"), { target: { value: "Anthropic" } });
      fireEvent.click(screen.getByRole("button", { name: "Add" }));

      await waitFor(() => {
        const ins = mock.calls.find((c) => c.table === "llm_providers" && c.op === "insert");
        expect(ins).toBeTruthy();
        expect(ins!.payload).toEqual({
          name: "Anthropic",
          created_by_user_id: "u-1",
          modified_by_user_id: "u-1",
        });
      });
    });

    it(`run ${run}: edit sends update with modified_by_user_id and refreshes`, async () => {
      mock.queueSelect("llm_providers", {
        data: [{ id: 1, name: "OpenAI", created_datetime_utc: "2026-01-01T00:00:00Z" }],
        error: null,
        count: 1,
      });
      mock.queueUpdate({ data: null, error: null });
      mock.queueSelect("llm_providers", { data: [], error: null, count: 0 });
      render(<LlmProvidersTable navigateTo={navigateTo} filter={null} userId="u-1" />);
      await screen.findByText("OpenAI");

      fireEvent.click(screen.getByRole("button", { name: "Edit" }));
      const input = screen.getByDisplayValue("OpenAI");
      fireEvent.change(input, { target: { value: "OpenAI v2" } });
      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => {
        const upd = mock.calls.find((c) => c.table === "llm_providers" && c.op === "update");
        expect(upd).toBeTruthy();
        expect(upd!.payload).toEqual({ name: "OpenAI v2", modified_by_user_id: "u-1" });
        expect(upd!.filters).toEqual(expect.arrayContaining([{ kind: "eq", column: "id", value: 1 }]));
      });
    });

    it(`run ${run}: delete needs Confirm; cancelling does NOT call delete`, async () => {
      mock.queueSelect("llm_providers", {
        data: [{ id: 1, name: "OpenAI", created_datetime_utc: "2026-01-01T00:00:00Z" }],
        error: null,
        count: 1,
      });
      render(<LlmProvidersTable navigateTo={navigateTo} filter={null} userId="u-1" />);
      await screen.findByText("OpenAI");

      fireEvent.click(screen.getByRole("button", { name: "Delete" }));
      // Two-stage: now Confirm + Cancel are visible
      expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(mock.calls.find((c) => c.op === "delete")).toBeUndefined();
    });

    it(`run ${run}: delete confirmed sends DELETE eq id`, async () => {
      mock.queueSelect("llm_providers", {
        data: [{ id: 1, name: "OpenAI", created_datetime_utc: "2026-01-01T00:00:00Z" }],
        error: null,
        count: 1,
      });
      mock.queueDelete({ data: null, error: null });
      mock.queueSelect("llm_providers", { data: [], error: null, count: 0 });
      render(<LlmProvidersTable navigateTo={navigateTo} filter={null} userId="u-1" />);
      await screen.findByText("OpenAI");

      fireEvent.click(screen.getByRole("button", { name: "Delete" }));
      fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

      await waitFor(() => {
        const del = mock.calls.find((c) => c.table === "llm_providers" && c.op === "delete");
        expect(del).toBeTruthy();
        expect(del!.filters).toEqual(expect.arrayContaining([{ kind: "eq", column: "id", value: 1 }]));
      });
    });

    it(`run ${run}: Add button is disabled until name has content`, async () => {
      mock.queueSelect("llm_providers", { data: [], error: null, count: 0 });
      render(<LlmProvidersTable navigateTo={navigateTo} filter={null} userId="u-1" />);
      const addBtn = screen.getByRole("button", { name: "Add" });
      expect(addBtn).toBeDisabled();
      fireEvent.change(screen.getByPlaceholderText("Provider name"), { target: { value: "  " } });
      expect(addBtn).toBeDisabled(); // whitespace-only still disabled
      fireEvent.change(screen.getByPlaceholderText("Provider name"), { target: { value: "X" } });
      expect(addBtn).not.toBeDisabled();
    });
  }
});
