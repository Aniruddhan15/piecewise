import { expect, test, type Page } from "@playwright/test";

const DEMOS = [
  { label: /Restaurant on Toast/, state: "Doesn't fit" },
  { label: /Coffee shop on Square/, state: "Fits with a catch" },
  { label: /HVAC tech/, state: "Doesn't fit" },
  { label: /Landscaper/, state: "Fits" },
  { label: /Dental office/, state: "Not allowed" },
];

async function noSideScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

for (const demo of DEMOS) {
  test(`${demo.label.source} reaches the plan with no errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/");
    await page.getByRole("link", { name: demo.label }).click();
    await expect(page.getByRole("heading", { name: "Your puzzle" })).toBeVisible();
    await expect(page.locator("main").getByText(demo.state, { exact: false }).first()).toBeVisible();
    await noSideScroll(page);

    await page.getByRole("link", { name: "See my plan" }).click();
    await expect(page.getByRole("heading", { name: "Your adoption plan" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "What it costs each month" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /free advisor/ })).toBeVisible();
    await noSideScroll(page);

    expect(errors).toEqual([]);
  });
}

test("the HVAC receptionist piece meets the spec", async ({ page }) => {
  await page.goto("/board?demo=hvac");
  await page.getByRole("link", { name: /Never miss a call/ }).click();
  await expect(page.getByText(/Jobber AI Receptionist/).first()).toBeVisible();
  await expect(page.getByText(/add-on/).first()).toBeVisible();
  await expect(page.getByText(/doesn't book into Jobber/).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sameday" })).toBeVisible();
  await page.getByLabel("Under budget").check();
  await expect(page.getByRole("heading", { name: "Sameday" })).toBeHidden();
});

test("a business can go from start to plan by hand, with no LLM", async ({ page }) => {
  await page.goto("/start");
  await page.getByRole("button", { name: /Retail/ }).click();
  await page.getByLabel("How many employees?").fill("4");
  await page.getByRole("button", { name: /Next: what you already use/ }).click();
  await page.getByLabel("How do you take payments?").selectOption({ label: "Square POS" });
  await page.getByLabel("What do you use for your books?").selectOption({ label: "QuickBooks Online" });
  await expect(page.getByText("Your main system: Square POS")).toBeVisible();
  await page.getByRole("button", { name: /Next: see my puzzle/ }).click();
  await page.getByRole("link", { name: /Bring customers back/ }).click();
  await page.getByRole("button", { name: "Add to my puzzle" }).first().click();
  await page.goto("/plan");
  await expect(page.getByRole("heading", { name: "Your adoption plan" })).toBeVisible();
});

test("a share link rebuilds the plan in a fresh browser", async ({ page, browser, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/board?demo=landscaper");
  await page.getByRole("link", { name: "See my plan" }).click();
  await page.getByRole("button", { name: /Copy a link/ }).click();
  await expect(page.getByRole("button", { name: /Link copied/ })).toBeVisible();
  const url = await page.evaluate(() => navigator.clipboard.readText());
  const fresh = await browser.newContext();
  const other = await fresh.newPage();
  await other.goto(url);
  await expect(other.getByRole("heading", { name: "Your adoption plan" })).toBeVisible();
  await expect(other.getByText("Smith.ai").first()).toBeVisible();
  await fresh.close();
});

test("the board works from the keyboard", async ({ page }) => {
  await page.goto("/board?demo=hvac");
  const seam = page.getByRole("button", { name: /QuickBooks Desktop: Doesn't fit/ }).first();
  await seam.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/If you moved your books/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("list view shows the same pieces", async ({ page }) => {
  await page.goto("/board?demo=dental");
  await page.getByRole("button", { name: "List" }).click();
  await expect(page.getByText("Mailchimp").first()).toBeVisible();
  await expect(page.getByText("Not allowed").first()).toBeVisible();
});
