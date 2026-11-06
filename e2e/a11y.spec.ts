import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PAGES = [
  { name: "landing", path: "/" },
  { name: "start", path: "/start" },
  { name: "board", path: "/board?demo=dental" },
  { name: "block", path: "/block/customer_comm?demo=hvac" },
  { name: "plan", path: "/plan?demo=coffee" },
];

for (const colorScheme of ["light", "dark"] as const) {
  for (const { name, path } of PAGES) {
    test(`${name} (${colorScheme}) has no WCAG A or AA violations`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .exclude("nextjs-portal")
        .analyze();
      const summary = results.violations.map(
        (v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`,
      );
      expect(summary).toEqual([]);
    });
  }
}
