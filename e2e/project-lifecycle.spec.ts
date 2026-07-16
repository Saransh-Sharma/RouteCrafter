import { readFile } from "node:fs/promises";
import { CURRENT_SCHEMA_VERSION } from "../src/lib/schemas";
import {
  EMPTY_PROJECT_ID,
  FULL_PROJECT_ID,
  expect,
  fullProject,
  prepareApp,
  test,
} from "./fixtures";

test("navigates the complete authenticated application shell", async ({
  seededPage: page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Products" })).toBeVisible();
  await expect(
    page.getByText("Portugal Editorial Escape").first(),
  ).toBeVisible();

  // Grouping toggles on the shelf
  await page.getByRole("tab", { name: "By country" }).click();
  await expect(
    page.getByRole("heading", { name: "Portugal", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "By series" }).click();
  await expect(
    page.getByRole("heading", { name: "Standalone products" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Settings" }).first().click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(
    page.getByRole("heading", { name: "AI Studio Settings" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "How RouteCrafter works" }),
  ).toBeVisible();

  // Legacy URLs land in the new IA
  await page.goto("/templates");
  await expect(page).toHaveURL(/\/products\/new\?mode=template/);
  await page.goto("/guide");
  await expect(page).toHaveURL(/\/settings$/);
  await page.goto("/projects");
  await expect(page).toHaveURL(/\/$/);
});

test("creates, persists, duplicates, and deletes a project", async ({
  page,
}) => {
  await prepareApp(page, { projects: [] });
  await page.goto("/products/new");

  const createButton = page.getByRole("button", { name: "Create product" });
  await expect(createButton).toBeDisabled();
  await page.getByLabel("Project name").fill("Iceland Winter Weekend");
  await page.getByLabel("Country").fill("Iceland");
  await page.getByLabel("Cities / regions").fill("Reykjavik, Vik");
  await page.getByLabel("Target audience").fill("Northern lights couples");
  await page
    .getByLabel("Positioning")
    .fill("A calm winter route with weather-flexible alternatives.");
  await page.getByRole("button", { name: "Nature/adventure" }).click();
  await page.getByRole("button", { name: "Couple" }).click();
  await page.getByLabel("Brand voice").selectOption("premium");
  await createButton.click();

  await expect(page).toHaveURL(/\/products\/[0-9a-f-]+$/);
  await expect(
    page.getByRole("heading", { name: "Iceland Winter Weekend" }),
  ).toBeVisible();
  await expect(page.getByText("Iceland", { exact: true }).first()).toBeVisible();

  const createdUrl = page.url();
  await page.reload();
  await expect(page).toHaveURL(createdUrl);
  await expect(
    page.getByRole("heading", { name: "Iceland Winter Weekend" }),
  ).toBeVisible();

  await page.getByLabel("Project actions").click();
  await page.getByRole("menuitem", { name: "Duplicate product" }).click();
  await expect(page).toHaveURL(/\/products\/[0-9a-f-]+$/);
  await expect(
    page.getByRole("heading", { name: "Iceland Winter Weekend (Copy)" }),
  ).toBeVisible();
  await page.getByText("Project activity").click();
  await expect(page.getByText("Admin duplicated this project")).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByLabel("Project actions").click();
  await page.getByRole("menuitem", { name: "Delete product" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByText("Iceland Winter Weekend").first()).toBeVisible();
  await expect(page.getByText("Iceland Winter Weekend (Copy)")).toHaveCount(0);
});

test("validates imports, resolves id collisions, and exports portable JSON", async ({
  page,
}) => {
  await prepareApp(page, { projects: [fullProject] });
  await page.goto("/");

  const fileInput = page.locator('input[type="file"][accept*="json"]');
  await fileInput.setInputFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from("{broken"),
  });
  await expect(page.getByText("File is not valid JSON.")).toBeVisible();

  await fileInput.setInputFiles({
    name: "portugal.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(fullProject)),
  });
  await expect(page).toHaveURL(new RegExp(`/products/(?!${FULL_PROJECT_ID}$).+`));
  await expect(
    page.getByRole("heading", { name: "Portugal Editorial Escape" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Export" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "Portable JSON backup" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("portugal-editorial-escape.json");
  const exported = JSON.parse(await readFile(await download.path(), "utf8"));
  expect(exported.id).not.toBe(FULL_PROJECT_ID);
  expect(exported.name).toBe("Portugal Editorial Escape");
  expect(exported.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
});

test("shows a recoverable not-found state for missing local projects", async ({
  page,
}) => {
  await prepareApp(page, { projects: [] });
  await page.goto(`/products/${EMPTY_PROJECT_ID}`);
  await expect(
    page.getByRole("heading", { name: "Product not found" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to dashboard" }).click();
  await expect(page).toHaveURL("/");
});
