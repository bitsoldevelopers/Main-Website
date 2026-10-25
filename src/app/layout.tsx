import type { Metadata } from "next";
import { Fraunces, Geist_Mono, Inter, Montserrat } from "next/font/google";
import "./globals.css";
import { JsonLd } from "@/components/JsonLd";
import { DEFAULT_OG_IMAGE, SITE_URL } from "@/lib/seo";

// Editorial type system: Fraunces for display headings, Inter for text,
// Geist Mono for eyebrow labels and small data.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: "variable",
  axes: ["opsz", "SOFT", "WONK"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

// Only the logo wordmark still uses Montserrat.
const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["800"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "BITSOL Marketing | Digital Marketing Agency in Pakistan",
    template: "%s | BITSOL Marketing",
  },
  description:
    "BITSOL Marketing is a digital marketing agency in Pakistan offering SEO, social media, Meta Ads, Google Ads, web development and AI automation.",
  keywords: [
    "digital marketing agency Pakistan",
    "SEO services Pakistan",
    "social media marketing Pakistan",
    "Google Ads agency Pakistan",
    "Meta Ads agency Pakistan",
    "web development company Pakistan",
    "content marketing agency",
    "Google Business Profile optimization",
    "digital marketing agency Lahore",
    "digital marketing agency Karachi",
    "BITSOL Marketing",
    "branding agency Pakistan",
  ],
  authors: [{ name: "BITSOL Marketing Team" }],
  creator: "BITSOL Marketing PVT LTD",
  publisher: "BITSOL Marketing PVT LTD",
  // No site-wide canonical here: child pages inherit layout metadata, so a
  // canonical set in the layout pointed every page without its own at the
  // homepage. The homepage sets its canonical in app/page.tsx.
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "BITSOL Marketing",
    title: "BITSOL Marketing | Digital Marketing Agency in Pakistan",
    description:
      "Grow your business with BITSOL Marketing — result-driven SEO, social media marketing, Google Ads, Meta Ads, web development, and content marketing for brands in Pakistan and globally.",
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "BITSOL Marketing | Digital Marketing Agency Pakistan",
    description:
      "Result-driven SEO, social media marketing, Google Ads, Meta Ads & web development for brands in Pakistan and worldwide.",
    images: [DEFAULT_OG_IMAGE.url],
  },
  verification: {
    google: "5_RFeyfgeVNvRbrwLfiLK_2nnc81N04BypWiVuQDPgE",
  },
  // Verifies the site for the AdSense account. The meta tag is in the server
  // HTML, so verification doesn't depend on the ad script having run.
  other: {
    "google-adsense-account": "ca-pub-3048586262273150",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

import { ThemeProvider } from "@/components/theme-provider";
import Script from "next/script";

const siteSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": ["Organization", "LocalBusiness", "ProfessionalService"],
      "@id": "https://bitsolmarketing.com/#organization",
      "name": "BITSOL Marketing PVT LTD",
      "alternateName": "BITSOL Marketing",
      "url": "https://bitsolmarketing.com",
      "logo": {
        "@type": "ImageObject",
        "@id": "https://bitsolmarketing.com/#logo",
        "url": "https://bitsolmarketing.com/logo.png",
        "width": 200,
        "height": 200,
        "caption": "BITSOL Marketing"
      },
      "image": DEFAULT_OG_IMAGE.url,
      "description": "BITSOL Marketing is a results-driven digital marketing agency in Pakistan. We offer SEO, social media marketing, Meta Ads, Google Ads, web development, content marketing, and Google Business Profile optimization.",
      "foundingDate": "2020",
      "priceRange": "$",
      "telephone": "+923103175175",
      "email": "info@bitsolmarketing.com",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "83/3 C KB Commercial, Phase 1, DHA",
        "addressLocality": "Lahore",
        "addressRegion": "Punjab",
        "postalCode": "54792",
        "addressCountry": "PK"
      },
      "geo": {
        "@type": "GeoCoordinates",
        "latitude": "31.4697",
        "longitude": "74.4158"
      },
      "openingHoursSpecification": [
        {
          "@type": "OpeningHoursSpecification",
          "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday"],
          "opens": "09:00",
          "closes": "18:00"
        }
      ],
      "areaServed": [
        { "@type": "Country", "name": "Pakistan" },
        { "@type": "Country", "name": "United Arab Emirates" },
        { "@type": "Country", "name": "United Kingdom" },
        { "@type": "Country", "name": "United States" }
      ],
      "hasOfferCatalog": {
        "@type": "OfferCatalog",
        "name": "Digital Marketing Services",
        "itemListElement": [
          { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "SEO Services", "url": "https://bitsolmarketing.com/services/seo-optimization" } },
          { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Social Media Marketing", "url": "https://bitsolmarketing.com/services/digital-marketing" } },
          { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Google Ads Management", "url": "https://bitsolmarketing.com/services/digital-marketing" } },
          { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Meta Ads Management", "url": "https://bitsolmarketing.com/services/digital-marketing" } },
          { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Web Development", "url": "https://bitsolmarketing.com/services/web-development" } },
          { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Content Marketing", "url": "https://bitsolmarketing.com/services/digital-marketing" } },
          { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Google Business Profile Optimization", "url": "https://bitsolmarketing.com/services/seo-optimization" } },
          { "@type": "Offer", "itemOffered": { "@type": "Service", "name": "Branding", "url": "https://bitsolmarketing.com/services/digital-marketing" } }
        ]
      },
      "contactPoint": [
        {
          "@type": "ContactPoint",
          "telephone": "+923103175175",
          "contactType": "customer service",
          "areaServed": ["PK", "AE", "GB", "US"],
          "availableLanguage": ["English", "Urdu"]
        },
        {
          "@type": "ContactPoint",
          "contactType": "sales",
          "email": "info@bitsolmarketing.com",
          "availableLanguage": ["English", "Urdu"]
        }
      ],
      "sameAs": [
        "https://www.facebook.com/bitsolmarketing/",
        "https://www.linkedin.com/company/bitsolpvtltd/",
        "https://www.instagram.com/bitsol_marketing/"
      ]
    },
    {
      "@type": "WebSite",
      "@id": "https://bitsolmarketing.com/#website",
      "url": "https://bitsolmarketing.com",
      "name": "BITSOL Marketing",
      "description": "Result-driven digital marketing agency in Pakistan — SEO, social media, Google Ads, Meta Ads, and web development.",
      "publisher": { "@id": "https://bitsolmarketing.com/#organization" }
    }
  ]
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Analytics loads once the browser is idle: on mid-range Android
            phones these scripts competed with the page for the main thread. */}
        <Script
          id="gtm-script"
          strategy="lazyOnload"
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-KMPSR8SX');`,
          }}
        />
        <JsonLd data={siteSchema} />
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-J473YSMZKE"
          strategy="lazyOnload"
        />
        <Script id="gtag-init" strategy="lazyOnload">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-J473YSMZKE');
          `}
        </Script>
        {/* Google AdSense. Loads once the browser is idle, like analytics, so
            ad code never competes with the page for the main thread. */}
        <Script
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3048586262273150"
          crossOrigin="anonymous"
          strategy="lazyOnload"
        />
      </head>
      <body
        className={`${fraunces.variable} ${inter.variable} ${geistMono.variable} ${montserrat.variable} font-sans antialiased bg-background text-foreground`}
        suppressHydrationWarning
      >
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-KMPSR8SX"
            height="0"
            width="0"
            className="hidden invisible"
          />
        </noscript>
        {/* The editorial theme is light only, so the visitor's OS preference
            and the old toggle no longer switch the palette. */}
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          forcedTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          {/* Page chrome (navbar, footer, widgets) lives in app/(site)/layout.tsx;
              the admin under app/admin renders its own shell. */}
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
