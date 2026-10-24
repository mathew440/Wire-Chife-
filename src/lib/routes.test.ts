import { appPathname, withBasePath } from "@/lib/base-path";
import { matchRoute } from "@/lib/routes";
import { describe, expect, it } from "vitest";

describe("Pages base path", () => {
  it("prefixes app links and strips the public prefix back off", () => {
    expect(withBasePath("/")).toBe("/Wire-Chife-/");
    expect(withBasePath("/projects/sample-findley")).toBe("/Wire-Chife-/projects/sample-findley/");
    expect(withBasePath("/Wire-Chife-/crew/")).toBe("/Wire-Chife-/crew/");
    expect(appPathname("/Wire-Chife-/projects/sample-findley/")).toBe("/projects/sample-findley");
    expect(appPathname("/Wire-Chife-/")).toBe("/");
  });

  it("opens a job id that was not known at build time", () => {
    expect(matchRoute("/Wire-Chife-/projects/sample-findley/reports/new/")).toEqual({
      name: "report",
      id: "sample-findley",
      reportId: "new",
    });
    expect(matchRoute("/projects/new")).toEqual({ name: "project-new" });
    expect(matchRoute("/Wire-Chife-/nope")).toEqual({ name: "missing" });
  });
});
