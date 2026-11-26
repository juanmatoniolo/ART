"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Undo2 } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { getImpersonation, stopImpersonation } from "@/lib/impersonation";
import { notify } from "@/lib/notify";
import styles from "./ImpersonationBar.module.css";

/** Barra fija mientras ROOT está usando el sistema como otro usuario. */
export default function ImpersonationBar() {
  const { status, usuario } = useSession();
  const router = useRouter();
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sync = () => setInfo(getImpersonation());
    sync();
    window.addEventListener("impersonation-change", sync);
    return () => window.removeEventListener("impersonation-change", sync);
  }, []);

  if (!info || status !== "active") return null;

  const volver = async () => {
    setBusy(true);
    try {
      const to = await stopImpersonation();
      router.replace(to);
    } catch (err) {
      notify.error(err.message || "No se pudo volver a tu cuenta.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.bar} role="status">
      <Eye size={18} aria-hidden className={styles.icon} />
      <span className={styles.text}>
        Estás viendo el sistema como <strong>{usuario?.nombre || info.targetNombre}</strong>
      </span>
      <button className={styles.btn} onClick={volver} disabled={busy}>
        <Undo2 size={16} aria-hidden /> {busy ? "Volviendo…" : `Volver a ${info.actorNombre || "mi cuenta"}`}
      </button>
    </div>
  );
}
