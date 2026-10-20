"use client";
import { use } from "react";
import ClientProvider from "./ClientProvider";

export default function Layout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ClientProvider key={id} id={id}>{children}</ClientProvider>;
}
