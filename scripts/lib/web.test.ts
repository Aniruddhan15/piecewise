import { describe, expect, it } from "vitest";
import { pageText, parseRobots, robotsAllow } from "./web";

describe("robots.txt", () => {
  it("uses the * group", () => {
    const rules = parseRobots("User-Agent: *\nDisallow: /api/\n\nSitemap: https://x/sitemap.xml");
    expect(robotsAllow(rules, "/us/app/gusto")).toBe(true);
    expect(robotsAllow(rules, "/api/apps")).toBe(false);
  });

  it("doesn't apply another bot's rules to us", () => {
    const rules = parseRobots("User-agent: BadBot\nDisallow: /\n\nUser-agent: *\nDisallow: /login/");
    expect(robotsAllow(rules, "/us/app/gusto")).toBe(true);
    expect(robotsAllow(rules, "/login/x")).toBe(false);
  });

  it("an empty Disallow allows everything", () => {
    expect(robotsAllow(parseRobots("User-agent: *\nDisallow:"), "/anything")).toBe(true);
  });

  it("a wildcard rule doesn't block the whole site", () => {
    const rules = parseRobots("User-agent: *\nDisallow: /*?utm_\nDisallow: /search");
    expect(robotsAllow(rules, "/pricing")).toBe(true);
    expect(robotsAllow(rules, "/pricing?utm_source=x")).toBe(false);
    expect(robotsAllow(rules, "/search/results")).toBe(false);
  });

  it("the longest matching rule wins", () => {
    const rules = parseRobots("User-agent: *\nDisallow: /wp-admin/\nAllow: /wp-admin/admin-ajax.php");
    expect(robotsAllow(rules, "/wp-admin/admin-ajax.php")).toBe(true);
    expect(robotsAllow(rules, "/wp-admin/edit")).toBe(false);
  });

  it("$ anchors the end of a path", () => {
    const rules = parseRobots("User-agent: *\nDisallow: /*.pdf$");
    expect(robotsAllow(rules, "/a.pdf")).toBe(false);
    expect(robotsAllow(rules, "/a.pdf/more")).toBe(true);
  });

  it("Disallow: / blocks everything", () => {
    expect(robotsAllow(parseRobots("User-agent: *\nDisallow: /"), "/anything")).toBe(false);
  });
});

describe("pageText", () => {
  it("strips scripts, styles and tags", () => {
    expect(pageText("<style>a{}</style><p>Hello <b>there</b></p><script>x()</script>")).toBe("Hello there");
  });
});
