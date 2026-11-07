import { expect, test, type Page } from "@playwright/test";

const DEMOS = [/Restaurant on Toast/, /Coffee shop on Square/, /HVAC tech/, /Landscaper/, /Dental office/];

async function noSideScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

for (const demo of DEMOS) {
  test(`${demo.source} reaches the plan with no errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/");
    await page.getByRole("link", { name: demo }).click();
    await expect(page.getByRole("heading", { name: "Your kit" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await noSideScroll(page);

    await page.getByRole("link", { name: "See my plan" }).first().click();
    await expect(page.getByRole("heading", { name: /Your kit/, level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "What it costs each month" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /free advisor/ })).toBeVisible();
    await noSideScroll(page);

    expect(errors).toEqual([]);
  });
}

test("the HVAC receptionist piece meets the spec", async ({ page }) => {
  await page.goto("/block/customer_comm?demo=hvac");
  await expect(page.getByText(/Jobber AI Receptionist/).first()).toBeVisible();
  await expect(page.getByText(/add-on/).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sameday" })).toBeVisible();
  await page.getByLabel("Under budget").check();
  await expect(page.getByRole("heading", { name: "Sameday" })).toBeHidden();
});

test("a tool page shows the catch, account steps and setup steps", async ({ page }) => {
  await page.goto("/tool/rosie?block=customer_comm&demo=hvac");
  await expect(page.getByRole("heading", { name: "Rosie", level: 1 })).toBeVisible();
  await expect(page.getByText(/doesn't book into Jobber/).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Set it up and use it" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Visit / })).toBeVisible();
  // Rosie is already in the HVAC demo kit: take it out, then put it back.
  await page.getByRole("button", { name: "In my kit" }).click();
  await page.getByRole("button", { name: "Add to my kit" }).first().click();
  await expect(page.getByRole("button", { name: "In my kit" })).toBeVisible();
});

test("options page shows tools as cards that lead to the tool page", async ({ page }) => {
  await page.goto("/block/reviews?demo=coffee");
  await expect(page.getByText("Best match for you")).toBeVisible();
  await page.getByRole("link", { name: /See how it works/ }).first().click();
  await page.waitForURL(/\/tool\//);
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
});

test("two taps get a new business to picks, with no LLM", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Retail/ }).click();
  await page.getByRole("button", { name: /Customers don't come back/ }).click();
  await page.getByRole("button", { name: "Show my picks" }).click();
  await expect(page.getByRole("heading", { name: "Bring customers back", level: 1 })).toBeVisible();

  // The payments question matters for retail, so it's asked, and answering it re-checks the picks.
  await expect(page.getByRole("heading", { name: "How do you take payments?" })).toBeVisible();
  await page.getByRole("button", { name: "Square POS" }).click();
  await expect(page.getByText("Updated your picks for Square POS.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "How do you take payments?" })).toBeHidden();

  // Picking a tool fills the piece and moves on to the next job by itself.
  await page.getByRole("button", { name: /^Add to my kit/ }).first().click();
  await expect(page.getByRole("status").filter({ hasText: /^Added .*Next:/ })).toBeVisible();
  await expect(page.getByText("Job 2 of")).toBeVisible();
  await page.getByRole("link", { name: "See my plan" }).first().click();
  await page.waitForURL("**/plan");
  await expect(page.getByRole("heading", { name: /Your kit/, level: 1 })).toBeVisible();
});

test("a share link rebuilds the plan in a fresh browser", async ({ page, browser, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/plan?demo=landscaper");
  await page.getByRole("button", { name: /Send this plan/ }).click();
  await expect(page.getByRole("button", { name: /Link copied/ })).toBeVisible();
  const url = await page.evaluate(() => navigator.clipboard.readText());
  const fresh = await browser.newContext();
  const other = await fresh.newPage();
  await other.goto(url);
  await expect(other.getByRole("heading", { name: /Your kit/, level: 1 })).toBeVisible();
  await expect(other.getByText("Smith.ai").first()).toBeVisible();
  await fresh.close();
});

test("the kit can be closed from the keyboard without buying anything", async ({ page }) => {
  await page.goto("/matches?demo=dental");
  await expect(page.getByRole("heading", { name: "Your kit" })).toBeVisible();
  for (let i = 0; i < 8; i++) {
    if (await page.getByRole("heading", { name: "Your kit is complete" }).isVisible()) break;
    const skip = page.getByRole("button", { name: "I'm fine here" });
    if ((await skip.count()) > 0) {
      await skip.focus();
      await page.keyboard.press("Enter");
      await page.waitForTimeout(1200); // the shape fills in, then the next job slides in
    } else {
      await page.getByRole("button", { name: "Next job" }).press("Enter");
      await page.waitForTimeout(400);
    }
  }
  await expect(page.getByText("Complete! Every job has an answer.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your kit is complete" })).toBeVisible();
});

test("next job and previous move between jobs by hand", async ({ page }) => {
  await page.goto("/matches?demo=coffee");
  const title = page.locator("#job-title");
  await expect(title).toBeVisible();
  const first = await title.innerText();
  await page.getByRole("button", { name: "Next job" }).click();
  await expect(title).not.toHaveText(first);
  await page.getByRole("button", { name: "Previous" }).click();
  await expect(title).toHaveText(first);
});

test("see everything lists only jobs with an answer", async ({ page }) => {
  await page.goto("/board?demo=dental");
  await expect(page.getByRole("heading", { name: "Every job, every tool" })).toBeVisible();
  await expect(page.getByText(/In your kit: Mailchimp/)).toBeVisible();
  await expect(page.getByText(/0 tools work/)).toHaveCount(0);
});

test("larger text makes the page text bigger and is remembered", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Larger text" }).click();
  await expect(page.locator("html")).toHaveClass(/text-large/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/text-large/);
});
