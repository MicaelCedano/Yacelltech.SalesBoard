import React from "react";
import type { Metadata } from "next";
import { fetchSalesBoardSnapshot } from "@/lib/data-service";
import { verifyServerAdminSession } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin/admin-shell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Panel Administrativo | YacellTech SalesBoard",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminPage() {
  const [session, initialSnapshot] = await Promise.all([
    verifyServerAdminSession(),
    fetchSalesBoardSnapshot({ preset: "today" }),
  ]);

  return (
    <AdminShell
      initialIsAdmin={session.isAdmin}
      initialEmail={session.email}
      mode={session.mode}
      initialSnapshot={initialSnapshot}
    />
  );
}
