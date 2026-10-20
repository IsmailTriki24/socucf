"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Skeleton } from "./ui/basics";

export function CopyButton({ text, label = "Copier" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* presse-papiers refusé */ } }}
      className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line bg-panel-2 px-2 text-xs text-fg-2 hover:text-fg">
      {copied ? <Check className="size-3.5 text-ok" /> : <Copy className="size-3.5" />}{copied ? "Copié" : label}
    </button>
  );
}

export function CodeView({ code, label }: { code: string; label?: string }) {
  return (
    <div className="relative">
      <div className="absolute right-2 top-2 z-10"><CopyButton text={code} /></div>
      <pre className="prose-code" aria-label={label}><code>{code}</code></pre>
    </div>
  );
}

const Editor = dynamic(() => import("./CodeEditorImpl"), { ssr: false, loading: () => <Skeleton className="h-44" /> });

/** Éditeur CodeMirror 6 : coloration XML, SQL et YAML ; texte simple pour SPL, KQL, EQL, XQL… */
export function CodeEditor({ value, onChange, mode, readOnly, minHeight }: { value: string; onChange: (v: string) => void; mode: string; readOnly?: boolean; minHeight?: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <Skeleton className="h-44" />;
  return <div className="cm-wrap"><Editor value={value} onChange={onChange} mode={mode} readOnly={readOnly} minHeight={minHeight} /></div>;
}
