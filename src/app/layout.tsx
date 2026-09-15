import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import "@/components/navbar/navbar.css";
import SmoothScroll from "@/components/SmoothScroll";
import Navbar from "@/components/navbar/Navbar";
import Footer from "@/components/Footer";
import { Entropy } from "@/components/ClientDynamics";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://bitsolmarketing.com"),
  title: {
    default: "BITSOL Marketing | Digital Marketing Agency in Pakistan",
    template: "%s | BITSOL Marketing",
  },
  description:
    "BITSOL Marketing is a results-driven digital marketing agency in Pakistan. We offer SEO, social media marketing, Meta Ads, Google Ads, web development, content marketing, and Google Business Profile optimization.",
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
  alternates: {
    canonical: "https://bitsolmarketing.com",
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://bitsolmarketing.com",
    siteName: "BITSOL Marketing",
    title: "BITSOL Marketing | Digital Marketing Agency in Pakistan",
    description:
      "Grow your business with BITSOL Marketing — result-driven SEO, social media marketing, Google Ads, Meta Ads, web development, and content marketing for brands in Pakistan and globally.",
    images: [
      {
        url: "https://bitsolmarketing.com/opengraph-image",
        width: 1200,
        height: 630,
        alt: "BITSOL Marketing — Digital Marketing Agency Pakistan",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "BITSOL Marketing | Digital Marketing Agency Pakistan",
    description:
      "Result-driven SEO, social media marketing, Google Ads, Meta Ads & web development for brands in Pakistan and worldwide.",
    images: ["https://bitsolmarketing.com/opengraph-image"],
  },
  verification: {
    google: "5_RFeyfgeVNvRbrwLfiLK_2nnc81N04BypWiVuQDPgE",
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

import { ContactPopup, FloatingDock } from "@/components/ClientDynamics";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://prod.spline.design" />
        <link rel="dns-prefetch" href="https://prod.spline.design" />
        <Script
          id="gtm-script"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-KMPSR8SX');`,
          }}
        />
        <Script
          id="json-ld-org"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
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
                    "height": 60,
                    "caption": "BITSOL Marketing"
                  },
                  "image": "https://bitsolmarketing.com/opengraph-image",
                  "description": "BITSOL Marketing is a results-driven digital marketing agency in Pakistan. We offer SEO, social media marketing, Meta Ads, Google Ads, web development, content marketing, and Google Business Profile optimization.",
                  "foundingDate": "2020",
                  "priceRange": "$$",
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
                  "publisher": { "@id": "https://bitsolmarketing.com/#organization" },
                  "potentialAction": {
                    "@type": "SearchAction",
                    "target": {
                      "@type": "EntryPoint",
                      "urlTemplate": "https://bitsolmarketing.com/blog?q={search_term_string}"
                    },
                    "query-input": "required name=search_term_string"
                  }
                },
                {
                  "@type": "WebPage",
                  "@id": "https://bitsolmarketing.com/#webpage",
                  "url": "https://bitsolmarketing.com",
                  "name": "BITSOL Marketing | Digital Marketing Agency in Pakistan",
                  "isPartOf": { "@id": "https://bitsolmarketing.com/#website" },
                  "about": { "@id": "https://bitsolmarketing.com/#organization" },
                  "breadcrumb": {
                    "@type": "BreadcrumbList",
                    "itemListElement": [
                      {
                        "@type": "ListItem",
                        "position": 1,
                        "name": "Home",
                        "item": "https://bitsolmarketing.com"
                      }
                    ]
                  }
                }
              ]
            }),
          }}
        />
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-J473YSMZKE"
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-J473YSMZKE');
          `}
        </Script>
      </head>
      <body
        className={`${montserrat.variable} font-sans antialiased bg-white dark:bg-[#050816] text-slate-900 dark:text-white transition-colors duration-300`}
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
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <div className="relative min-h-screen">
            <Entropy className="opacity-40" />
            <SmoothScroll>
              <div className="flex min-h-screen flex-col relative z-10">
                <Navbar />
                <main className="flex-grow">{children}</main>
                <Footer />
              </div>
            </SmoothScroll>
            <ContactPopup />
            <FloatingDock />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
