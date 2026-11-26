// fetch autenticado contra las API routes propias (envía el ID token de Firebase).
import { auth } from "@/lib/firebase";

export async function authFetch(url, { method = "GET", body, headers } = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error("Tu sesión expiró. Volvé a iniciar sesión.");
  const token = await user.getIdToken();
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}
