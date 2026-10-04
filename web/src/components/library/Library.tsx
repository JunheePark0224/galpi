"use client";
import { useEffect, useState } from "react";
import { Bookmark } from "@/components/Bookmark";
import { Button } from "@/components/Button";
import { loadAccount, openLoginSheet, signedOut, useAccount } from "@/lib/account/store";
import { logout } from "@/lib/auth/browser";
import type { LibraryBookmark } from "@/lib/library/types";
import { toParticle } from "@/lib/library/particle";
import { MAX_SHELVES } from "@/lib/library/service";
import { SHELF_NAME_MAX } from "@/lib/library/validate";
import { setAmplitudeUser } from "@/lib/track/amplitude";
import { setUserId } from "@/lib/track/common";
import { libraryGuide } from "@/lib/flow/firstGuide";
import { BookmarkSheet, metLabel } from "./BookmarkSheet";
import { LibraryGuide } from "./LibraryGuide";
import styles from "./Library.module.css";
import { Shelf } from "./Shelf";
import { samePlace, useDrag } from "./useDrag";
import { useLibrary } from "./useLibrary";

const NOTE_MS = 4000;
interface Note { text: string; name?: string; ok?: boolean }
/** "'{name}'으로 옮겼어요" — the name is the person's words: masked text only. */
const movedTo = (name: string): Note => ({ text: `${toParticle(name)} 옮겼어요`, name, ok: true });
/** New copy (DESIGN C-17, 10-04): the toast while a bookmark is dragged. */
export const DRAGGING = "놓을 자리로 끌어서 놓으세요";
interface Open { bookmark: LibraryBookmark; shelfId: string }

/**
 * S-09 내 책갈피 (PRD F-13, DESIGN S-09·C-17, 시안 `2026-10-04-v2/library-front-drag.png`): "N개 · 동물 M종", the rods,
 * [＋ 막대 추가], and a small [로그아웃] at the very bottom. Moving: hold a bookmark and drag it to a place on any rod —
 * or open it and use [다른 막대로 옮기기] (no dragging needed). Logged out, it offers the login instead.
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
  const [open, setOpen] = useState<Open | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [note, setNote] = useState<Note | null>(null);
  // C-22: the first visit to 내 책갈피 shows a small example shelf once (per browser)
  const [guide, setGuide] = useState(() => !libraryGuide.hasSeen());
  const { drag, start, ghostRef } = useDrag((isbn, to, from) => {
    const name = lib.view?.shelves.find((s) => s.id === to.shelfId)?.name ?? "";
    // a new place on its own rod says nothing (user, 10-04) — the row already shows it
    void lib.move(isbn, to.shelfId, "drag", to.index).then((ok) => {
      if (!ok) setNote({ text: "옮기지 못했어요. 다시 해 주세요." });
      else if (to.shelfId !== from.shelfId) setNote(movedTo(name));
    });
  });
  const closeGuide = () => {
    libraryGuide.markSeen();
    setGuide(false);
  };

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
    <div className={styles.page} data-dragging={drag ? "" : undefined}>
      {guide && !open && <LibraryGuide onClose={closeGuide} />}
      <h1 className={styles.title}>내 책갈피</h1>
      <p className={styles.stat}>{`${view.count}개 · 동물 ${view.animals}종`}</p>
      {view.count === 0 && <p className={styles.quiet}>책을 만나 🔖 꽂기를 누르면 첫 막대에 걸려요.</p>}

      {shelves.map((shelf) => (
        <Shelf
          key={shelf.id}
          shelf={shelf}
          dragged={drag?.bookmark.isbn ?? null}
          gap={drag?.over?.shelfId === shelf.id && !samePlace(drag.over, drag.from) ? drag.over.index : null}
          onOpen={(bookmark) => setOpen({ bookmark, shelfId: shelf.id })}
          onHold={(bookmark, index, at, box, pointerId) => start(bookmark, { shelfId: shelf.id, index }, at, box, pointerId)}
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

      {drag && (
        <>
          <div ref={ghostRef} className={styles.ghost} aria-hidden="true">
            <span className={styles.mini}>
              <Bookmark card={drag.bookmark.card} art={drag.bookmark.art} met={metLabel(drag.bookmark.metOn)} moving />
            </span>
          </div>
          <p className={styles.toast} role="status">{DRAGGING}</p>
        </>
      )}
      {!drag && note && (
        <p className={`${styles.toast} ${note.ok ? styles.toastOk : ""}`} role="status">
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
            if (ok) setNote(movedTo(nameOf(to)));
            return ok;
          }}
          onRemove={() => lib.remove(open.bookmark.isbn)}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
