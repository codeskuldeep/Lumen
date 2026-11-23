"use client";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Bell, TrendingDown, TrendingUp } from "lucide-react";
import { api } from "@/lib/api";
import { useAlerts } from "@/lib/hooks";
import { fmtDateTime } from "@/lib/utils";

export function AlertsBell() {
  const { data } = useAlerts();
  const qc = useQueryClient();
  const unread = data?.filter((a) => !a.read).length ?? 0;

  const markRead = async () => {
    if (!unread) return;
    await api("/alerts/read-all", { method: "POST" });
    qc.invalidateQueries({ queryKey: ["alerts"] });
  };

  return (
    <Menu.Root onOpenChange={(o) => !o && markRead()}>
      <Menu.Trigger aria-label="Alerts" className="relative rounded-lg p-2 text-muted outline-none transition hover:bg-white/10 hover:text-fg">
        <Bell className="size-4" />
        {unread > 0 && <span className="absolute right-1 top-1 grid size-3.5 place-items-center rounded-full bg-bad text-[9px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content side="right" align="start" sideOffset={12} collisionPadding={12} className="glass z-[60] w-80 !bg-[#14122a]/90 p-2 outline-none">
          <div className="px-3 py-2 text-sm font-semibold">Alerts</div>
          <div className="max-h-80 overflow-y-auto">
            {!data?.length && <p className="px-3 py-6 text-center text-sm text-muted">Nothing yet. We&apos;ll notify you when visibility changes.</p>}
            {data?.map((a) => (
              <Menu.Item key={a.id} asChild>
                <Link href={`/clients/${a.client_id}`} className="flex gap-3 rounded-xl px-3 py-2.5 text-sm outline-none data-[highlighted]:bg-white/8">
                  {a.kind === "drop" ? <TrendingDown className="mt-0.5 size-4 shrink-0 text-bad" /> : <TrendingUp className="mt-0.5 size-4 shrink-0 text-good" />}
                  <span><span className={a.read ? "text-muted" : ""}>{a.message}</span><span className="mt-0.5 block text-xs text-muted/70">{fmtDateTime(a.created_at)}</span></span>
                </Link>
              </Menu.Item>
            ))}
          </div>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
