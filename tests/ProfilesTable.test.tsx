import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { SupabaseMock } from "./supabaseMock";

const mock = new SupabaseMock();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => mock.client() }));

import ProfilesTable from "@/components/ProfilesTable";
const navigateTo = vi.fn();

describe("ProfilesTable — direct vs derived mode", () => {
  beforeEach(() => {
    mock.resetCalls();
    mock.selectQueue.clear();
  });

  for (const run of [1, 2, 3]) {
    it(`run ${run}: direct mode — when profiles select returns >1 rows, table shows email + admin columns`, async () => {
      mock.queueSelect("profiles", {
        data: [
          { id: "p-1", email: "alice@columbia.edu", first_name: "Alice", last_name: "A", is_superadmin: true,  is_matrix_admin: false, is_in_study: false, created_datetime_utc: "2026-01-01T00:00:00Z" },
          { id: "p-2", email: "bob@barnard.edu",   first_name: "Bob",   last_name: "B", is_superadmin: false, is_matrix_admin: false, is_in_study: false, created_datetime_utc: "2026-01-02T00:00:00Z" },
        ],
        error: null,
      });
      render(<ProfilesTable navigateTo={navigateTo} filter={null} />);
      // Email + Admin headers visible only in direct mode
      await waitFor(() => {
        expect(screen.getByText("Email")).toBeInTheDocument();
        expect(screen.getByText("Admin")).toBeInTheDocument();
        expect(screen.getByText("alice@columbia.edu")).toBeInTheDocument();
        expect(screen.getByText("bob@barnard.edu")).toBeInTheDocument();
      });
      // Banner about RLS NOT shown
      expect(screen.queryByText(/RLS restricts direct profile reads/)).not.toBeInTheDocument();
    });

    it(`run ${run}: derived mode — when profiles select returns ≤1 row, banner appears and counts come from images/captions/votes`, async () => {
      // Direct profiles: returns just [] (anon under RLS)
      mock.queueSelect("profiles", { data: [], error: null });
      // Derived: count rows from images, captions, votes
      mock.queueSelect("images",        { data: [{ profile_id: "u-1" }, { profile_id: "u-1" }, { profile_id: "u-2" }], error: null });
      mock.queueSelect("captions",      { data: [{ profile_id: "u-1" }, { profile_id: "u-2" }, { profile_id: "u-2" }, { profile_id: "u-3" }], error: null });
      mock.queueSelect("caption_votes", { data: [{ profile_id: "u-1" }, { profile_id: "u-3" }], error: null });

      render(<ProfilesTable navigateTo={navigateTo} filter={null} />);

      // Banner is visible
      expect(await screen.findByText(/RLS restricts direct profile reads/)).toBeInTheDocument();
      // We should now have exactly 3 distinct profiles (u-1, u-2, u-3) — both
      // the banner "Showing 3 profiles…" and the count "3 profiles" mention it
      const matches = screen.getAllByText(/3 profiles/);
      expect(matches.length).toBeGreaterThanOrEqual(1);
      // No "Email" column header in derived mode
      expect(screen.queryByText("Email")).not.toBeInTheDocument();
    });
  }
});
