const { PrismaClient } = require("@prisma/client");

async function testConnection(url, name) {
  console.log(`Testing ${name}: ${url.replace(/:[^:@]+@/, ":***@")}...`);
  const prisma = new PrismaClient({
    datasources: { db: { url } },
  });
  try {
    const portfolio = await prisma.portfolio.findFirst();
    console.log(`✓ ${name} SUCCESS: Found portfolio ${portfolio?.id}`);
    const count = await prisma.carbonProject.count();
    console.log(`✓ ${name} CarbonProject count: ${count}`);
    return true;
  } catch (err) {
    console.error(`✗ ${name} FAILED:`, err.message);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

async function run() {
  const url5432 = "postgresql://postgres.adkfzhmjblrivukuhlvp:Nikhilvikram09@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres";
  const url6543 = "postgresql://postgres.adkfzhmjblrivukuhlvp:Nikhilvikram09@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true";
  const urlDirect = "postgresql://postgres.adkfzhmjblrivukuhlvp:Nikhilvikram09@db.adkfzhmjblrivukuhlvp.supabase.co:5432/postgres";

  await testConnection(url5432, "Pooler Port 5432");
  await testConnection(url6543, "Pooler Port 6543 (pgbouncer)");
  await testConnection(urlDirect, "Direct DB Connection (db.adkfzhmjblrivukuhlvp.supabase.co)");
}

run();
