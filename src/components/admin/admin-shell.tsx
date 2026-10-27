"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { SalesBoardSnapshot } from "@/types/salesboard";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { AdminDashboard } from "@/components/admin/admin-dashboard";

interface AdminShellProps {
  initialIsAdmin: boolean;
  initialEmail: string | null;
  mode: "supabase" | "demo-local";
  initialSnapshot: SalesBoardSnapshot;
}

export function AdminShell({
  initialIsAdmin,
  initialEmail,
  mode,
  initialSnapshot,
}: AdminShellProps) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(initialIsAdmin);
  const [email, setEmail] = useState(initialEmail ?? "admin@yacelltech.com");

  const handleLoginSuccess = async () => {
    try {
      const res = await fetch("/api/admin/auth", { cache: "no-store" });
      if (res.ok) {
        const session = await res.json();
        if (session.isAdmin) {
          setEmail(session.email ?? "admin@yacelltech.com");
          setIsAuthenticated(true);
          router.refresh();
        }
      }
    } catch {
      setIsAuthenticated(true);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/admin/auth", { method: "DELETE" });
    setIsAuthenticated(false);
    router.refresh();
  };

  if (!isAuthenticated) {
    return <AdminLoginForm mode={mode} onSuccess={handleLoginSuccess} />;
  }

  return (
    <AdminDashboard
      initialSnapshot={initialSnapshot}
      adminEmail={email}
      mode={mode}
      onLogout={handleLogout}
    />
  );
}
