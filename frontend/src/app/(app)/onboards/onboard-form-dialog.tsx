"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { deals, onboards } from "@/lib/endpoints";
import { asApiError } from "@/lib/api";
import { projectName } from "@/lib/deal-labels";
import { userDisplayName } from "@/lib/user-helpers";

export function OnboardFormDialog({
  trigger,
  presetDealId,
}: {
  trigger: React.ReactNode;
  presetDealId?: number;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const qc = useQueryClient();

  const [dealId, setDealId] = useState<number | "none">(
    presetDealId ?? "none"
  );
  const [termOfEnd, setTermOfEnd] = useState("");

  // Show a deal picker only when no preset is provided.
  const dealsQ = useQuery({
    queryKey: ["deals"],
    queryFn: deals.list,
    enabled: open && presetDealId === undefined,
  });

  const create = useMutation({
    mutationFn: () =>
      onboards.create({
        deal: dealId === "none" ? null : dealId,
        term_of_end: termOfEnd,
      }),
    onSuccess: (o) => {
      qc.invalidateQueries({ queryKey: ["onboards"] });
      qc.invalidateQueries({ queryKey: ["onboards-for-deal"] });
      toast.success("Онбординг создан.");
      setOpen(false);
      router.push(`/onboards/${o.id}`);
    },
    onError: (err) => toast.error(asApiError(err).message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div onClick={() => setOpen(true)}>{trigger}</div>
      <DialogContent className="max-w-[480px]">
        <DialogHeader
          eyebrow="Онбординг · Новый"
          title="Создать онбординг"
          description="Программа задач для выполнения проекта после подписания договора."
        />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
          className="flex flex-col gap-4"
        >
          {presetDealId === undefined && (
            <Field label="К проекту">
              <select
                className="h-9 w-full bg-canvas border border-hairline-strong rounded-md px-3 text-[14px] text-ink hover:border-ink-5 focus:border-accent focus:shadow-[0_0_0_3px_rgba(35,131,226,0.18)] outline-none transition-all cursor-pointer"
                value={String(dealId)}
                onChange={(e) =>
                  setDealId(
                    e.target.value === "none" ? "none" : Number(e.target.value)
                  )
                }
              >
                <option value="none">Без привязки</option>
                {(dealsQ.data ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {projectName(d)} · {userDisplayName(d.user)}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Срок сдачи">
            <Input
              type="date"
              value={termOfEnd}
              onChange={(e) => setTermOfEnd(e.target.value)}
              required
            />
          </Field>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-hairline">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => setOpen(false)}
            >
              Отмена
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={create.isPending || !termOfEnd}
            >
              {create.isPending ? "Создаём…" : "Создать"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
