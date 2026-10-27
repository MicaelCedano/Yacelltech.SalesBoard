"use client";

import { useId } from "react";
import { Camera, Trash2 } from "lucide-react";
import { AvatarBadge } from "@/components/ui/avatar-badge";

interface SellerPhotoFieldProps {
  label?: string;
  url: string;
  name: string;
  color: string;
  uploading: boolean;
  onChange: (url: string) => void;
  onUpload: (file: File) => Promise<void>;
}

export function SellerPhotoField({ label = "Fotografía del vendedor", url, name, color, uploading, onChange, onUpload }: SellerPhotoFieldProps) {
  const id = useId();

  return (
    <div className="rounded-xl border border-separator bg-muted p-4">
      <p className="mb-3 text-sm font-medium text-foreground">{label}</p>
      <div className="flex flex-wrap items-center gap-4">
        <AvatarBadge src={url || null} name={name || "Vendedor"} accentColor={color} size="xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <label htmlFor={id} className="flex items-center gap-2 text-sm font-semibold text-secondary">
            <Camera className="h-4 w-4" aria-hidden="true" />
            {uploading ? "Subiendo fotografía…" : url ? "Cambiar fotografía" : "Subir fotografía"}
          </label>
          <input
            id={id}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            disabled={uploading}
            aria-describedby={`${id}-help`}
            className="block w-full min-w-0 text-xs text-secondary file:mr-2 file:cursor-pointer file:rounded-lg file:border-0 file:bg-accent-soft file:px-3 file:py-2 file:font-semibold file:text-secondary hover:file:bg-accent-soft focus-visible:outline-accent disabled:opacity-50"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) void onUpload(file);
            }}
          />
          {url && (
            <button type="button" disabled={uploading} onClick={() => onChange("")} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-danger-text hover:bg-danger-soft focus-visible:outline-accent disabled:opacity-50">
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Quitar fotografía
            </button>
          )}
        </div>
      </div>
      <p id={`${id}-help`} className="mt-3 text-xs leading-relaxed text-secondary">
        JPG, PNG, WebP o AVIF · Máximo 5 MB. Guarda los cambios para publicar la foto. Sin foto se mostrarán las iniciales. Para un resultado más limpio, usa un retrato sin texto ni logos.
      </p>
      <details className="mt-3 text-xs text-secondary">
        <summary className="cursor-pointer rounded focus-visible:outline-accent">Usar un enlace de fotografía</summary>
        <label htmlFor={`${id}-url`} className="mt-2 block">Enlace de la imagen</label>
        <input id={`${id}-url`} type="url" value={url.startsWith("data:") ? "" : url} onChange={(event) => onChange(event.target.value)} disabled={uploading} placeholder="https://…" className="mt-1 w-full rounded-lg border border-separator bg-muted p-2 text-sm text-foreground focus-visible:outline-accent" />
      </details>
    </div>
  );
}
