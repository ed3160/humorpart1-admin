import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SupabaseMock } from "./supabaseMock";

const mock = new SupabaseMock();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => mock.client() }));

import LlmModelsTable from "@/components/LlmModelsTable";
const navigateTo = vi.fn();

describe("LlmModelsTable — CRUD + provider dropdown + filter=id (bug fix)", () => {
  beforeEach(() => {
    mock.resetCalls();
    mock.selectQueue.clear();
    mock.insertQueue = []; mock.updateQueue = []; mock.deleteQueue = [];
  });

  for (const run of [1, 2, 3]) {
    it(`run ${run}: provider dropdown is populated from llm_providers`, async () => {
      mock.queueSelect("llm_providers", {
        data: [{ id: 1, name: "OpenAI" }, { id: 2, name: "Anthropic" }],
        error: null,
      });
      mock.queueSelect("llm_models", { data: [], error: null, count: 0 });
      render(<LlmModelsTable navigateTo={navigateTo} filter={null} userId="u-1" />);
      // Wait for the dropdown to populate
      await waitFor(() => {
        const opts = screen.getAllByRole("option").map((o) => (o as HTMLOptionElement).textContent);
        expect(opts).toEqual(expect.arrayContaining(["OpenAI", "Anthropic"]));
      });
    });

    it(`run ${run}: filter=id clause is applied (bug fix verification)`, async () => {
      mock.queueSelect("llm_providers", { data: [], error: null });
      mock.queueSelect("llm_models", { data: [], error: null, count: 0 });
      render(<LlmModelsTable navigateTo={navigateTo} filter={{ field: "id", value: "42" }} userId="u-1" />);
      await waitFor(() => {
        const sel = mock.calls.find((c) => c.table === "llm_models" && c.op === "select");
        expect(sel!.filters).toEqual(expect.arrayContaining([{ kind: "eq", column: "id", value: "42" }]));
      });
    });

    it(`run ${run}: filter=llm_provider_id clause is applied`, async () => {
      mock.queueSelect("llm_providers", { data: [], error: null });
      mock.queueSelect("llm_models", { data: [], error: null, count: 0 });
      render(<LlmModelsTable navigateTo={navigateTo} filter={{ field: "llm_provider_id", value: "7" }} userId="u-1" />);
      await waitFor(() => {
        const sel = mock.calls.find((c) => c.table === "llm_models" && c.op === "select");
        expect(sel!.filters).toEqual(expect.arrayContaining([{ kind: "eq", column: "llm_provider_id", value: "7" }]));
      });
    });

    it(`run ${run}: insert sends full payload + audit fields`, async () => {
      mock.queueSelect("llm_providers", { data: [{ id: 1, name: "OpenAI" }], error: null });
      mock.queueSelect("llm_models", { data: [], error: null, count: 0 });
      mock.queueInsert({ data: null, error: null });
      mock.queueSelect("llm_models", { data: [], error: null, count: 0 });
      render(<LlmModelsTable navigateTo={navigateTo} filter={null} userId="u-1" />);
      await screen.findByText("0 models");

      fireEvent.change(screen.getByPlaceholderText("Name"), { target: { value: "GPT-5" } });
      fireEvent.change(screen.getByPlaceholderText("Provider Model ID"), { target: { value: "gpt-5-mini" } });
      const tempCheck = screen.getByLabelText(/Temp supported/);
      fireEvent.click(tempCheck);
      fireEvent.click(screen.getByRole("button", { name: "Add" }));

      await waitFor(() => {
        const ins = mock.calls.find((c) => c.op === "insert");
        expect(ins!.payload).toMatchObject({
          name: "GPT-5",
          provider_model_id: "gpt-5-mini",
          is_temperature_supported: true,
          created_by_user_id: "u-1",
          modified_by_user_id: "u-1",
        });
      });
    });

    it(`run ${run}: edit + save sends UPDATE with modified_by_user_id`, async () => {
      mock.queueSelect("llm_providers", { data: [{ id: 1, name: "OpenAI" }], error: null });
      mock.queueSelect("llm_models", {
        data: [{ id: 9, name: "X", llm_provider_id: 1, provider_model_id: "x", is_temperature_supported: false, created_datetime_utc: "2026-01-01T00:00:00Z" }],
        error: null, count: 1,
      });
      mock.queueUpdate({ data: null, error: null });
      mock.queueSelect("llm_models", { data: [], error: null, count: 0 });
      render(<LlmModelsTable navigateTo={navigateTo} filter={null} userId="u-1" />);
      await screen.findByText("1 models");
      fireEvent.click(screen.getByRole("button", { name: "Edit" }));
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => {
        const upd = mock.calls.find((c) => c.op === "update");
        expect(upd!.payload).toMatchObject({ name: "X", modified_by_user_id: "u-1" });
        expect(upd!.payload).not.toHaveProperty("created_by_user_id");
      });
    });

    it(`run ${run}: delete confirmed sends DELETE eq id`, async () => {
      mock.queueSelect("llm_providers", { data: [], error: null });
      mock.queueSelect("llm_models", {
        data: [{ id: 13, name: "X", llm_provider_id: null, provider_model_id: null, is_temperature_supported: false, created_datetime_utc: "2026-01-01T00:00:00Z" }],
        error: null, count: 1,
      });
      mock.queueDelete({ data: null, error: null });
      mock.queueSelect("llm_models", { data: [], error: null, count: 0 });
      render(<LlmModelsTable navigateTo={navigateTo} filter={null} userId="u-1" />);
      await screen.findByText("1 models");
      fireEvent.click(screen.getByRole("button", { name: "Delete" }));
      fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
      await waitFor(() => {
        const del = mock.calls.find((c) => c.op === "delete");
        expect(del!.filters).toEqual(expect.arrayContaining([{ kind: "eq", column: "id", value: 13 }]));
      });
    });
  }
});
