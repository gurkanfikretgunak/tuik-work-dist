"use client";
import { Upload } from "lucide-react";
import { useRef, useState } from "react";

export function FileDrop({ onText, label = "CSV dosyasını sürükleyin veya seçin" }: { onText: (text: string, name: string) => void; label?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const read = async (f?: File | null) => {
    if (!f) return;
    // UTF-8 beklenir; Windows-1254 (Excel TR) ise çözmeyi dene
    const buf = await f.arrayBuffer();
    let text = new TextDecoder("utf-8", { fatal: false }).decode(buf);
    if (text.includes("�")) text = new TextDecoder("windows-1254").decode(buf);
    onText(text, f.name);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        read(e.dataTransfer.files?.[0]);
      }}
      className={`flex flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed px-4 py-6 text-center text-[13px] ${over ? "border-[#1F2A44] bg-slate-50" : "border-slate-300 bg-white"}`}
    >
      <Upload className="h-5 w-5 text-slate-500" />
      <div className="text-slate-700">{label}</div>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="rounded border border-slate-300 bg-white px-3 py-1 text-xs font-medium hover:bg-slate-50"
      >
        Dosya seç
      </button>
      <input
        ref={ref}
        type="file"
        accept=".csv,text/csv,.txt"
        data-testid="file-input"
        className="hidden"
        onChange={(e) => {
          read(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
