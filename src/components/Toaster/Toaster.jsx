"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";
import { subscribe } from "@/lib/notify";
import styles from "./Toaster.module.css";

const ICONS = { success: CheckCircle2, error: XCircle, warning: AlertTriangle, info: Info };
const MAX_VISIBLE = 4;

export default function Toaster() {
  const [items, setItems] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setItems((list) => list.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const map = timers.current;
    const unsub = subscribe((item) => {
      setItems((list) => {
        // Mismo texto ya visible: no apilar duplicados (p. ej. doble click)
        const dup = list.find((t) => t.text === item.text && t.type === item.type);
        if (dup) return list;
        return [...list, item].slice(-MAX_VISIBLE);
      });
      map.set(item.id, setTimeout(() => dismiss(item.id), item.duration));
    });
    return () => {
      unsub();
      map.forEach(clearTimeout);
      map.clear();
    };
  }, [dismiss]);

  return (
    <div className={styles.region} aria-live="polite" aria-relevant="additions">
      {items.map(({ id, type, text }) => {
        const Icon = ICONS[type] || Info;
        return (
          <div
            key={id}
            className={`${styles.toast} ${styles[type]}`}
            role={type === "error" ? "alert" : "status"}
            onClick={() => dismiss(id)}
          >
            <Icon size={20} className={styles.icon} aria-hidden />
            <p className={styles.text}>{text}</p>
            <button
              type="button"
              className={styles.close}
              onClick={(e) => {
                e.stopPropagation();
                dismiss(id);
              }}
              aria-label="Cerrar notificación"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
