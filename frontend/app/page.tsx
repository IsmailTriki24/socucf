"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Spinner } from "@/components/ui/basics";
import { useWorkspace } from "@/lib/workspace";

/** L'accueil, c'est le client actif : on y va directement. */
export default function Home() {
  const { clients, current } = useWorkspace();
  const router = useRouter();
  useEffect(() => {
    if (clients === null) return;
    router.replace(current ? `/clients/${current.id}` : "/bienvenue");
  }, [clients, current, router]);
  return <div className="grid h-64 place-items-center"><Spinner className="size-6" /></div>;
}
