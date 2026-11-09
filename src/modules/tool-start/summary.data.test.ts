import { describe, expect, it } from "vitest";
import { catalog } from "@/modules/taxonomy/catalog";
import { specRows } from "./summary";

const tool = (id: string) => {
  const t = catalog.byId.get(id);
  if (!t) throw new Error(`no tool ${id}`);
  return t;
};

/** Figures read from vendor pricing pages on 2026-11-08. Each must also carry its source. */
const CHECKED = [
  "marlie", "rosie", "upfirst", "sameday", "gatherup", "homebase", "seven_shifts", "marginedge", "fooddocs",
  "synder", "weave", "cin7", "zoho_inventory", "taxjar", "shipstation", "togal", "handoff",
];

describe("allowances read from vendor pricing pages", () => {
  it("shows the figures on the right rows", () => {
    const ship = specRows(tool("shipstation"), "Entry");
    expect(ship[0].value).toBe("3 users");
    expect(ship[1].value).toBe("50 shipments a month");
    expect(specRows(tool("shipstation"), "Top")[0].value).toBe("15 users");

    expect(specRows(tool("marlie"), "Premium")[1].value).toBe("2,000 minutes");
    expect(specRows(tool("rosie"), "Professional")[1].value).toBe("250 minutes a month");
    expect(specRows(tool("synder"), "Basic")[1].value).toBe("500 synced transactions a month");
    expect(specRows(tool("cin7"), "From")[0].value).toBe("5 users");
    expect(specRows(tool("cin7"), "From")[1].value).toBe("6,000 sale orders a year");
    expect(specRows(tool("zoho_inventory"), "Top")[0].value).toBe("10 users");
    expect(specRows(tool("gatherup"), "Local Business")[1].value).toMatch(/3,000 emails/);
  });

  it("puts a source with a short quote behind every checked tool", () => {
    for (const id of CHECKED) {
      const t = tool(id);
      expect(t.last_checked, id).toBe("2026-11-08");
      const withQuote = t.evidence.filter((e) => e.quote && e.url.startsWith("https://"));
      expect(withQuote.length, `${id} has no quoted source`).toBeGreaterThan(0);
      for (const e of withQuote) expect(e.quote!.split(/\s+/).length, id).toBeLessThanOrEqual(15);
    }
  });
});
