-- Epic 04: IncidentStatusHistory is an append-only audit ledger.
CREATE OR REPLACE FUNCTION prevent_incident_status_history_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'IncidentStatusHistory is immutable';
END;
$$;

CREATE TRIGGER incident_status_history_immutable
BEFORE UPDATE OR DELETE ON "IncidentStatusHistory"
FOR EACH ROW
EXECUTE FUNCTION prevent_incident_status_history_mutation();
