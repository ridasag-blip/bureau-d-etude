"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      router.replace(user ? "/dashboard" : "/login");
    })();
  }, []);

  return <div className="min-h-screen flex items-center justify-center text-ink/40">Chargement…</div>;
}
