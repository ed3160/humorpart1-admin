import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SupabaseMock } from "./supabaseMock";

const mock = new SupabaseMock();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => mock.client() }));

const pushMock = vi.fn();
let searchParamsValues = new URLSearchParams("");
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: pushMock, refresh: vi.fn() }),
  useSearchParams: () => searchParamsValues,
}));

import AdminShell from "@/components/AdminShell";

beforeEach(() => {
  mock.resetCalls();
  mock.selectQueue.clear();
  pushMock.mockReset();
  searchParamsValues = new URLSearchParams("");
});

describe("AdminShell — auth gate + URL navigation", () => {
  for (const run of [1, 2, 3]) {
    it(`run ${run}: superadmin (is_superadmin=true) renders the admin layout`, async () => {
      mock.queueSelect("profiles", { data: [{ is_superadmin: true }], error: null });
      // Then Dashboard fetches counts; queue empty defaults are fine
      render(<AdminShell userId="u-1" userEmail="boss@example.com" />);
      // Should NOT render Access Denied; should render the sidebar Crackd Admin
      await waitFor(() => {
        expect(screen.queryByText("Access Denied")).not.toBeInTheDocument();
        expect(screen.getByText("Crackd Admin")).toBeInTheDocument();
      });
    });

    it(`run ${run}: columbia.edu fallback grants access even when is_superadmin=false`, async () => {
      mock.queueSelect("profiles", { data: [{ is_superadmin: false }], error: null });
      render(<AdminShell userId="u-1" userEmail="student@columbia.edu" />);
      await waitFor(() => {
        expect(screen.queryByText("Access Denied")).not.toBeInTheDocument();
        expect(screen.getByText("Crackd Admin")).toBeInTheDocument();
      });
    });

    it(`run ${run}: barnard.edu fallback grants access`, async () => {
      mock.queueSelect("profiles", { data: [{ is_superadmin: false }], error: null });
      render(<AdminShell userId="u-1" userEmail="x@barnard.edu" />);
      await waitFor(() => {
        expect(screen.queryByText("Access Denied")).not.toBeInTheDocument();
      });
    });

    it(`run ${run}: random email + non-superadmin → Access Denied with email shown`, async () => {
      mock.queueSelect("profiles", { data: [{ is_superadmin: false }], error: null });
      render(<AdminShell userId="u-1" userEmail="rando@gmail.com" />);
      expect(await screen.findByText("Access Denied")).toBeInTheDocument();
      expect(screen.getByText(/rando@gmail.com/)).toBeInTheDocument();
      // Sign out button is rendered
      expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    });

    it(`run ${run}: profiles RLS error → still allowed for columbia.edu (fallback)`, async () => {
      mock.queueSelect("profiles", { data: null, error: { message: "RLS" } });
      render(<AdminShell userId="u-1" userEmail="x@columbia.edu" />);
      await waitFor(() => {
        expect(screen.queryByText("Access Denied")).not.toBeInTheDocument();
      });
    });

    it(`run ${run}: clicking a sidebar link calls router.push with ?section=…`, async () => {
      mock.queueSelect("profiles", { data: [{ is_superadmin: true }], error: null });
      render(<AdminShell userId="u-1" userEmail="boss@example.com" />);
      await screen.findByText("Crackd Admin");
      fireEvent.click(screen.getByRole("button", { name: "Captions" }));
      expect(pushMock).toHaveBeenCalledWith("/?section=captions");
    });

    it(`run ${run}: VALID_SECTIONS rejects unknown ?section=… and falls back to Dashboard`, async () => {
      mock.queueSelect("profiles", { data: [{ is_superadmin: true }], error: null });
      searchParamsValues = new URLSearchParams("section=NOTREAL");
      render(<AdminShell userId="u-1" userEmail="boss@example.com" />);
      // Dashboard renders its h2 "Dashboard" — wait for it (counts may be empty)
      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
      });
    });
  }
});
