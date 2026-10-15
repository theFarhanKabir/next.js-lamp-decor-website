import type { Metadata } from "next";
import StorefrontRoute from "../storefront-route";

export const metadata: Metadata = { title: "Collections | Cloud Lamps & Mirrors" };

export default function CollectionsPage() {
  return <StorefrontRoute />;
}
