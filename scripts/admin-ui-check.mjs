import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const origin = process.env.ADMIN_QA_ORIGIN || "http://localhost:4336";
const authenticated = process.argv.includes("--authenticated");
const output = resolve(process.env.ADMIN_QA_OUTPUT || "artifacts/custom-cms/admin");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = {
  origin,
  at: new Date().toISOString(),
  authenticated,
  cases: [],
  errors: [],
};
const consoleErrors = [];
function observe(page) {
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400)
      consoleErrors.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  page.on("console", (entry) => {
    if (entry.type() === "error") consoleErrors.push(entry.text());
  });
}
async function settleFrames(page) {
  // The preview is the real public page. Keep normal motion, but audit its
  // settled colours rather than a translucent intermediate GSAP frame.
  for (const frame of page.frames()) {
    await frame.evaluate(async () => {
      await document.fonts.ready;
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
    });
    await frame.waitForFunction(() => {
      const reveals = [...document.querySelectorAll("[data-reveal]")]
        .flatMap((element) => [element, ...element.children]);
      const textSettled = reveals.every((element) => {
        const opacity = element.style?.opacity;
        return !opacity || Number(opacity) === 1;
      });
      const logoSettled = [...document.querySelectorAll("[data-shell-animate]")]
        .every((element) => {
          const progress = element.getAttribute("data-motion-progress");
          return progress === null || Number(progress) === 0 || Number(progress) === 1;
        });
      return textSettled && logoSettled;
    }, undefined, { timeout: 10000 });
  }
}
async function inspect(page, name, width, { axe = true } = {}) {
  await page.setViewportSize({ width, height: 960 });
  await settleFrames(page);
  await page.screenshot({
    path: resolve(output, `${name}-${width}.png`),
    fullPage: true,
  });
  // Capturing a full document can expose another reveal in the iframe.
  // Let that effect finish before axe reads the resulting foreground colour.
  await settleFrames(page);
  const layout = await page.evaluate(() => ({
    width: innerWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  if (layout.documentWidth > width + 1)
    throw new Error(
      `${name} déborde à ${width}px (${layout.documentWidth}px).`,
    );
  const violations = axe
    ? (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations.map((item) => ({
        id: item.id,
        impact: item.impact,
        description: item.description,
        nodes: item.nodes.map((node) => ({
          target: node.target,
          failureSummary: node.failureSummary,
        })),
      }))
    : [];
  report.cases.push({ name, width, layout, violations });
  if (violations.length) report.errors.push({ name, width, violations });
}
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  observe(page);
  await page.goto(`${origin}/admin/login/`, { waitUntil: "networkidle" });
  await page
    .getByRole("heading", { name: "Se connecter", exact: true })
    .waitFor();
  for (const width of [360, 390, 768, 1280, 1440])
    await inspect(page, "login", width);
  await context.close();
  if (authenticated) {
    const state = JSON.parse(
      await readFile(resolve(process.env.ADMIN_QA_STATE || ".cache/admin-state.json"), "utf8"),
    );
    const context = await browser.newContext({ storageState: state });
    const page = await context.newPage();
    observe(page);
    const data = await context.request.get(
      `${origin}/api/admin/content/pages/`,
    );
    if (!data.ok())
      throw new Error(`Session de recette refusée (${data.status()}).`);
    const pages = (await data.json()).items;
    const home = pages.find((item) => item.kind === "home");
    if (!home) throw new Error("La page accueil n’est pas initialisée.");
    await page.goto(`${origin}/admin/`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: /^Bonjour/ }).waitFor();
    for (const width of [360, 390, 768, 1280, 1440])
      await inspect(page, "dashboard", width);
    await page.setViewportSize({ width: 390, height: 844 });
    await page
      .getByRole("button", { name: "Ouvrir le menu d’administration" })
      .click();
    await page.getByRole("dialog").waitFor();
    await page.keyboard.press("Tab");
    const trapped = await page.evaluate(() =>
      Boolean(document.activeElement?.closest('[role="dialog"]')),
    );
    if (!trapped) throw new Error("Le focus ne reste pas dans le menu mobile.");
    await inspect(page, "mobile-menu", 390);
    await page.keyboard.press("Escape");
    await page.getByRole("link", { name: /Contenus à vérifier/ }).click();
    await page.getByRole("button", { name: "À vérifier", pressed: true }).waitFor();
    await page.getByRole("link", { name: /Articles avec un brouillon/ }).click();
    await page.getByRole("button", { name: "Brouillons", pressed: true }).waitFor();
    await page.getByRole("searchbox", { name: "Rechercher un contenu" }).fill("absent-test-navigation");
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.getByRole("link", { name: "Pages du site", exact: true }).click();
    await page.getByRole("button", { name: "Tous", pressed: true }).waitFor();
    if (await page.getByRole("searchbox", { name: "Rechercher un contenu" }).inputValue())
      throw new Error("La recherche d’une autre rubrique a été conservée.");
    await page.getByRole("button", { name: /Accueil/ }).first().waitFor();
    const routes = [
      { path: "/admin/guide/", name: "guide", heading: "Guide de l’administration" },
      { path: "/admin/pages/", name: "pages", heading: "Les pages du site" },
      {
        path: `/admin/pages/${home.id}/`,
        name: "home-editor",
        heading: "Accueil",
      },
      {
        path: "/admin/articles/",
        name: "articles",
        heading: "Le carnet Réflexions",
      },
      {
        path: "/admin/articles/new/",
        name: "tiptap",
        heading: "Écrire une réflexion",
      },
      {
        path: "/admin/articles/import/",
        name: "pdf-import",
        heading: "Un PDF, une nouvelle réflexion",
      },
      { path: "/admin/media/", name: "media", heading: "La médiathèque" },
      {
        path: "/admin/history/",
        name: "history",
        heading: "L’histoire de votre site",
      },
      { path: "/admin/security/", name: "security", heading: /^Bonjour/ },
    ];
    for (const route of routes) {
      await page.goto(`${origin}${route.path}`, { waitUntil: "networkidle" });
      await page
        .getByRole("heading", {
          name: route.heading,
          exact: typeof route.heading === "string",
        })
        .first()
        .waitFor();
      if (route.name === "tiptap") {
        await page.locator(".tiptap").waitFor();
        const checklist = page.locator(".admin-readiness");
        await checklist.locator("summary").click();
        await checklist.getByRole("button", { name: "Ajoutez le titre de l’article." }).click();
        if (!await page.getByLabel("Titre de l’article").evaluate(input => input === document.activeElement))
          throw new Error("Le point à compléter ne donne pas le focus au champ titre.");
      }
      for (const width of [360, 390, 768, 1280, 1440])
        await inspect(page, route.name, width);
      if (route.name === "home-editor") {
        await page
          .getByRole("button", { name: "Prévisualiser", exact: true })
          .click();
        await page.locator("iframe").waitFor();
        await page
          .frameLocator("iframe")
          .getByRole("heading", { level: 1 })
          .waitFor();
        await inspect(page, "page-preview", 1440);
        await page
          .getByRole("button", { name: "Historique", exact: true })
          .click();
        await page.getByRole("dialog").waitFor();
        await inspect(page, "revisions", 1440);
        await page.keyboard.press("Escape");
      }
    }
    const teamPage = pages.find(item => item.slug === "qui-sommes-nous");
    const teamResponse = await context.request.get(`${origin}/api/admin/content/people/`);
    if (!teamPage || !teamResponse.ok()) throw new Error("Les fiches de l’équipe de recette sont indisponibles.");
    const members = (await teamResponse.json()).items.filter(person => person.status === "published");
    if (members.length === 0) throw new Error("La recette nécessite une fiche de personne publiée.");
    for (const source of [home, teamPage]) {
      await page.goto(`${origin}/admin/pages/${source.id}/`);
      if (source.kind === "home") await page.locator("summary").filter({hasText:"Pourquoi choisir Calas Conseil"}).click();
      const member = members[0];
      await page.getByRole("button", {name: member.title, exact: true}).click();
      await page.waitForURL(`${origin}/admin/people/${member.id}/`);
      await page.getByLabel("Nom complet").waitFor();
    }
    await context.close();
  }
} catch (error) {
  report.errors.push({ message: error.message });
} finally {
  report.consoleErrors = consoleErrors;
  await browser.close();
  await writeFile(
    resolve(output, authenticated ? "report.json" : "login-report.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify({
      cases: report.cases.length,
      errors: report.errors,
      consoleErrors: report.consoleErrors,
    }),
  );
  if (report.errors.length || consoleErrors.length) process.exitCode = 1;
}
