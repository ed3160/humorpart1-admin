import { vi } from "vitest";

// Each call signature the admin components use against the supabase-js v2 query
// builder. The mock records every chained call and resolves to a queued response.

export type Row = Record<string, unknown>;
export type SelectResp = { data: Row[] | null; error: unknown; count?: number | null };
export type SingleResp = { data: Row | null; error: unknown };

interface Recorded {
  table: string;
  op: "select" | "insert" | "update" | "delete";
  filters: Array<{ kind: string; column?: string; value?: unknown; raw?: unknown }>;
  payload?: Row;
  countMode?: "exact" | null;
  head?: boolean;
}

export class SupabaseMock {
  calls: Recorded[] = [];
  selectQueue: Map<string, SelectResp[]> = new Map();
  insertQueue: SelectResp[] = [];
  updateQueue: SelectResp[] = [];
  deleteQueue: SelectResp[] = [];
  // Default response if queue empty
  defaultSelect: SelectResp = { data: [], error: null, count: 0 };

  queueSelect(table: string, resp: SelectResp) {
    if (!this.selectQueue.has(table)) this.selectQueue.set(table, []);
    this.selectQueue.get(table)!.push(resp);
  }
  queueInsert(resp: SelectResp) { this.insertQueue.push(resp); }
  queueUpdate(resp: SelectResp) { this.updateQueue.push(resp); }
  queueDelete(resp: SelectResp) { this.deleteQueue.push(resp); }

  resetCalls() { this.calls = []; }

  client() {
    const self = this;
    return {
      auth: {
        signOut: vi.fn().mockResolvedValue({ error: null }),
        getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "fake" } }, error: null }),
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u-1" } }, error: null }),
      },
      from(table: string) {
        const rec: Recorded = { table, op: "select", filters: [] };
        const builder = {
          select(_cols?: string, opts?: { count?: "exact"; head?: boolean }) {
            rec.op = "select";
            rec.countMode = opts?.count ?? null;
            rec.head = opts?.head ?? false;
            return chain;
          },
          insert(payload: Row) { rec.op = "insert"; rec.payload = payload; self.calls.push(rec); return Promise.resolve(self.insertQueue.shift() ?? { data: null, error: null }); },
          update(payload: Row) { rec.op = "update"; rec.payload = payload; return chainTerminal("update"); },
          delete() { rec.op = "delete"; return chainTerminal("delete"); },
        };
        const chain: any = {
          eq(column: string, value: unknown) { rec.filters.push({ kind: "eq", column, value }); return chain; },
          gt(column: string, value: unknown) { rec.filters.push({ kind: "gt", column, value }); return chain; },
          lt(column: string, value: unknown) { rec.filters.push({ kind: "lt", column, value }); return chain; },
          in(column: string, value: unknown) { rec.filters.push({ kind: "in", column, value }); return chain; },
          ilike(column: string, value: unknown) { rec.filters.push({ kind: "ilike", column, value }); return chain; },
          or(raw: string) { rec.filters.push({ kind: "or", raw }); return chain; },
          not(column: string, op: string, value: unknown) { rec.filters.push({ kind: `not.${op}`, column, value }); return chain; },
          order(column: string, opts?: { ascending?: boolean }) { rec.filters.push({ kind: "order", column, raw: opts }); return chain; },
          range(from: number, to: number) { rec.filters.push({ kind: "range", raw: [from, to] }); return chain; },
          limit(n: number) { rec.filters.push({ kind: "limit", value: n }); return chain; },
          single() {
            self.calls.push(rec);
            const queue = self.selectQueue.get(rec.table);
            const resp = queue?.shift() ?? self.defaultSelect;
            const first = (resp.data ?? [])[0] ?? null;
            return Promise.resolve({ data: first, error: resp.error });
          },
          then(resolve: (v: SelectResp) => unknown, reject?: (e: unknown) => unknown) {
            // Make this thenable so `await chain` works
            self.calls.push(rec);
            const queue = self.selectQueue.get(rec.table);
            const resp = queue?.shift() ?? self.defaultSelect;
            try { resolve(resp); } catch (e) { reject?.(e); }
          },
        };
        function chainTerminal(op: "update" | "delete") {
          // update().eq() / delete().eq() — eq returns a thenable that fires the queued response
          return {
            eq(column: string, value: unknown) {
              rec.filters.push({ kind: "eq", column, value });
              self.calls.push(rec);
              const resp = (op === "update" ? self.updateQueue : self.deleteQueue).shift() ?? { data: null, error: null };
              return Promise.resolve(resp);
            },
          };
        }
        return builder;
      },
    };
  }
}
