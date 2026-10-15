import type { Metadata } from "next";
import StorefrontRoute from "../storefront-route";

export const metadata: Metadata = { title: "Shopping Bag | Cloud Lamps & Mirrors" };

export default function CartRoute() {
  return <StorefrontRoute />;
}
