"use client";

import { Suspense } from "react";
import { ProjectDetail } from "@/components/project-detail";

export default function ProjectPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--cx-bg)]" />}>
      <ProjectDetail projectId={params.id} />
    </Suspense>
  );
}
