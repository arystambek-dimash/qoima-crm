"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
} from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { asApiError } from "@/lib/api";
import { sales } from "@/lib/endpoints";
import type { SalesEvent } from "@/lib/types";

export function SalesEventDialog({
  trigger,
  initial,
}: {
  trigger: React.ReactNode;
  initial?: SalesEvent;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initial?.name ?? "");
  const [eventDate, setEventDate] = useState(initial?.event_date ?? "");
  const [capacity, setCapacity] = useState(
    initial ? String(initial.capacity) : ""
  );
  const [comments, setComments] = useState(initial?.comments ?? "");
  const queryClient = useQueryClient();

  function openDialog() {
    setName(initial?.name ?? "");
    setEventDate(initial?.event_date ?? "");
    setCapacity(initial ? String(initial.capacity) : "");
    setComments(initial?.comments ?? "");
    setOpen(true);
  }

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: name.trim(),
        event_date: eventDate,
        capacity: Number(capacity),
        comments: comments.trim(),
      };
      return initial
        ? sales.events.update(initial.id, payload)
        : sales.events.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-events"] });
      toast.success(initial ? "Событие обновлено." : "Событие создано.");
      setOpen(false);
      if (!initial) {
        setName("");
        setEventDate("");
        setCapacity("");
        setComments("");
      }
    },
    onError: (error) => toast.error(asApiError(error).message),
  });

  const capacityNumber = Number(capacity);
  const isValid =
    name.trim().length > 0 &&
    eventDate.length > 0 &&
    Number.isInteger(capacityNumber) &&
    capacityNumber > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div onClick={openDialog}>{trigger}</div>
      <DialogContent className="max-w-[560px]">
        <DialogHeader
          eyebrow={
            initial
              ? "Групповые продажи · Редактирование"
              : "Групповые продажи · Новое событие"
          }
          title={
            <span className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-md bg-tag-orange-bg text-tag-orange-fg">
                <CalendarDays className="h-4 w-4" />
              </span>
              <span>{initial ? "Изменить событие" : "Создать событие"}</span>
            </span>
          }
          description="Укажите дату и размер группы. Участников можно будет добавлять отдельно после создания."
        />

        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (isValid) mutation.mutate();
          }}
        >
          <Field label="Название события">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Например, Интенсив 3 августа"
              autoComplete="off"
              autoFocus
              required
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Дата проведения">
              <Input
                type="date"
                value={eventDate}
                onChange={(event) => setEventDate(event.target.value)}
                required
              />
            </Field>

            <Field
              label="Количество мест"
              hint={
                initial
                  ? `Сейчас записано: ${initial.participant_count}`
                  : "Например, 15 человек"
              }
            >
              <Input
                type="number"
                min={Math.max(1, initial?.participant_count ?? 1)}
                step="1"
                inputMode="numeric"
                value={capacity}
                onChange={(event) => setCapacity(event.target.value)}
                placeholder="15"
                required
              />
            </Field>
          </div>

          <Field label="Комментарий" hint="Необязательно">
            <Textarea
              value={comments}
              onChange={(event) => setComments(event.target.value)}
              rows={3}
              placeholder="Формат, программа, место проведения или важные детали"
            />
          </Field>

          <div className="flex items-center justify-end gap-2 border-t border-hairline pt-3">
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
              disabled={!isValid || mutation.isPending}
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Сохраняем…
                </>
              ) : (
                <>
                  {!initial && <Plus className="h-3.5 w-3.5" />}
                  {initial ? "Сохранить" : "Создать событие"}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
