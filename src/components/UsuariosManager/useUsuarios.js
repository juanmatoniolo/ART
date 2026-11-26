"use client";

import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/apiClient";

/** Carga usuarios (y pendientes de migrar, si sos ROOT) desde /api/usuarios. */
export default function useUsuarios({ enabled = true } = {}) {
  const [users, setUsers] = useState([]);
  const [legacy, setLegacy] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await authFetch("/api/usuarios");
      setUsers(data.users || []);
      setLegacy(data.legacy || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) reload();
  }, [enabled, reload]);

  return { users, setUsers, legacy, setLegacy, loading, error, reload };
}
