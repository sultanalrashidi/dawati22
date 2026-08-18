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
    {
      slug: "velvet-midnight",
      name: "Velvet Midnight",
      nameAr: "مخمل الليل",
      category: "luxury",
      config: {
        layout: "classic-center",
        palette: {
          bg: "#0d1321",
          surface: "#16213a",
          fg: "#f0ece0",
          fgMuted: "#a8a49a",
          accent: "#cda86a",
          accentFg: "#0d1321",
        },
        fonts: { arabicDisplay: "Amiri", arabicBody: "IBM Plex Sans Arabic", latinDisplay: "Playfair Display" },
        motion: { openStyle: "seal-break", reducedMotionFallback: "fade" },
        sections: { showCountdown: true, showMap: true, showRsvp: true },
      },
    },
    {
      slug: "black-tie",
      name: "Black Tie",
      nameAr: "بلاك تاي",
      category: "dark",
      config: {
        layout: "classic-center",
        palette: {
          bg: "#000000",
          surface: "#111111",
          fg: "#ffffff",
          fgMuted: "#9a9a9a",
          accent: "#ffffff",
          accentFg: "#000000",
        },
        fonts: { arabicDisplay: "Reem Kufi", arabicBody: "IBM Plex Sans Arabic", latinDisplay: "Inter" },
        motion: { openStyle: "curtain", reducedMotionFallback: "fade" },
        sections: { showCountdown: true, showMap: true, showRsvp: true },
      },
    },
    {
      slug: "desert-rose",
      name: "Desert Rose",
      nameAr: "وردة الصحراء",
      category: "saudi",
      config: {
        layout: "arch-frame",
        palette: {
          bg: "#f2e4d8",
          surface: "#fbf3ea",
          fg: "#4a2f22",
          fgMuted: "#8a6a54",
          accent: "#b5613f",
          accentFg: "#ffffff",
        },
        fonts: { arabicDisplay: "Reem Kufi", arabicBody: "Tajawal", latinDisplay: "Cormorant Garamond" },
        motion: { openStyle: "curtain", reducedMotionFallback: "fade" },
        sections: { showCountdown: true, showMap: true, showRsvp: true },
      },
    },
    {
      slug: "najdi-modern",
      name: "Modern Najdi",
      nameAr: "نجدي حديث",
      category: "saudi",
      config: {
        layout: "split-portrait",
        palette: {
          bg: "#efe9df",
          surface: "#ffffff",
          fg: "#262220",
          fgMuted: "#6f6a63",
          accent: "#8a2f26",
          accentFg: "#ffffff",
        },
        fonts: { arabicDisplay: "Reem Kufi", arabicBody: "Tajawal", latinDisplay: "Inter" },
        motion: { openStyle: "gate-swing", reducedMotionFallback: "fade" },
        sections: { showCountdown: true, showMap: true, showRsvp: true },
      },
    },
    {
      slug: "dusty-rose-editorial",
      name: "Dusty Rose Editorial",
      nameAr: "إديتوريال وردي",
      category: "romantic",
      config: {
        layout: "split-portrait",
        palette: {
          bg: "#f7eeec",
          surface: "#fffaf9",
          fg: "#4a2f30",
          fgMuted: "#9c7a78",
          accent: "#c98a86",
          accentFg: "#ffffff",
        },
        fonts: { arabicDisplay: "Amiri", arabicBody: "IBM Plex Sans Arabic", latinDisplay: "Playfair Display" },
        motion: { openStyle: "fade", reducedMotionFallback: "fade" },
        sections: { showCountdown: true, showMap: true, showRsvp: true },
      },
    },
    {
      slug: "pearl-luster",
      name: "Pearl Luster",
      nameAr: "لؤلؤة فاخرة",
      category: "luxury",
      config: {
        layout: "envelope-reveal",
        palette: {
          bg: "#f5f3f0",
          surface: "#ffffff",
          fg: "#15130f",
          fgMuted: "#6b6560",
          accent: "#b8a99a",
          accentFg: "#15130f",
        },
        fonts: { arabicDisplay: "Reem Kufi", arabicBody: "IBM Plex Sans Arabic", latinDisplay: "Cormorant Garamond" },
        motion: { openStyle: "seal-break", reducedMotionFallback: "fade" },
        sections: { showCountdown: true, showMap: true, showRsvp: true },
      },
    },
    {
      slug: "royal-espresso",
      name: "Royal Espresso",
      nameAr: "إسبريسو ملكي",
      category: "luxury",
      config: {
        layout: "arch-frame",
        palette: {
          bg: "#2a1c14",
          surface: "#3a2818",
          fg: "#f0e6da",
          fgMuted: "#b5a692",
          accent: "#c9a15c",
          accentFg: "#2a1c14",
        },
        fonts: { arabicDisplay: "Amiri", arabicBody: "IBM Plex Sans Arabic", latinDisplay: "Playfair Display" },
        motion: { openStyle: "gate-swing", reducedMotionFallback: "fade" },
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
