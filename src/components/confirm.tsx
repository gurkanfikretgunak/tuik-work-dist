"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Button } from "./ui";

export type ConfirmOpts = {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
  /** true ise yalnızca "Tamam" gösterilir (bilgilendirme) */
  infoOnly?: boolean;
};

type Ctx = (o: ConfirmOpts) => Promise<boolean>;
const C = createContext<Ctx>(async () => true);
export const useConfirm = () => useContext(C);

/** Tüm onaylar modal dialog ile alınır */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOpts | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<Ctx>((o) => {
    setOpts(o);
    return new Promise<boolean>((res) => {
      resolver.current = res;
    });
  }, []);

  const close = (v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setOpts(null);
  };

  return (
    <C.Provider value={confirm}>
      {children}
      <Dialog.Root open={!!opts} onOpenChange={(o) => !o && close(false)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-900/40" />
          <Dialog.Content
            data-testid="confirm-dialog"
            className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[min(520px,92vw)] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-lg border border-slate-200 bg-white p-4 shadow-xl focus:outline-none"
          >
            <Dialog.Title className="text-[15px] font-semibold text-[#1F2A44]">{opts?.title}</Dialog.Title>
            <Dialog.Description asChild>
              <div className="mt-2 text-[13px] leading-relaxed text-slate-700">{opts?.body}</div>
            </Dialog.Description>
            <div className="mt-4 flex justify-end gap-2">
              {!opts?.infoOnly && (
                <Button onClick={() => close(false)} data-testid="confirm-cancel">
                  {opts?.cancelLabel ?? "Vazgeç"}
                </Button>
              )}
              <Button variant={opts?.tone === "danger" ? "danger" : "primary"} onClick={() => close(true)} data-testid="confirm-ok" autoFocus>
                {opts?.confirmLabel ?? "Onayla"}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </C.Provider>
  );
}

/** Serbest içerikli modal (form vb.) */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-900/40" />
        <Dialog.Content
          className={`fixed left-1/2 top-1/2 z-50 max-h-[88vh] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-lg border border-slate-200 bg-white p-4 shadow-xl focus:outline-none ${wide ? "w-[min(860px,94vw)]" : "w-[min(560px,92vw)]"}`}
        >
          <Dialog.Title className="mb-2 text-[15px] font-semibold text-[#1F2A44]">{title}</Dialog.Title>
          <Dialog.Description className="sr-only">{title}</Dialog.Description>
          {children}
          {footer && <div className="mt-4 flex justify-end gap-2">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
