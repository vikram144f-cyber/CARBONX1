import { IncidentInvestigation } from "@/components/incident-investigation";

export const dynamic = "force-dynamic";

export default function IncidentPage({ params }: { params: { id: string } }) {
  return <IncidentInvestigation incidentId={params.id} />;
}
