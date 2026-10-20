"use client";
import CodeMirror from "@uiw/react-codemirror";
import { xml } from "@codemirror/lang-xml";
import { sql } from "@codemirror/lang-sql";
import { yaml } from "@codemirror/lang-yaml";
import { json } from "@codemirror/lang-json";
import { EditorView } from "@codemirror/view";
import { useEffect, useState } from "react";

export default function CodeEditorImpl({ value, onChange, mode, readOnly, minHeight = "180px" }: { value: string; onChange: (v: string) => void; mode: string; readOnly?: boolean; minHeight?: string }) {
  const ext = [EditorView.lineWrapping, ...(mode === "xml" ? [xml()] : mode === "sql" ? [sql()] : mode === "yaml" ? [yaml()] : mode === "json" ? [json()] : [])];
  const [dark, setDark] = useState(true);
  useEffect(() => {
    const read = () => setDark(document.documentElement.dataset.theme !== "light");
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, []);
  return <CodeMirror value={value} onChange={onChange} extensions={ext} readOnly={readOnly} theme={dark ? "dark" : "light"} minHeight={minHeight} basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: false }} style={{ background: "var(--code-bg)" }} />;
}
