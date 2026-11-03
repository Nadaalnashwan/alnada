import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, IBM_Plex_Sans_Arabic } from "next/font/google";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { Providers } from "@/components/layout/Providers";
import { getCategories } from "@/lib/catalog/repo";
import { getDict } from "@/lib/i18n/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getUser } from "@/lib/supabase/server";
import "./globals.css";

const plexArabic = IBM_Plex_Sans_Arabic({ subsets: ["arabic", "latin"], weight: ["300", "400", "500", "600", "700"], variable: "--font-plex-arabic", display: "swap" });
const plexSans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-plex-sans", display: "swap" });

export const metadata: Metadata = {
  title: { default: "الندى | AL NADA — حياة خضراء تبدأ بقطرة", template: "%s | الندى AL NADA" },
  description: "متجر نباتات ذكي في السعودية مع مساعدة ندى AI ومساحتك الخضراء الشخصية. AI-powered plant store & care companion.",
};

export const viewport: Viewport = { themeColor: "#006C35" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [{ locale, t, dir }, user, categories] = await Promise.all([getDict(), getUser(), getCategories()]);
  const navCats = categories.map((c) => ({ slug: c.slug, name: locale === "ar" ? c.name_ar : c.name_en, image: c.image_url }));
  return (
    <html lang={locale} dir={dir} className={`${plexArabic.variable} ${plexSans.variable}`} suppressHydrationWarning>
      <head>
        {/* lets CSS animate scroll-reveal only when JS runs (content stays visible without JS) */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body className="min-h-dvh bg-ivory">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-saudi focus:px-4 focus:py-2 focus:text-white">
          {locale === "ar" ? "تخطَّ إلى المحتوى" : "Skip to content"}
        </a>
        <Providers locale={locale} user={user} dbReady={isSupabaseConfigured()}>
          <Header categories={navCats} />
          <main id="main">{children}</main>
          <Footer t={t} categories={navCats} />
        </Providers>
      </body>
    </html>
  );
}
