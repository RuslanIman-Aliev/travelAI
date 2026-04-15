import { expect, test } from "@playwright/test";
import { cleanupE2EData, disconnectE2EDatabase } from "./helpers/e2e-db";

const E2E_TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? "e2e@travel-ai.local";

test.describe("Trip flow", () => {
  test.beforeEach(async () => {
    if (!process.env.DATABASE_URL) return;
    await cleanupE2EData(E2E_TEST_EMAIL);
  });

  test.afterEach(async () => {
    if (!process.env.DATABASE_URL) return;
    await cleanupE2EData(E2E_TEST_EMAIL);
  });

  test.afterAll(async () => {
    await disconnectE2EDatabase();
  });

  test("login -> create trip -> redirect to trip page", async ({ page }) => {
    test.skip(
      !process.env.DATABASE_URL,
      "DATABASE_URL is required for e2e tests",
    );

    await page.route("**/api/start-trip", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          message: "Background job started",
        }),
      });
    });

    await page.goto("/");

    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForLoadState("networkidle");
    await page.reload();
    await expect(page.getByRole("button", { name: "Sign in" })).toHaveCount(0);

    await page.goto("/new-trip");

    await expect(
      page.getByRole("heading", { name: "Create Your New Journey" }),
    ).toBeVisible();

    await page.getByPlaceholder("Destination").fill("Paris");
    await page.getByPlaceholder("Country").fill("France");

    await page.getByRole("button", { name: "Start Date" }).click();

    const availableDays = page.locator(
      "[role='gridcell'] button:not([disabled])",
    );
    await expect(availableDays.first()).toBeVisible();

    const dayCount = await availableDays.count();
    if (dayCount < 5) {
      throw new Error("Not enough enabled days available in date picker");
    }

    await availableDays.nth(0).click();
    await availableDays.nth(4).click();

    await page.getByRole("button", { name: /Generate trip/i }).click();

    await expect(page).toHaveURL(/\/trip\/[a-z0-9]+/i);
    await expect(page.getByText("Processing your request")).toBeVisible();
  });
});
