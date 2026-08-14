/**
 * Autor: Sandro Servo
 * Site: https://cloudservo.com.br
 *
 * Avatar reutilizável para leads.
 * Detecta URLs expiradas do WhatsApp (erro 403) e re-busca automaticamente.
 */

"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";

interface LeadAvatarProps {
  leadId: string;
  avatarUrl: string | null;
  name: string | null;
  phone: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: "w-9 h-9 text-xs",
  md: "w-11 h-11 text-sm",
  lg: "w-20 h-20 text-xl",
};

function getInitials(name: string | null, phone: string): string {
  if (name) {
    return name
      .split(" ")
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }
  return phone.slice(-2);
}

export function LeadAvatar({
  leadId,
  avatarUrl,
  name,
  phone,
  size = "md",
  className,
}: LeadAvatarProps) {
  const [src, setSrc] = useState<string | null>(avatarUrl);
  const [triedRefresh, setTriedRefresh] = useState(false);

  const handleError = useCallback(async () => {
    if (triedRefresh || !leadId) {
      setSrc(null);
      return;
    }

    setTriedRefresh(true);

    try {
      const res = await fetch(`/api/leads/${leadId}/avatar`);
      if (res.ok) {
        const data = await res.json();
        if (data.avatarUrl) {
          setSrc(data.avatarUrl);
          return;
        }
      }
    } catch { /* ignore */ }

    setSrc(null);
  }, [leadId, triedRefresh]);

  const sizeClass = sizeMap[size];

  if (src) {
    return (
      <img
        src={src}
        alt={name || phone}
        className={cn(sizeClass, "rounded-full object-cover", className)}
        onError={handleError}
      />
    );
  }

  return (
    <div
      className={cn(
        sizeClass,
        "rounded-full bg-gradient-to-br from-[#001A5E] to-[#F9A825] flex items-center justify-center text-white font-semibold",
        className
      )}
    >
      {getInitials(name, phone)}
    </div>
  );
}
