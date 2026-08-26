import React from "react";
import { Helmet } from "react-helmet-async";

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string[];
  canonical?: string;
  ogImage?: string;
  ogType?: "website" | "article" | "product";
  schema?: Record<string, any> | Record<string, any>[];
  noIndex?: boolean;
}

const DEFAULT_TITLE = "Trades Point | Shop More. Save More. Live Better.";
const DEFAULT_DESCRIPTION =
  "Discover premium fashion, electronics, gadgets, home decor, and authentic fine art on Trades Point. Enjoy fast delivery and secure payments.";
const DEFAULT_KEYWORDS = [
  "Trades Point",
  "Tradespoint store",
  "Online Shopping Ghana",
  "Buy Electronics Online",
  "Fashion Store Online",
  "Home Decor Ghana",
  "Digital Art Gallery",
  "Ghana Marketplace",
  "Fast Delivery Ghana",
  "Paystack Shopping"
];
const DOMAIN = "https://tradespoint.store";
const DEFAULT_OG_IMAGE = `${DOMAIN}/logo.png`;

export const SEO: React.FC<SEOProps> = ({
  title,
  description = DEFAULT_DESCRIPTION,
  keywords = DEFAULT_KEYWORDS,
  canonical,
  ogImage = DEFAULT_OG_IMAGE,
  ogType = "website",
  schema,
  noIndex = false,
}) => {
  const pageTitle = title ? `${title} | Trades Point` : DEFAULT_TITLE;
  const currentUrl = canonical ? canonical : typeof window !== "undefined" ? window.location.href : DOMAIN;
  const keywordsString = Array.isArray(keywords) ? keywords.join(", ") : keywords;

  return (
    <Helmet>
      {/* Standard Meta */}
      <title>{pageTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywordsString} />
      <meta name="author" content="Trades Point" />
      {noIndex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow, max-image-preview:large" />
      )}

      {/* Canonical Link */}
      <link rel="canonical" href={currentUrl} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={currentUrl} />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:site_name" content="Trades Point" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={currentUrl} />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {/* JSON-LD Structured Data */}
      {schema && (
        <script type="application/ld+json">
          {JSON.stringify(Array.isArray(schema) ? schema : [schema])}
        </script>
      )}
    </Helmet>
  );
};
