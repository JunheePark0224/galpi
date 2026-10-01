"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { loadAccount, openLoginSheet, signedOut, useAccount } from "@/lib/account/store";
import { logout } from "@/lib/auth/browser";
import type { LibraryBookmark } from "@/lib/library/types";
import { MAX_SHELVES } from "@/lib/library/service";
import { SHELF_NAME_MAX } from "@/lib/library/validate";
import { setAmplitudeUser } from "@/lib/track/amplitude";
import { setUserId } from "@/lib/track/common";
import { BookmarkSheet } from "./BookmarkSheet";
import styles from "./Library.module.css";
import { Shelf } from "./Shelf";
import { useLibrary } from "./useLibrary";

const NOTE_MS = 4000;
interface Held { isbn: string; from: string }
interface Open { bookmark: LibraryBookmark; shelfId: string }

/**
 * S-09 내 책갈피 (PRD F-13, DESIGN S-09·C-17, 시안 `2026-10-01-p5-move-bookmark.png`): "N개 · 동물 M종", the rods,
 * [＋ 막대 추가], and a small [로그아웃] at the very bottom. Moving: hold a bookmark (it lifts), then tap the rod to put it
 * on — or turn it over and use [다른 막대로 옮기기]. Logged out, it offers the login instead.
 */
export function Library() {
  const account = useAccount();
  useEffect(() => { void loadAccount(); }, []);

  if (account.status === "unknown") return <p className={styles.quiet} aria-busy="true">불러오는 중…</p>;
  if (account.status === "off") return <p className={styles.quiet}>아직 로그인을 열지 않았어요.</p>;
  if (account.status === "out") {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>내 책갈피</h1>
        <p className={styles.quiet}>로그인하면 S-06에서 꽂은 책갈피가 여기에 모여요.</p>
        <Button onClick={() => openLoginSheet("header")}>로그인</Button>
      </div>
    );
  }
  return <Rods />;
}

function Rods() {
  const lib = useLibrary();
  const [held, setHeld] = useState<Held | null>(null);
  const [open, setOpen] = useState<Open | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; name?: string } | null>(null);

  useEffect(() => {
    if (!note) return;
    const timer = setTimeout(() => setNote(null), NOTE_MS);
    return () => clearTimeout(timer);
  }, [note]);

  if (lib.status === "loading") return <p className={styles.quiet} aria-busy="true">불러오는 중…</p>;
  if (lib.status === "login") {
    return (
      <div className={styles.page}>
        <p className={styles.quiet}>로그인이 끝났어요. 다시 로그인해 주세요.</p>
        <Button onClick={() => openLoginSheet("header")}>로그인</Button>
      </div>
    );
  }
  if (lib.status === "error" || !lib.view) {
    return (
      <div className={styles.page}>
        <p className={styles.quiet}>내 책갈피를 불러오지 못했어요.</p>
        <Button variant="secondary" onClick={() => void lib.reload()}>다시 불러오기</Button>
      </div>
    );
  }

  const { view } = lib;
  const shelves = view.shelves;
  const nameOf = (id: string) => shelves.find((s) => s.id === id)?.name ?? "";

  const drop = async (to: string) => {
    if (!held) return;
    const moving = held;
    setHeld(null);
    const ok = await lib.move(moving.isbn, to, "hold");
    setNote(ok ? { text: "으로 옮겼어요", name: nameOf(to) } : { text: "옮기지 못했어요. 다시 해 주세요." });
  };

  const add = async () => {
    if (addBusy) return;
    setAddBusy(true);
    const ok = await lib.addShelf(newName);
    setAddBusy(false);
    if (ok) {
      setAdding(false);
      setNewName("");
    } else {
      setNote({ text: `막대 이름은 1~${SHELF_NAME_MAX}자, 막대는 ${MAX_SHELVES}개까지예요.` });
    }
  };

  const leave = async () => {
    if (!(await logout())) {
      setNote({ text: "로그아웃하지 못했어요. 다시 해 주세요." });
      return;
    }
    signedOut();
    setUserId(null);
    setAmplitudeUser(null);
    // a full load on purpose: the flow and the header start over as logged out
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/");
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>내 책갈피</h1>
      <p className={styles.stat}>{`${view.count}개 · 동물 ${view.animals}종`}</p>
      {view.count === 0 && <p className={styles.quiet}>책을 만나 [내 책갈피에 꽂기]를 누르면 첫 막대에 걸려요.</p>}

      {shelves.map((shelf) => (
        <Shelf
          key={shelf.id}
          shelf={shelf}
          heldIsbn={held?.isbn ?? null}
          heldFrom={held?.from ?? null}
          onOpen={(bookmark) => {
            if (held?.isbn === bookmark.isbn) setHeld(null);          // tapping the lifted one puts it back
            else if (!held) setOpen({ bookmark, shelfId: shelf.id });
          }}
          onHold={(bookmark) => {
            if (shelves.length < 2) setNote({ text: "막대를 하나 더 만들면 책갈피를 옮길 수 있어요." });   // nowhere to put it yet
            else setHeld({ isbn: bookmark.isbn, from: shelf.id });
          }}
          onDrop={() => void drop(shelf.id)}
          onRename={(name) => lib.renameShelf(shelf.id, name)}
          onRemove={() => void lib.removeShelf(shelf.id)}
        />
      ))}

      {shelves.length < MAX_SHELVES && (adding ? (
        <form className={styles.rename} onSubmit={(e) => { e.preventDefault(); void add(); }}>
          <input
            className={styles.nameInput} value={newName} maxLength={SHELF_NAME_MAX} autoFocus data-amp-mask=""
            aria-label="새 막대 이름" placeholder="막대 이름 (12자)" onChange={(e) => setNewName(e.target.value)}
          />
          <button type="submit" className={styles.textButton} disabled={addBusy}>만들기</button>
          <button type="button" className={styles.textButton} onClick={() => { setAdding(false); setNewName(""); }}>취소</button>
        </form>
      ) : (
        <button type="button" className={styles.addRod} onClick={() => setAdding(true)}>＋ 막대 추가</button>
      ))}

      <button type="button" className={styles.logout} onClick={() => void leave()}>로그아웃</button>

      {held && (
        <div className={styles.toast} role="status">
          책갈피를 들었어요 · 놓을 막대를 누르세요 ·{" "}
          <button type="button" className={styles.toastButton} onClick={() => setHeld(null)}>취소</button>
        </div>
      )}
      {!held && note && (
        <p className={`${styles.toast} ${note.name ? styles.toastOk : ""}`} role="status">
          {note.name ? <><span data-amp-mask="">{`'${note.name}'`}</span>{note.text}</> : note.text}
        </p>
      )}

      {open && (
        <BookmarkSheet
          bookmark={open.bookmark}
          shelfId={open.shelfId}
          shelves={shelves}
          onMove={async (to) => {
            const ok = await lib.move(open.bookmark.isbn, to, "menu");
            if (ok) setNote({ text: "으로 옮겼어요", name: nameOf(to) });
            return ok;
          }}
          onRemove={() => lib.remove(open.bookmark.isbn)}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
