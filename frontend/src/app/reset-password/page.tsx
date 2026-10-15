import type { Metadata } from "next";
import StorefrontRoute from "../storefront-route";

export const metadata: Metadata = { title: "Choose a new password | Cloud Lamps & Mirrors" };

export default function ResetPasswordPage() {
  return <StorefrontRoute />;
}
