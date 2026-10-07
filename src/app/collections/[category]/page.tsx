import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { COLLECTION_SLUGS } from "../../catalog";
import StorefrontRoute from "../../storefront-route";

type CategoryRouteProps = { params: Promise<{ category: string }> };

export function generateStaticParams() {
  return COLLECTION_SLUGS.map((category) => ({ category }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: CategoryRouteProps): Promise<Metadata> {
  const { category } = await params;
  if (!COLLECTION_SLUGS.includes(category as (typeof COLLECTION_SLUGS)[number])) notFound();

  const title = category.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  return { title: `${title} | Cloud Lamps & Mirrors` };
}

export default async function CategoryPage({ params }: CategoryRouteProps) {
  const { category } = await params;
  if (!COLLECTION_SLUGS.includes(category as (typeof COLLECTION_SLUGS)[number])) notFound();
  return <StorefrontRoute />;
}
