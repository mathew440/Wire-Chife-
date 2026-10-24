import { appPathname, withBasePath } from "@/lib/base-path";
import { matchRoute } from "@/lib/routes";
import { describe, expect, it } from "vitest";

describe("Pages base path", () => {
  it("prefixes app links and strips the public prefix back off", () => {
    expect(withBasePath("/")).toBe("/Wire-Chife-/");
    expect(withBasePath("/projects/sample-job-a")).toBe("/Wire-Chife-/projects/sample-job-a/");
    expect(withBasePath("/Wire-Chife-/crew/")).toBe("/Wire-Chife-/crew/");
    expect(appPathname("/Wire-Chife-/projects/sample-job-a/")).toBe("/projects/sample-job-a");
    expect(appPathname("/Wire-Chife-/")).toBe("/");
  });

  it("opens a job id that was not known at build time", () => {
    expect(matchRoute("/Wire-Chife-/projects/sample-job-a/reports/new/")).toEqual({
      name: "report",
      id: "sample-job-a",
      reportId: "new",
    });
    expect(matchRoute("/projects/new")).toEqual({ name: "project-new" });
    expect(matchRoute("/Wire-Chife-/nope")).toEqual({ name: "missing" });
  });
});
