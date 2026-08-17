"use client";
export const dynamic = "force-dynamic";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SaisiePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard?creer=1");
  }, []);

  return <div className="p-10 text-center text-ink/40">Redirection…</div>;
}
