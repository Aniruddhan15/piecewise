import { describe, expect, it } from "vitest";
import { catalog } from "@/modules/taxonomy/catalog";
import { hiddenSpecLabels, specRows } from "./summary";

const tool = (id: string) => {
  const t = catalog.byId.get(id);
  if (!t) throw new Error(`no tool ${id}`);
  return t;
};

describe("specRows", () => {
  it("gives every tool the same rows in the same order, so cards line up", () => {
    const labels = specRows(tool("mailchimp")).map((r) => r.label);
    expect(labels).toEqual([
      "People it covers",
      "Use included",
      "Contract",
      "Your data",
      "Setup time",
      "Try it free",
    ]);
    for (const t of catalog.tools) {
      expect(specRows(t).map((r) => r.label), t.id).toEqual(labels);
    }
  });

  it("lines up like with like: contacts against profiles, sends against emails", () => {
    const mailchimp = specRows(tool("mailchimp"), "Free");
    const klaviyo = specRows(tool("klaviyo"), "Free");
    expect(mailchimp[0]).toMatchObject({ label: "People it covers", value: "250 contacts", known: true });
    expect(klaviyo[0]).toMatchObject({ label: "People it covers", value: "250 active profiles", known: true });
    expect(mailchimp[1].value).toMatch(/500 sends/i);
    expect(klaviyo[1].value).toMatch(/500 emails/i);
  });

  it("says 'Not listed' instead of leaving a row out of one card", () => {
    // NexHealth only quotes prices, so there is nothing to list.
    const rows = specRows(tool("nexhealth"));
    expect(rows[0]).toMatchObject({ value: "Not listed", known: false });
    expect(rows[1]).toMatchObject({ value: "Not listed", known: false });
    // Setup and trial are always known.
    expect(rows.find((r) => r.label === "Setup time")!.known).toBe(true);
    expect(rows.find((r) => r.label === "Try it free")!.known).toBe(true);
  });

  it("does not mistake prices and plan notes for allowances", () => {
    for (const t of catalog.tools) {
      for (const r of specRows(t).slice(0, 2)) {
        expect(r.value, `${t.id}: ${r.label}`).not.toMatch(/reported|billed|ask |sources conflict/i);
      }
    }
  });

  it("keeps people and usage in their own rows", () => {
    const goodcall = specRows(tool("goodcall"));
    expect(goodcall[0].value).toMatch(/callers/i);
    expect(goodcall[1].value).toMatch(/minutes/i);
    const smith = specRows(tool("smith_ai"));
    expect(smith[1].value).toMatch(/25 calls/i);
  });

  it("says what happens to your data in plain words, and 'Not confirmed' when we don't know", () => {
    for (const t of catalog.tools) {
      const row = specRows(t).find((r) => r.label === "Your data")!;
      const trains = t.privacy.trains_on_customer_data;
      expect(row.known, t.id).toBe(trains !== null);
      expect(row.value, t.id).toBe(trains === null ? "Not confirmed" : trains ? "May train its AI on it" : "Not used to train its AI");
    }
  });
});

describe("hiddenSpecLabels", () => {
  it("hides a row only when no card in the comparison has anything for it", () => {
    // Three tools with no allowance figures at all: those two rows are dropped for all three.
    const none = ["nexhealth", "breezeway", "xtrachef"].map((id) => specRows(tool(id)));
    const hidden = hiddenSpecLabels(none);
    expect(hidden.has("People it covers")).toBe(true);
    expect(hidden.has("Use included")).toBe(true);
    expect(hidden.has("Setup time")).toBe(false);
    expect(hidden.has("Try it free")).toBe(false);
  });

  it("keeps a row for everyone when even one tool has a figure", () => {
    const mixed = ["upfirst", "goodcall"].map((id) => specRows(tool(id), id === "goodcall" ? "Starter" : undefined));
    const hidden = hiddenSpecLabels(mixed);
    expect(hidden.has("People it covers")).toBe(false);
    expect(hidden.has("Use included")).toBe(false);
  });

  it("hides nothing for an empty comparison", () => {
    expect(hiddenSpecLabels([]).size).toBe(0);
  });
});
