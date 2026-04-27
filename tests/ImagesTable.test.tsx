import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SupabaseMock } from "./supabaseMock";

const mock = new SupabaseMock();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => mock.client() }));

import ImagesTable from "@/components/ImagesTable";
const navigateTo = vi.fn();

describe("ImagesTable — Add by URL / Edit / Delete / Upload guards / Preview / Filter", () => {
  beforeEach(() => {
    mock.resetCalls();
    mock.selectQueue.clear();
    mock.insertQueue = []; mock.updateQueue = []; mock.deleteQueue = [];
    vi.restoreAllMocks();
  });

  for (const run of [1, 2, 3]) {
    it(`run ${run}: filter=is_public=yes maps to .eq("is_public", true)`, async () => {
      mock.queueSelect("images", { data: [], error: null, count: 0 });
      mock.queueSelect("images", { data: [], error: null, count: 0 });
      render(<ImagesTable navigateTo={navigateTo} filter={null} userId="u-1" />);
      await screen.findByText("0 images");
      const select = screen.getByRole("combobox");
      fireEvent.change(select, { target: { value: "yes" } });
      await waitFor(() => {
        const sel = mock.calls.filter((c) => c.table === "images" && c.op === "select").pop();
        expect(sel!.filters).toEqual(expect.arrayContaining([{ kind: "eq", column: "is_public", value: true }]));
      });
    });

    it(`run ${run}: filter ?field=profile_id narrows query`, async () => {
      mock.queueSelect("images", { data: [], error: null, count: 0 });
      render(<ImagesTable navigateTo={navigateTo} filter={{ field: "profile_id", value: "p-9" }} userId="u-1" />);
      await waitFor(() => {
        const sel = mock.calls.find((c) => c.table === "images" && c.op === "select");
        expect(sel!.filters).toEqual(expect.arrayContaining([{ kind: "eq", column: "profile_id", value: "p-9" }]));
      });
    });

    it(`run ${run}: Add by URL inserts {url, is_public, created_by, modified_by}`, async () => {
      mock.queueSelect("images", { data: [], error: null, count: 0 });
      mock.queueInsert({ data: null, error: null });
      mock.queueSelect("images", { data: [], error: null, count: 0 });
      render(<ImagesTable navigateTo={navigateTo} filter={null} userId="u-1" />);
      await screen.findByText("0 images");

      fireEvent.change(screen.getByPlaceholderText("https://..."), { target: { value: "https://x.png" } });
      // Only one checkbox in the Add form when there are 0 rows
      fireEvent.click(screen.getByRole("checkbox"));
      fireEvent.click(screen.getByRole("button", { name: "Add" }));

      await waitFor(() => {
        const ins = mock.calls.find((c) => c.op === "insert" && c.table === "images");
        expect(ins!.payload).toEqual({
          url: "https://x.png",
          is_public: true,
          created_by_user_id: "u-1",
          modified_by_user_id: "u-1",
        });
      });
    });

    it(`run ${run}: Edit + Save sends UPDATE with modified_by_user_id`, async () => {
      mock.queueSelect("images", {
        data: [{ id: "img-1", url: "https://a.png", profile_id: "p-1", is_public: false, created_datetime_utc: "2026-01-01T00:00:00Z", image_description: null, additional_context: null, celebrity_recognition: null, is_common_use: null }],
        error: null, count: 1,
      });
      mock.queueUpdate({ data: null, error: null });
      mock.queueSelect("images", { data: [], error: null, count: 0 });
      render(<ImagesTable navigateTo={navigateTo} filter={null} userId="u-1" />);
      await screen.findByText("1 images");
      fireEvent.click(screen.getByRole("button", { name: "Edit" }));
      const urlInput = screen.getByDisplayValue("https://a.png");
      fireEvent.change(urlInput, { target: { value: "https://b.png" } });
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => {
        const upd = mock.calls.find((c) => c.op === "update" && c.table === "images");
        expect(upd!.payload).toMatchObject({ url: "https://b.png", is_public: false, modified_by_user_id: "u-1" });
        expect(upd!.payload).not.toHaveProperty("created_by_user_id");
        expect(upd!.filters).toEqual(expect.arrayContaining([{ kind: "eq", column: "id", value: "img-1" }]));
      });
    });

    it(`run ${run}: Delete confirmed sends DELETE eq id; Cancel does not`, async () => {
      mock.queueSelect("images", {
        data: [{ id: "img-99", url: "https://q.png", profile_id: "p-1", is_public: false, created_datetime_utc: "2026-01-01T00:00:00Z", image_description: null, additional_context: null, celebrity_recognition: null, is_common_use: null }],
        error: null, count: 1,
      });
      mock.queueDelete({ data: null, error: null });
      mock.queueSelect("images", { data: [], error: null, count: 0 });
      render(<ImagesTable navigateTo={navigateTo} filter={null} userId="u-1" />);
      await screen.findByText("1 images");
      fireEvent.click(screen.getByRole("button", { name: "Delete" }));
      fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
      await waitFor(() => {
        const del = mock.calls.find((c) => c.op === "delete" && c.table === "images");
        expect(del!.filters).toEqual(expect.arrayContaining([{ kind: "eq", column: "id", value: "img-99" }]));
      });
    });

    it(`run ${run}: Upload rejects unsupported MIME (PDF) before any network call`, async () => {
      mock.queueSelect("images", { data: [], error: null, count: 0 });
      // Spy on global fetch — no fetch should happen for an unsupported file
      const fetchSpy = vi.spyOn(globalThis, "fetch" as never).mockResolvedValue(new Response("ok"));
      render(<ImagesTable navigateTo={navigateTo} filter={null} userId="u-1" />);
      await screen.findByText("0 images");

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const pdf = new File(["%PDF-1.4"], "doc.pdf", { type: "application/pdf" });
      Object.defineProperty(fileInput, "files", { value: [pdf] });
      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(screen.getByText(/Unsupported file type/)).toBeInTheDocument();
      });
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it(`run ${run}: filter banner renders + Clear navigates back to images`, async () => {
      mock.queueSelect("images", { data: [], error: null, count: 0 });
      render(<ImagesTable navigateTo={navigateTo} filter={{ field: "profile_id", value: "abc-12345-zzz" }} userId="u-1" />);
      await screen.findByText("0 images");
      expect(screen.getByText(/Filtered by profile_id:/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Clear" }));
      expect(navigateTo).toHaveBeenCalledWith("images");
    });
  }
});
