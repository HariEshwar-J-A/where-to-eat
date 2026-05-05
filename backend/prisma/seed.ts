import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.visitHistory.deleteMany();
  await prisma.restaurant.deleteMany();

  await prisma.restaurant.createMany({
    data: [
      { name: "Taco Fiesta", cuisine: "Mexican" },
      { name: "Bangkok Street", cuisine: "Thai" },
      { name: "Luigi's Trattoria", cuisine: "Italian" },
      { name: "Sakura Bowl", cuisine: "Japanese" },
      { name: "The Smoke Pit", cuisine: "BBQ" },
      { name: "Naan & Curry", cuisine: "Indian" },
      { name: "Seoul Kitchen", cuisine: "Korean" },
      { name: "Grain & Greens", cuisine: "Vegan" },
      { name: "Le Bistro", cuisine: "French" },
      { name: "Diner Deluxe", cuisine: "American" },
      { name: "Hummus House", cuisine: "Middle Eastern" },
      { name: "Dragon Wok", cuisine: "Chinese" },
    ],
  });

  console.log("Seeded restaurants.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
