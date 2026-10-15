import type { Metadata } from "next";
import AdminPanel from "../../components/admin/AdminPanel";

export const metadata: Metadata = {
  title: "Store admin preview | Cloud Lamps & Mirrors",
  robots: { index: false, follow: false },
};

export default function AdminPreviewPage() {
  return <AdminPanel />;
}
