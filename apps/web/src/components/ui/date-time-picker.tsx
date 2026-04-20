"use client";

import clsx from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarIcon } from "./icons";

interface DateTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  invalid?: boolean;
}

const monthFormatter = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });

export function DateTimePicker({ value, onChange, label, invalid = false }: DateTimePickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const parsedValue = useMemo(() => parseLocalDateTime(value), [value]);
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState<Date>(
    parsedValue ? new Date(parsedValue.getFullYear(), parsedValue.getMonth(), 1) : startOfMonth(new Date())
  );

  useEffect(() => {
    if (!parsedValue) return;
    setVisibleMonth(new Date(parsedValue.getFullYear(), parsedValue.getMonth(), 1));
  }, [parsedValue]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const days = useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth]);
  const selectedHours = parsedValue ? parsedValue.getHours() : 9;
  const selectedMinutes = parsedValue ? parsedValue.getMinutes() : 0;

  const setSelectedDate = (date: Date) => {
    const nextDate = parsedValue ?? new Date();
    const nextValue = toLocalDateTimeValue(
      new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        nextDate.getHours(),
        nextDate.getMinutes()
      )
    );
    onChange(nextValue);
  };

  const setSelectedTime = (hours: number, minutes: number) => {
    const baseDate = parsedValue ?? new Date();
    const nextValue = toLocalDateTimeValue(
      new Date(
        baseDate.getFullYear(),
        baseDate.getMonth(),
        baseDate.getDate(),
        hours,
        minutes
      )
    );
    onChange(nextValue);
  };

  return (
    <div className="date-time-picker" ref={containerRef}>
      <button
        type="button"
        className={clsx("date-time-trigger", invalid && "date-time-trigger-error")}
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="date-time-trigger-copy">
          <strong>{parsedValue ? formatTriggerValue(parsedValue) : "Choisir une date et une heure"}</strong>
          <span>{parsedValue ? "Publication planifiée" : "Aucune date définie"}</span>
        </span>
        <CalendarIcon />
      </button>

      {open ? (
        <div className="date-time-popover">
          <div className="date-time-popover-header">
            <button
              type="button"
              className="date-time-nav"
              onClick={() =>
                setVisibleMonth(
                  new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1)
                )
              }
              aria-label="Mois précédent"
            >
              ‹
            </button>
            <strong>{capitalize(monthFormatter.format(visibleMonth))}</strong>
            <button
              type="button"
              className="date-time-nav"
              onClick={() =>
                setVisibleMonth(
                  new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1)
                )
              }
              aria-label="Mois suivant"
            >
              ›
            </button>
          </div>

          <div className="date-time-weekdays">
            {["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="date-time-grid">
            {days.map((day) => {
              const selected =
                parsedValue &&
                day.getFullYear() === parsedValue.getFullYear() &&
                day.getMonth() === parsedValue.getMonth() &&
                day.getDate() === parsedValue.getDate();

              const isOutside = day.getMonth() !== visibleMonth.getMonth();

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  className={clsx(
                    "date-time-day",
                    selected && "date-time-day-selected",
                    isOutside && "date-time-day-outside"
                  )}
                  onClick={() => setSelectedDate(day)}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          <div className="date-time-time">
            <label className="form-field">
              <span>Heure</span>
              <select
                className="form-select"
                value={String(selectedHours).padStart(2, "0")}
                onChange={(event) => setSelectedTime(Number(event.target.value), selectedMinutes)}
              >
                {Array.from({ length: 24 }, (_, index) => (
                  <option key={index} value={String(index).padStart(2, "0")}>
                    {String(index).padStart(2, "0")} h
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>Minutes</span>
              <select
                className="form-select"
                value={String(selectedMinutes).padStart(2, "0")}
                onChange={(event) => setSelectedTime(selectedHours, Number(event.target.value))}
              >
                {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((minute) => (
                  <option key={minute} value={String(minute).padStart(2, "0")}>
                    {String(minute).padStart(2, "0")}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="date-time-popover-actions">
            <button
              type="button"
              className="secondary-button secondary-button-action"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              Effacer
            </button>
            <button type="button" className="primary-button" onClick={() => setOpen(false)}>
              Appliquer
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

const buildCalendarDays = (month: Date) => {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const firstWeekday = (firstDay.getDay() + 6) % 7;
  const firstVisible = new Date(month.getFullYear(), month.getMonth(), 1 - firstWeekday);

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(firstVisible);
    day.setDate(firstVisible.getDate() + index);
    return day;
  });
};

const parseLocalDateTime = (value: string) => {
  if (!value) return null;
  const [datePart, timePart] = value.split("T");
  if (!datePart || !timePart) return null;
  const [year, month, day] = datePart.split("-").map(Number);
  const [hours, minutes] = timePart.split(":").map(Number);
  if ([year, month, day, hours, minutes].some((part) => Number.isNaN(part))) {
    return null;
  }

  return new Date(year, month - 1, day, hours, minutes);
};

const toLocalDateTimeValue = (date: Date) => {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-") + `T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};

const formatTriggerValue = (date: Date) =>
  date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
