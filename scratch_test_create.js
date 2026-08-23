const { PrismaClient, BoundaryQuality, HoldingStatus } = require("@prisma/client");
const prisma = new PrismaClient();

async function run() {
  try {
    const portfolio = await prisma.portfolio.findFirst();
    const projectId = "project_test_kallar_" + Date.now().toString(36);

    const geojsonPayload = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [76.92, 11.31],
            [76.95, 11.31],
            [76.95, 11.34],
            [76.92, 11.34],
            [76.92, 11.31],
          ],
        ],
      },
    };

    const project = await prisma.$transaction(async (tx) => {
      const p = await tx.carbonProject.create({
        data: {
          id: projectId,
          portfolioId: portfolio.id,
          name: "Kallar Eco Corridor Test",
          description: "Western Ghats ecological corridor reforestation",
          registryId: "VCS-4421",
          methodology: "AR-ACM0003",
          countryCode: "IN",
          centroidLng: 76.935,
          centroidLat: 11.325,
        },
      });

      await tx.projectBoundary.create({
        data: {
          projectId: p.id,
          version: 1,
          geojson: geojsonPayload,
          source: "Uploaded GeoJSON / Shapefile Verification",
          quality: BoundaryQuality.HIGH,
          areaHa: 1080.0,
          acquiredAt: new Date(),
          isCurrent: true,
        },
      });

      await tx.creditHolding.create({
        data: {
          projectId: p.id,
          vintage: 2024,
          registrySerialRef: `SERIAL-${p.id}-2024`,
          issuedQuantity: 108000.0,
          heldQuantity: 108000.0,
          status: HoldingStatus.ACTIVE,
          refValuePerUnit: 24.5,
          refCurrency: "USD",
          valuationBasis: "MARKET",
        },
      });

      return p;
    });

    console.log("Successfully created project:", project.id, project.name);
  } catch (e) {
    console.error("Creation error:", e);
  } finally {
    await prisma.$disconnect();
  }
}

run();
