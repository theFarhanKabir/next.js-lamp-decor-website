import type { Metadata } from "next";
import StorefrontRoute from "../storefront-route";

export const metadata: Metadata = { title: "Custom Request | Cloud Lamps & Mirrors" };

export default function CustomRequestRoute() {
  return <StorefrontRoute />;
}
