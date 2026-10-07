"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Bookmark } from "@/components/Bookmark";
import { Button } from "@/components/Button";
import { loadAccount, openLoginSheet, signedOut, useAccount } from "@/lib/account/store";
import { logout } from "@/lib/auth/browser";
import { useGuestSaves } from "@/lib/library/guest";
import type { LibraryBookmark } from "@/lib/library/types";
import { MAX_SHELVES } from "@/lib/library/service";
import { SHELF_NAME_MAX } from "@/lib/library/validate";
import { setAmplitudeUser } from "@/lib/track/amplitude";
import { setUserId } from "@/lib/track/common";
import { libraryGuide } from "@/lib/flow/firstGuide";
import { BookmarkSheet, metLabel } from "./BookmarkSheet";
import { CLEAR_ALL, ClearSheet, RemoveRodSheet } from "./ClearSheet";
import { Dex, LoggedOutDex } from "./Dex";
import { GuestLibrary } from "./GuestLibrary";
import { LibraryGuide } from "./LibraryGuide";
import styles from "./Library.module.css";
import { Shelf } from "./Shelf";
import { samePlace, useDrag } from "./useDrag";
import { useLibrary } from "./useLibrary";

const NOTE_MS = 4000;
/** New copy (DESIGN C-17, 10-04): the toast while a bookmark is dragged. */
export const DRAGGING = "놓을 자리로 끌어서 놓으세요";
/** New copy (DESIGN C-17, 10-04 user: "[책갈피 옮기기]를 누르면 전체적으로 자유롭게, [완료] 누르면 다시"). */
export const MOVE_MODE = "책갈피 옮기기";
export const MOVE_DONE = "완료";
export const MOVE_HINT = "책갈피를 끌어서 원하는 자리에 놓으세요";
const FAILED_MOVE = "옮기지 못했어요. 다시 해 주세요.";
const FAILED_ROD = "막대를 지우지 못했어요. 다시 해 주세요.";
interface Open { bookmark: LibraryBookmark; shelfId: string }

/**
 * S-09 내 책갈피 (PRD F-13, DESIGN S-09·C-17, 시안 `2026-10-04-v2/library-front-drag.png`): "N개 · 동물 M종", the rods,
 * [＋ 막대 추가], and a small [로그아웃] at the very bottom. Moving (10-04): [책갈피 옮기기] turns move mode on — every
 * bookmark can then be dragged to a place on any rod straight away, taps do nothing, and the rod buttons step aside —
 * until [완료], Escape (when no drag is live) or leaving the page. Or open a bookmark and use [다른 막대로 옮기기] (no
 * dragging needed). No toast for a move that worked (user, 10-04). [모두 제거] (시안 A, 10-04) sits beside [책갈피 옮기기]
 * and asks once more in a sheet; the rods stay. [막대 지우기] (10-07) on every rod but the first: an empty rod goes at once,
 * one with bookmarks asks first (C-27) and goes with them. Logged out, it offers the login instead — and since v1.7, when this browser
 * keeps bookmarks, shows them first (GuestLibrary).
 */
export function Library() {
  const account = useAccount();
  useEffect(() => { void loadAccount(); }, []);

  if (account.status === "unknown") return <p className={styles.quiet} aria-busy="true">불러오는 중…</p>;
  if (account.status === "off") return <p className={styles.quiet}>아직 로그인을 열지 않았어요.</p>;
  if (account.status === "out") return <LoggedOut />;
  return <LoggedIn />;
}

function LoggedOut() {
  const guest = useGuestSaves();
  if (guest.length > 0) return <GuestLibrary saves={guest} />;
  // 도감 v1 시안 ②: before a login, the 도감 (all silhouettes) and the login instead of the rods
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>도감</h1>
      <LoggedOutDex />
    </div>
  );
}

type View = "rods" | "dex";
/** 도감 v1 시안 ①: [막대 | 도감] at the top of 내 책갈피 — two buttons, the shown one pressed. */
function ViewSwitch({ view, onView }: { view: View; onView: (v: View) => void }) {
  return (
    <div className={styles.switch} role="group" aria-label="내 책갈피 보기">
      <button type="button" className={styles.switchButton} aria-pressed={view === "rods"} onClick={() => onView("rods")}>막대</button>
      <button type="button" className={styles.switchButton} aria-pressed={view === "dex"} onClick={() => onView("dex")}>도감</button>
    </div>
  );
}

function LoggedIn() {
  const [view, setView] = useState<View>("rods");
  const toggle = <ViewSwitch view={view} onView={setView} />;
  if (view === "rods") return <Rods toggle={toggle} />;
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>내 책갈피</h1>
      {toggle}
      <Dex />
    </div>
  );
}

/** 16 px line icons before the two button labels (option A) — decoration only, the label says it. */
const MoveIcon = () => (
  <svg className={styles.icon} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M8 1.5v13M1.5 8h13M8 1.5 6 3.5M8 1.5l2 2M8 14.5l-2-2M8 14.5l2-2M1.5 8l2-2M1.5 8l2 2M14.5 8l-2-2M14.5 8l-2 2" />
  </svg>
);
const TrashIcon = () => (
  <svg className={styles.icon} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M2.5 4h11M6 4V2.5h4V4M3.8 4l.7 9.5h7l.7-9.5M6.5 6.5v4.5M9.5 6.5v4.5" />
  </svg>
);

/** `toggle`: the [막대 | 도감] switch, under the title (hidden in move mode — a calm screen, only moving). */
function Rods({ toggle }: { toggle?: ReactNode }) {
  const lib = useLibrary();
  const [open, setOpen] = useState<Open | null>(null);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [moveMode, setMoveMode] = useState(false);
  const [clearing, setClearing] = useState(false);
  /** The rod whose [막대 지우기] asked first (it has bookmarks). */
  const [removingRod, setRemovingRod] = useState<string | null>(null);
  // after [모두 빼기] / [지우기] the button that opened the sheet is gone: focus lands on the page title instead of the body
  const title = useRef<HTMLHeadingElement>(null);
  const cleared = useRef(false);
  // C-22: the first visit to 내 책갈피 shows a small example shelf once (per browser)
  const [guide, setGuide] = useState(() => !libraryGuide.hasSeen());
  // a move that worked says nothing (user, 10-04) — the rods already show it
  const { drag, start, ghostRef } = useDrag((isbn, to) => {
    void lib.move(isbn, to.shelfId, "drag", to.index).then((ok) => { if (!ok) setNote(FAILED_MOVE); });
  });
  const moving = moveMode && (lib.view?.count ?? 0) > 0;
  const closeGuide = () => {
    libraryGuide.markSeen();
    setGuide(false);
  };

  useEffect(() => {
    if (!note) return;
    const timer = setTimeout(() => setNote(null), NOTE_MS);
    return () => clearTimeout(timer);
  }, [note]);

  useEffect(() => {
    if (clearing || removingRod || !cleared.current) return;
    cleared.current = false;
    title.current?.focus();
  }, [clearing, removingRod]);

  // Escape leaves move mode — but not while a drag is live (there it only puts the bookmark back, useDrag) or a sheet is open
  useEffect(() => {
    if (!moving || drag || open) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setMoveMode(false); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [moving, drag, open]);

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
        <h1 className={styles.title}>내 책갈피</h1>
        {toggle}
        <p className={styles.quiet}>내 책갈피를 불러오지 못했어요.</p>
        <Button variant="secondary" onClick={() => void lib.reload()}>다시 불러오기</Button>
      </div>
    );
  }

  const { view } = lib;
  const shelves = view.shelves;

  const add = async () => {
    if (addBusy) return;
    setAddBusy(true);
    const ok = await lib.addShelf(newName);
    setAddBusy(false);
    if (ok) {
      setAdding(false);
      setNewName("");
    } else {
      setNote(`막대 이름은 1~${SHELF_NAME_MAX}자, 막대는 ${MAX_SHELVES}개까지예요.`);
    }
  };

  const leave = async () => {
    if (!(await logout())) {
      setNote("로그아웃하지 못했어요. 다시 해 주세요.");
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
    <div className={styles.page} data-move-mode={moving ? "" : undefined} data-dragging={drag ? "" : undefined}>
      {guide && !open && <LibraryGuide onClose={closeGuide} />}
      <h1 ref={title} tabIndex={-1} className={styles.title}>내 책갈피</h1>
      {!moving && toggle}
      <p className={styles.stat}>{`${view.count}개 · 동물 ${view.animals}종`}</p>
      {view.count === 0 && <p className={styles.quiet}>책을 만나 🔖 내 책갈피에 저장을 누르면 첫 막대에 걸려요.</p>}
      {view.count > 0 && (
        <div className={styles.actions}>
          <button
            type="button" className={styles.moveToggle} data-moving={moving ? "" : undefined}
            onClick={() => { setAdding(false); setNewName(""); setMoveMode(!moving); }}
          >
            {!moving && <MoveIcon />}
            {moving ? MOVE_DONE : MOVE_MODE}
          </button>
          {!moving && (
            <button type="button" className={styles.clearAll} onClick={() => setClearing(true)}>
              <TrashIcon />
              {CLEAR_ALL}
            </button>
          )}
        </div>
      )}
      {moving && <p className={styles.hint}>{MOVE_HINT}</p>}

      {shelves.map((shelf) => (
        <Shelf
          key={shelf.id}
          shelf={shelf}
          moving={moving}
          dragged={drag?.bookmark.isbn ?? null}
          gap={drag?.over?.shelfId === shelf.id && !samePlace(drag.over, drag.from) ? drag.over.index : null}
          onOpen={(bookmark) => setOpen({ bookmark, shelfId: shelf.id })}
          onPick={(bookmark, index, at, box, pointerId) => start(bookmark, { shelfId: shelf.id, index }, at, box, pointerId)}
          onRename={(name) => lib.renameShelf(shelf.id, name)}
          onRemove={() => {
            if (shelf.bookmarks.length > 0) {
              setRemovingRod(shelf.id);
              return;
            }
            void lib.removeShelf(shelf.id).then((ok) => {
              if (ok) title.current?.focus();
              else setNote(FAILED_ROD);
            });
          }}
        />
      ))}

      {shelves.length < MAX_SHELVES && !moving && (adding ? (
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
      {!drag && note && <p className={styles.toast} role="status">{note}</p>}

      {open && (
        <BookmarkSheet
          bookmark={shelves.flatMap((s) => s.bookmarks).find((b) => b.isbn === open.bookmark.isbn) ?? open.bookmark}
          shelfId={open.shelfId}
          shelves={shelves}
          onMove={(to) => lib.move(open.bookmark.isbn, to, "menu")}
          onRemove={() => lib.remove(open.bookmark.isbn)}
          onDecorate={(art) => lib.decorate(open.bookmark.isbn, art)}
          onClose={() => setOpen(null)}
        />
      )}
      {removingRod && (
        <RemoveRodSheet
          count={shelves.find((s) => s.id === removingRod)?.bookmarks.length ?? 0}
          onRemove={async () => {
            const ok = await lib.removeShelf(removingRod, true);
            cleared.current = ok;
            return ok;
          }}
          onClose={() => setRemovingRod(null)}
        />
      )}
      {clearing && (
        <ClearSheet
          count={view.count}
          onClear={async () => {
            const ok = await lib.clearAll();
            cleared.current = ok;
            return ok;
          }}
          onClose={() => setClearing(false)}
        />
      )}
    </div>
  );
}
