import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { SupabaseMock } from "./supabaseMock";

const mock = new SupabaseMock();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => mock.client() }));

import LlmPromptChainsTable from "@/components/LlmPromptChainsTable";
const navigateTo = vi.fn();

describe("LlmPromptChainsTable — filter handling (bug fix verification)", () => {
  beforeEach(() => {
    mock.resetCalls();
    mock.selectQueue.clear();
  });

  for (const run of [1, 2, 3]) {
    it(`run ${run}: filter=id is honored (NEW after 885d79d)`, async () => {
      mock.queueSelect("llm_prompt_chains", { data: [], error: null, count: 0 });
      render(<LlmPromptChainsTable navigateTo={navigateTo} filter={{ field: "id", value: "1" }} />);
      await waitFor(() => {
        const sel = mock.calls.find((c) => c.table === "llm_prompt_chains" && c.op === "select");
        expect(sel!.filters).toEqual(expect.arrayContaining([{ kind: "eq", column: "id", value: "1" }]));
      });
    });

    it(`run ${run}: filter=caption_request_id still works`, async () => {
      mock.queueSelect("llm_prompt_chains", { data: [], error: null, count: 0 });
      render(<LlmPromptChainsTable navigateTo={navigateTo} filter={{ field: "caption_request_id", value: "8745" }} />);
      await waitFor(() => {
        const sel = mock.calls.find((c) => c.table === "llm_prompt_chains" && c.op === "select");
        expect(sel!.filters).toEqual(expect.arrayContaining([{ kind: "eq", column: "caption_request_id", value: "8745" }]));
      });
    });
  }
});
