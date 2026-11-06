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

  it("Disallow: / blocks everything", () => {
    expect(robotsAllow(parseRobots("User-agent: *\nDisallow: /"), "/anything")).toBe(false);
  });
});

describe("pageText", () => {
  it("strips scripts, styles and tags", () => {
    expect(pageText("<style>a{}</style><p>Hello <b>there</b></p><script>x()</script>")).toBe("Hello there");
  });
});
