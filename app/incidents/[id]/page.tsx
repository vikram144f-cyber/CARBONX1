import { IncidentInvestigation } from "@/components/incident-investigation";

export const dynamic = "force-dynamic";

export default function IncidentPage({ params, searchParams }: { params: { id: string }; searchParams?: { mode?: string } }) {
  return <IncidentInvestigation incidentId={params.id} autoOpen3D={searchParams?.mode === "3d"} />;
}
