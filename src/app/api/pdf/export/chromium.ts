import { chromium } from "playwright";

export type PdfChromiumBrowser = Awaited<ReturnType<typeof chromium.launch>>;

export async function launchPdfChromium(): Promise<PdfChromiumBrowser> {
  if (process.env.VERCEL && !process.env.PLAYWRIGHT_BROWSERS_PATH) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = "0";
  }
  return chromium.launch({ headless: true });
}
