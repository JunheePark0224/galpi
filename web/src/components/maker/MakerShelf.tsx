"use client";
import { useEffect, useRef, useState } from "react";
import { Bookmark } from "@/components/Bookmark";
import { Button, LinkButton } from "@/components/Button";
import { metLabel } from "@/components/library/BookmarkSheet";
import libraryStyles from "@/components/library/Library.module.css";
import { Shelf } from "@/components/library/Shelf";
import { Sheet } from "@/components/Sheet";
import { yes24SearchUrl } from "@/lib/books/detail";
import { libraryRequest } from "@/lib/library/client";
import { parseMakerView, type MakerBookmark, type MakerView } from "@/lib/library/makerView";
import type { LibraryBookmark, LibraryShelf } from "@/lib/library/types";
import { track } from "@/lib/track/client";
import styles from "./MakerShelf.module.css";
import { RodPeek } from "./RodPeek";

const NAME = "책갈피 구경";
const LINE = "갈피 운영자의 책갈피함";
/** Contains the visible words (WCAG 2.5.3). */
const LABEL = `${NAME} — ${LINE}`;
export const MAKER_TITLE = LINE;
const START = "나도 책갈피 모으러 가기";
const BACK = "← 책갈피함으로";
const LOADING = "책갈피함을 펼치는 중…";
const EMPTY = "아직 꽂힌 책갈피가 없어요";
const FAILED = "지금은 책갈피함을 불러올 수 없어요";

type Load = { status: "loading" } | { status: "failed" } | { status: "ready"; view: MakerView };

const nothing = async () => false;
const noop = () => {};
/** The shared C-17 rod draws a LibraryShelf: the public view gets made-up ids and a blank 나온 이유 it never shows. */
const asShelf = (shelf: MakerView["shelves"][number], i: number): LibraryShelf => ({
  id: `maker-${i}`, name: shelf.name, position: i,
  bookmarks: shelf.bookmarks.map((b) => ({ isbn: b.card.id, art: b.art, reason: { label: "이 책은", items: [] }, metOn: b.metOn, card: b.card })),
});

/**
 * S-01 PRD F-30 / DESIGN C-35: the third quiet button beside the 우체통 and the 소식통. It opens S-13 — the maker's own
 * rods and bookmarks, to look at only (C-17 rods without renaming or removing, C-13 cards). A bookmark opens large in the
 * same sheet with [예스24에서 보기] and [나도 책갈피 모으러 가기] (closes the sheet and starts a round). Loaded when opened,
 * once per page; a failure says so quietly and is asked again the next time the sheet opens.
 */
export function MakerShelf({ onStart }: { onStart: () => void }) {
  const [open, setOpen] = useState(false);
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [front, setFront] = useState<MakerBookmark | null>(null);
  const body = useRef<HTMLDivElement>(null);
  const fetching = useRef(false);

  // like the 소식통: the sheet focuses its first control, which may sit low — bring the top back into view
  useEffect(() => {
    const dialog = body.current?.closest<HTMLElement>("[role='dialog']");
    if (open && dialog) dialog.scrollTop = 0;
  }, [open, front]);

  const fetchShelf = async () => {
    if (fetching.current) return;           // reopened while the first answer is on its way: wait for that one
    fetching.current = true;
    setLoad({ status: "loading" });
    const answer = await libraryRequest("GET", "/api/maker-shelf");
    fetching.current = false;
    const view = answer.ok ? parseMakerView(answer.body) : null;
    setLoad(view ? { status: "ready", view } : { status: "failed" });
  };

  const openSheet = () => {
    track("maker_shelf_opened", {});
    setFront(null);
    setOpen(true);
    if (load.status !== "ready") void fetchShelf();
  };
  const close = () => setOpen(false);
  const show = (bookmark: LibraryBookmark) => {
    track("maker_bookmark_viewed", { book_id: bookmark.card.id });
    setFront({ art: bookmark.art, metOn: bookmark.metOn, card: bookmark.card });
  };
  const start = () => {
    setOpen(false);
    onStart();
  };

  return (
    <div className={styles.post}>
      <button type="button" className={styles.peek} aria-label={LABEL} onClick={openSheet}>
        <span className={styles.art}><RodPeek className={styles.drawing} /></span>
        <span className={styles.name} aria-hidden="true">{NAME}</span>
        <span className={styles.line} aria-hidden="true">{LINE}</span>
      </button>
      {open && (
        <Sheet title={MAKER_TITLE} onClose={close} stepKey={front ? `front-${front.card.id}` : "shelf"}>
          <div ref={body} className={styles.sheet}>
            {front ? (
              <>
                <div className={libraryStyles.frontFace}>
                  <span className={libraryStyles.big}>
                    <Bookmark card={front.card} art={front.art} met={metLabel(front.metOn)} moving />
                  </span>
                </div>
                <div className={libraryStyles.sheetActions}>
                  <LinkButton
                    href={yes24SearchUrl(front.card.id)}
                    onClick={() => track("yes24_link_clicked", { book_id: front.card.id, source: "maker_shelf", pick_type: null })}
                  >
                    예스24에서 보기 ↗
                  </LinkButton>
                  <Button variant="secondary" onClick={start}>{START}</Button>
                  <button type="button" className={styles.textButton} onClick={() => setFront(null)}>{BACK}</button>
                </div>
              </>
            ) : (
              <ShelfList load={load} onOpen={show} onClose={close} />
            )}
          </div>
        </Sheet>
      )}
    </div>
  );
}

function ShelfList({ load, onOpen, onClose }: { load: Load; onOpen: (b: LibraryBookmark) => void; onClose: () => void }) {
  return (
    <>
      {load.status === "loading" && <p className={styles.lead} aria-busy="true">{LOADING}</p>}
      {load.status === "failed" && <p className={styles.lead}>{FAILED}</p>}
      {load.status === "ready" && load.view.count === 0 && <p className={styles.lead}>{EMPTY}</p>}
      {load.status === "ready" && load.view.count > 0 && (
        <>
          <p className={styles.lead}>{`갈피 운영자가 갈피를 사용하는 방식이에요 · ${load.view.count}권`}</p>
          {load.view.shelves.map((shelf, i) => (
            <Shelf
              key={`${i}-${shelf.name}`} shelf={asShelf(shelf, i)} moving={false} fixed dragged={null} gap={null}
              onOpen={onOpen} onPick={noop} onRename={nothing} onRemove={noop}
            />
          ))}
        </>
      )}
      <button type="button" className={styles.textButton} onClick={onClose}>닫기</button>
    </>
  );
}
