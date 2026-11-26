"use client";
// Campo de contraseña con botón (ojito) para mostrar u ocultar lo escrito.
// Acepta las mismas props que un <input>; className se aplica al input.
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import styles from "./PasswordInput.module.css";

export default function PasswordInput({ className = "", style, ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <span className={styles.wrap}>
      <input
        {...props}
        type={visible ? "text" : "password"}
        className={`${className} ${styles.input}`.trim()}
        style={style}
      />
      <button
        type="button"
        className={styles.toggle}
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        aria-pressed={visible}
        title={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
      >
        {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
      </button>
    </span>
  );
}
