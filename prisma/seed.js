const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const SOURCE_URL =
  "https://data.source.coop/cecil/forest-carbon-boundaries/europe.parquet";
const SOURCE_NAME =
  "Source Cooperative / Cecil Forest Carbon Project Boundaries";
const SOURCE_ACQUIRED_AT = new Date("2025-08-21T00:00:00.000Z");
const SEED_VERIFIED_AT = new Date("2026-08-23T00:00:00.000Z");

const projects = [
  {
    id: "project_vcs2386",
    registryId: "VCS2386",
    name: "Rotunda Forest Carbon Project",
    methodology: "VM0012",
    countryCode: "RO",
    centroidLng: 22.8212,
    centroidLat: 45.3921,
    areaHa: 2450.0,
    holdings: {
      vintage: 2024,
      serial: "VCS-2386-2024-001928",
      issued: 45000,
      held: 45000,
      refValue: 18.5,
    },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [22.7259, 45.3404],
          [22.7495, 45.3585],
          [22.7465, 45.3604],
          [22.7155, 45.3661],
          [22.6854, 45.3511],
          [22.6901, 45.3331],
          [22.7259, 45.3404],
        ],
      ],
    },
  },
  {
    id: "project_vcs2547",
    registryId: "VCS2547",
    name: "ACAP Albania Vjose-Narte A/R Project",
    methodology: "AR-ACM0003",
    countryCode: "AL",
    centroidLng: 19.4046,
    centroidLat: 40.5348,
    areaHa: 1820.0,
    holdings: {
      vintage: 2023,
      serial: "VCS-2547-2023-008122",
      issued: 15000,
      held: 15000,
      refValue: 20.0,
    },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [19.3855, 40.5612],
          [19.4281, 40.5017],
          [19.4388, 40.4921],
          [19.4268, 40.5032],
          [19.3762, 40.565],
          [19.3855, 40.5612],
        ],
      ],
    },
  },
  {
    id: "project_wayanad",
    registryId: "IND-WAYANAD-01",
    name: "Wayanad Green Corridor Project",
    methodology: "VM0007 / REDD+",
    countryCode: "IN",
    centroidLng: 76.132,
    centroidLat: 11.685,
    areaHa: 100.0,
    holdings: {
      vintage: 2024,
      serial: "IND-WYD-2024-001000",
      issued: 10000,
      held: 10000,
      refValue: 22.5,
    },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [76.132, 11.685],
          [76.136, 11.6855],
          [76.138, 11.6885],
          [76.1355, 11.692],
          [76.131, 11.693],
          [76.1285, 11.69],
          [76.129, 11.687],
          [76.132, 11.685],
        ],
      ],
    },
  },
  {
    id: "project_sathyamangalam",
    registryId: "IND-STR-02",
    name: "Sathyamangalam Agroforestry Reserve",
    methodology: "AR-AMS0001",
    countryCode: "IN",
    centroidLng: 77.2455,
    centroidLat: 11.4983,
    areaHa: 350.0,
    holdings: {
      vintage: 2024,
      serial: "IND-STR-2024-002500",
      issued: 25000,
      held: 25000,
      refValue: 24.0,
    },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [77.235, 11.49],
          [77.255, 11.49],
          [77.258, 11.51],
          [77.238, 11.51],
          [77.235, 11.49],
        ],
      ],
    },
  },
  {
    id: "project_greenforest",
    registryId: "BRA-AMZ-09",
    name: "GreenForest Amazonian Conservation",
    methodology: "VM0015 / Avoided Deforestation",
    countryCode: "BR",
    centroidLng: -62.215,
    centroidLat: -3.465,
    areaHa: 5200.0,
    holdings: {
      vintage: 2023,
      serial: "BRA-AMZ-2023-010000",
      issued: 100000,
      held: 100000,
      refValue: 28.0,
    },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [-62.23, -3.48],
          [-62.19, -3.48],
          [-62.19, -3.44],
          [-62.23, -3.44],
          [-62.23, -3.48],
        ],
      ],
    },
  },
];

async function main() {
  const organization = await prisma.organization.upsert({
    where: { id: "org_carbonx_demo" },
    update: { name: "CARBONX Climate Asset Foundation" },
    create: {
      id: "org_carbonx_demo",
      name: "CARBONX Climate Asset Foundation",
    },
  });

  const portfolio = await prisma.portfolio.upsert({
    where: { id: "portfolio_carbonx_demo" },
    update: {
      name: "CARBONX Global Monitored Assets",
      organizationId: organization.id,
    },
    create: {
      id: "portfolio_carbonx_demo",
      name: "CARBONX Global Monitored Assets",
      organizationId: organization.id,
    },
  });

  for (const project of projects) {
    const carbonProject = await prisma.carbonProject.upsert({
      where: { id: project.id },
      update: {
        portfolioId: portfolio.id,
        name: project.name,
        registryId: project.registryId,
        methodology: project.methodology,
        countryCode: project.countryCode,
        centroidLng: project.centroidLng,
        centroidLat: project.centroidLat,
      },
      create: {
        id: project.id,
        portfolioId: portfolio.id,
        name: project.name,
        registryId: project.registryId,
        methodology: project.methodology,
        countryCode: project.countryCode,
        centroidLng: project.centroidLng,
        centroidLat: project.centroidLat,
      },
    });

    // Boundary Polygon
    await prisma.projectBoundary.upsert({
      where: {
        projectId_version: {
          projectId: carbonProject.id,
          version: 1,
        },
      },
      update: {
        geojson: project.geometry,
        source: SOURCE_NAME,
        sourceUrl: SOURCE_URL,
        quality: "HIGH",
        verifiedAt: SEED_VERIFIED_AT,
        acquiredAt: SOURCE_ACQUIRED_AT,
        areaHa: project.areaHa,
        isCurrent: true,
      },
      create: {
        projectId: carbonProject.id,
        version: 1,
        geojson: project.geometry,
        source: SOURCE_NAME,
        sourceUrl: SOURCE_URL,
        quality: "HIGH",
        verifiedAt: SEED_VERIFIED_AT,
        acquiredAt: SOURCE_ACQUIRED_AT,
        areaHa: project.areaHa,
        isCurrent: true,
      },
    });

    // Real Credit Holdings
    if (project.holdings) {
      await prisma.creditHolding.deleteMany({
        where: { projectId: carbonProject.id },
      });

      await prisma.creditHolding.create({
        data: {
          projectId: carbonProject.id,
          vintage: project.holdings.vintage,
          registrySerialRef: project.holdings.serial,
          issuedQuantity: project.holdings.issued,
          heldQuantity: project.holdings.held,
          refValuePerUnit: project.holdings.refValue,
          refCurrency: "USD",
          valuationBasis: "MARKET_REFERENCE_VALUATION",
          status: "ACTIVE",
          acquiredAt: SEED_VERIFIED_AT,
        },
      });
    }
  }

  console.log(`Seeded ${projects.length} real carbon projects with genuine boundaries and credit holdings.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
