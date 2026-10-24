"use client";

import { AppLink, useAppPathname } from "@/components/app-link";
import { CrewBoard } from "@/components/crew-board";
import { DataScreen } from "@/components/data-screen";
import { EstimateEditor, EstimateList } from "@/components/estimate-screens";
import { FileList, FileViewer } from "@/components/file-screens";
import { JobsHome } from "@/components/jobs-home";
import { EditProject, ProjectForm } from "@/components/project-form";
import { ProjectDashboard } from "@/components/project-dashboard";
import { ReportEditor, ReportList } from "@/components/report-screens";
import { EmptyState, PageFallback } from "@/components/states";
import { TaskEditor, TaskList } from "@/components/task-screens";
import { Button } from "@/components/ui/button";
import { matchRoute, type AppRoute } from "@/lib/routes";
import { useMemo } from "react";

export function ClientRoutes() {
  const path = useAppPathname();
  if (path === null) return <PageFallback label="Opening the job book…" />;
  return <RouteView key={path} route={matchRoute(path)} />;
}

function RouteView({ route }: { route: AppRoute }) {
  const projectId = "id" in route ? route.id : "";
  const projectParams = useMemo(() => Promise.resolve({ id: projectId }), [projectId]);
  const reportId = route.name === "report" ? route.reportId : "";
  const reportParams = useMemo(() => Promise.resolve({ id: projectId, reportId }), [projectId, reportId]);
  const taskId = route.name === "task" ? route.taskId : "";
  const taskParams = useMemo(() => Promise.resolve({ id: projectId, taskId }), [projectId, taskId]);
  const estimateId = route.name === "estimate" ? route.estimateId : "";
  const estimateParams = useMemo(() => Promise.resolve({ id: projectId, estimateId }), [projectId, estimateId]);
  const fileId = route.name === "file" ? route.fileId : "";
  const fileParams = useMemo(() => Promise.resolve({ id: projectId, fileId }), [projectId, fileId]);

  switch (route.name) {
    case "home":
      return <JobsHome />;
    case "crew":
      return <CrewBoard />;
    case "data":
      return <DataScreen />;
    case "project-new":
      return <ProjectForm />;
    case "project":
      return <ProjectDashboard params={projectParams} />;
    case "project-edit":
      return <EditProject params={projectParams} />;
    case "reports":
      return <ReportList params={projectParams} />;
    case "report":
      return <ReportEditor params={reportParams} />;
    case "tasks":
      return <TaskList params={projectParams} />;
    case "task":
      return <TaskEditor params={taskParams} />;
    case "estimates":
      return <EstimateList params={projectParams} />;
    case "estimate":
      return <EstimateEditor params={estimateParams} />;
    case "files":
      return <FileList params={projectParams} />;
    case "file":
      return <FileViewer params={fileParams} />;
    default:
      return (
        <EmptyState
          title="That page is not in Wire Chief"
          body="Jobs, crew, and the data tools are on this device."
          action={
            <Button nativeButton={false} render={<AppLink href="/" />}>
              Back to jobs
            </Button>
          }
        />
      );
  }
}
