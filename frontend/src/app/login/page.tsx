import type { Metadata } from "next";
import StorefrontRoute from "../storefront-route";

export const metadata: Metadata = { title: "Sign in | Cloud Lamps & Mirrors" };

export default function LoginPage() {
  return <StorefrontRoute />;
}
