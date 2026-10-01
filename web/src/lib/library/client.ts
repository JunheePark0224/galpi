export interface LibraryAnswer { ok: boolean; status: number; body: unknown }

/** One call to a 내 책갈피 route (same site, session cookie). Never throws: offline is status 0. */
export async function libraryRequest(method: "GET" | "POST" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<LibraryAnswer> {
  try {
    const res = await fetch(path, {
      method,
      ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
      credentials: "same-origin",
      cache: "no-store",
    });
    let parsed: unknown = null;
    try {
      parsed = await res.json();
    } catch {
      parsed = null;
    }
    return { ok: res.ok, status: res.status, body: parsed };
  } catch {
    return { ok: false, status: 0, body: null };
  }
}
