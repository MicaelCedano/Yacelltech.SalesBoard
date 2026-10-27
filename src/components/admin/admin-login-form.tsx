"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/appearance-provider";
import { YacellTechLogo } from "@/components/ui/yacelltech-logo";
import { Input } from "@/components/ui/input";

interface AdminLoginFormProps {
  mode: "supabase" | "demo-local";
  onSuccess: () => void;
}

export function AdminLoginForm({ mode, onSuccess }: AdminLoginFormProps) {
  const [email, setEmail] = useState(
    mode === "demo-local" ? "admin@yacelltech.com" : ""
  );
  const [password, setPassword] = useState(
    mode === "demo-local" ? "Yacell2026!" : ""
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo iniciar sesión");
        return;
      }

      onSuccess();
    } catch {
      setError("Error de conexión al intentar iniciar sesión.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="login-shell">
      <div className="login-appearance"><ThemeToggle /></div>
      <section className="login-card" aria-label="Acceso administrativo">
        <div className="login-brand"><YacellTechLogo className="login-brand-logo" /><span className="text-secondary font-normal">SalesBoard</span></div>
        <h1>Bienvenido de nuevo.</h1>
        <p className="mt-2 mb-7 text-sm text-secondary leading-relaxed">Inicia sesión para actualizar las ventas y gestionar tu equipo.</p>
        {mode === "demo-local" && <div className="mb-6 rounded-xl border border-separator bg-muted p-4 text-xs text-secondary leading-relaxed"><p className="font-medium text-foreground mb-1">Demostración local</p><p>Credenciales de prueba precargadas. Los datos se guardan solo en este entorno.</p></div>}
        {error && <div role="alert" className="mb-5 rounded-xl bg-danger-soft p-4 text-sm text-danger-text">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div><label htmlFor="admin-email" className="mb-2 block text-secondary">Correo electrónico</label><Input id="admin-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@yacelltech.com" /></div>
          <div><label htmlFor="admin-password" className="mb-2 block text-secondary">Contraseña</label><Input id="admin-password" type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Tu contraseña" /></div>
          <Button type="submit" size="lg" disabled={isLoading} className="w-full">{isLoading ? "Verificando…" : "Iniciar sesión"}</Button>
        </form>
        <div className="mt-7 border-t border-separator pt-5 text-center"><Link href="/" className="text-sm text-accent">Volver al tablero</Link></div>
      </section>
    </main>
  );
}
