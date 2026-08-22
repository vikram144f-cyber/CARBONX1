import "server-only";

import {
  GeospatialRiskService,
  type GeospatialProcessingResult,
} from "./geospatial";

export type GeospatialHandoff = GeospatialProcessingResult;

export interface EnvironmentalEventProcessor {
  process(eventId: string): Promise<GeospatialProcessingResult>;
}

export class Epic03GeospatialProcessorSeam
  implements EnvironmentalEventProcessor
{
  constructor(
    private readonly geospatial: Pick<GeospatialRiskService, "processEvent"> =
      new GeospatialRiskService(),
  ) {}

  async process(eventId: string): Promise<GeospatialProcessingResult> {
    return this.geospatial.processEvent(eventId);
  }
}

export const environmentalEventProcessor =
  new Epic03GeospatialProcessorSeam();
