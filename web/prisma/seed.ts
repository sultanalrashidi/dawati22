import "dotenv/config";
import { PrismaClient, Prisma, Role, ThemeStatus } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { ThemeConfig } from "../src/lib/themes/types";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const admin = await prisma.user.upsert({
    where: { phone: "+966500000001" },
    update: {},
    create: {
      phone: "+966500000001",
      name: "مدير دعوتي",
      role: Role.ADMIN,
      phoneVerifiedAt: new Date(),
    },
  });

  const gateUser = await prisma.user.upsert({
    where: { phone: "+966500000002" },
    update: {},
    create: {
      phone: "+966500000002",
      name: "موظف البوابة",
      role: Role.GATE_STAFF,
      phoneVerifiedAt: new Date(),
    },
  });

  await prisma.gateStaff.upsert({
    where: { userId: gateUser.id },
    update: {},
    create: { userId: gateUser.id, name: gateUser.name, phone: gateUser.phone },
  });

  const plans = [
    { name: "Starter", nameAr: "الأساسية", invitationCount: 50, price: 299, sortOrder: 1 },
    { name: "Signature", nameAr: "المميزة", invitationCount: 150, price: 699, sortOrder: 2 },
    { name: "Grand", nameAr: "الفاخرة", invitationCount: 500, price: 1799, sortOrder: 3 },
  ];

  for (const plan of plans) {
    const existing = await prisma.plan.findFirst({ where: { nameAr: plan.nameAr } });
    if (existing) {
      await prisma.plan.update({ where: { id: existing.id }, data: plan });
    } else {
      await prisma.plan.create({ data: plan });
    }
  }

  const themes: Array<{
    slug: string;
    name: string;
    nameAr: string;
    category: string;
    config: ThemeConfig;
  }> = [
    {
      slug: "palace-gold",
      name: "Royal Palace",
      nameAr: "قصر ملكي",
      category: "luxury",
      config: {
        layout: "arch-frame",
        palette: {
          bg: "#14110d",
          surface: "#1e1912",
          fg: "#f3ede3",
          fgMuted: "#b8ac9a",
          accent: "#d4af74",
          accentFg: "#14110d",
        },
        fonts: { arabicDisplay: "Aref Ruqaa", arabicBody: "IBM Plex Sans Arabic", latinDisplay: "Cormorant Garamond" },
        motion: { openStyle: "arch-reveal", reducedMotionFallback: "fade" },
        sections: { showCountdown: true, showMap: true, showRsvp: true },
      },
    },
    {
      slug: "modern-minimal",
      name: "Modern Minimal",
      nameAr: "مينيمال حديث",
      category: "minimal",
      config: {
        layout: "classic-center",
        palette: {
          bg: "#faf9f7",
          surface: "#ffffff",
          fg: "#161513",
          fgMuted: "#6f6a62",
          accent: "#161513",
          accentFg: "#ffffff",
        },
        fonts: { arabicDisplay: "Reem Kufi", arabicBody: "IBM Plex Sans Arabic", latinDisplay: "Inter" },
        motion: { openStyle: "fade", reducedMotionFallback: "fade" },
        sections: { showCountdown: true, showMap: true, showRsvp: true },
      },
    },
    {
      slug: "botanical-garden",
      name: "Garden Estate",
      nameAr: "حديقة فاخرة",
      category: "botanical",
      config: {
        layout: "envelope-reveal",
        palette: {
          bg: "#f4f1e8",
          surface: "#fffdf7",
          fg: "#2b3327",
          fgMuted: "#6b7460",
          accent: "#5c6e4f",
          accentFg: "#ffffff",
        },
        fonts: { arabicDisplay: "Amiri", arabicBody: "IBM Plex Sans Arabic", latinDisplay: "Cormorant Garamond" },
        motion: { openStyle: "envelope", reducedMotionFallback: "fade" },
        sections: { showCountdown: true, showMap: true, showRsvp: true },
      },
    },
  ];

  for (const theme of themes) {
    await prisma.theme.upsert({
      where: { slug: theme.slug },
      update: { config: theme.config as unknown as Prisma.InputJsonValue, name: theme.name, nameAr: theme.nameAr, category: theme.category },
      create: {
        slug: theme.slug,
        name: theme.name,
        nameAr: theme.nameAr,
        category: theme.category,
        config: theme.config as unknown as Prisma.InputJsonValue,
        status: ThemeStatus.PUBLISHED,
        createdById: admin.id,
      },
    });
  }

  console.log("Seeded:", {
    admin: admin.phone,
    gateStaff: gateUser.phone,
    plans: plans.length,
    themes: themes.length,
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
