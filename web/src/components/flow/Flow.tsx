"use client";
import { useEffect, useEffectEvent, useReducer, useRef, useState } from "react";
import { MotionConfig } from "motion/react";
import { loadAccount } from "@/lib/account/store";
import { newArtSeed } from "@/lib/art/combine";
import { readyCover, waitForCover } from "@/lib/books/detailClient";
import { reportMeeting } from "@/lib/collection/client";
import type { FoundItem } from "@/lib/collection/types";
import type { LibraryCount } from "@/lib/books/library";
import { drawBody, requestDraw, toDrawView } from "@/lib/flow/api";
import { challengeProps, completedProps, nextQuestion, pathCommon } from "@/lib/flow/path";
import { deviceBackMove } from "@/lib/flow/back";
import { curiousPicks, flowReducer, meetingOf, type FlowAction, type FlowState, type Reaction } from "@/lib/flow/state";
import { loadFlow, saveFlow } from "@/lib/flow/storage";
import { guestSaves } from "@/lib/library/guest";
import type { Answer, AnswerChoice } from "@/lib/paths";
import { setEntry, setMode } from "@/lib/track/common";
import { track } from "@/lib/track/client";
import { QUESTION_MAP } from "@/lib/paths";
import { encodeShare } from "@/lib/share/code";
import { storyFile } from "@/lib/share/storyFile";
import { advance, setFlowBack, unwind } from "@/lib/nav/deviceBack";
import { setFlowHome } from "@/lib/nav/homeLink";
import type { ShareMethod } from "./BackCover";
import { BookScene } from "./BookScene";
import { EndScreen } from "./EndScreen";
import { Home } from "./Home";
import { Question } from "./Question";
import { ResultBook } from "./ResultBook";
import { ResultLoading } from "./ResultLoading";
import styles from "./Flow.module.css";

/** taxonomy v1.0 3-1: the common branch (`entry`) and route (`mode`) follow the answers — set after each answer or step back. */
function syncCommon(answers: readonly Answer[]) {
  const { entry, mode } = pathCommon(answers);
  setEntry(entry);
  setMode(mode);
}

/**
 * S-01 → S-02 (the question map) → S-03 … S-08. Cross-screen events are sent here, in the handlers (never from effects).
 * library: the F-23 count for S-01 (FlowRoot).
 */
/** F-27: the link a 뒤표지 is shared with — the answers, the five books and their pictures (lib/share/code). */
function shareUrl(s: FlowState): string {
  const picks = s.draw?.picks ?? [];
  const code = encodeShare(QUESTION_MAP, { answers: s.answers, books: picks.map((p) => p.card.id), arts: picks.map((p) => p.art) });
  return `${window.location.origin}/s/${code}`;
}

/** The phone's back key on the bookmarks and the 뒤표지 (10-08): a reaction is never undone — [처음으로] is offered instead. */
export const HOLD_NOTICE = "책갈피는 되돌릴 수 없어요";
const NOTICE_MS = 5000;

export function Flow({ library = null }: { library?: LibraryCount | null }) {
  const [state, dispatch] = useReducer(flowReducer, undefined, loadFlow);
  const [shownResult, setShownResult] = useState<string | null>(null);   // the S-06 book whose cover is ready to show
  const [found, setFound] = useState<{ at: string; items: FoundItem[] } | null>(null);   // 도감 v1 badge, per bookmark
  // S-11 (10-07): after the last reaction the book shuts onto its back cover (not on a resumed round — already shut)
  const [closing, setClosing] = useState(false);

  useEffect(() => { saveFlow(state); }, [state]);
  useEffect(() => { window.scrollTo(0, 0); }, [state.step, state.result, state.answers.length]);

  const runDraw = async (s: FlowState) => {
    try {
      // 10-07: books kept in this browser (logged out) are never drawn again — the account's are left out by the server
      const res = await requestDraw(drawBody(s, guestSaves().map((g) => g.isbn)));
      dispatch({ type: "drawn", id: s.drawId, draw: toDrawView(res, newArtSeed()) });
    } catch {
      dispatch({ type: "drawFailed", id: s.drawId });
    }
  };

  /** Apply an action; start a draw whenever the action asked for one. */
  const act = (action: FlowAction): FlowState => {
    const next = flowReducer(state, action);
    dispatch(action);
    if (next.drawId !== state.drawId) void runDraw(next);
    return next;
  };

  /**
   * 도감 v1: a logged-in person met this bookmark — the server records its parts from the signed seed (never the picture
   * itself) and says which were new: E-36 for each, and the badge while the same bookmark is still up. Logged out: nothing.
   */
  const meet = (s: FlowState) => {
    setFound(null);                      // a new bookmark: an older badge never carries over (drawId restarts after [처음으로])
    const ticket = s.draw?.ticket;
    if (!ticket?.sig) return;
    const at = `${s.drawId}:${s.index}:${s.draw?.picks[s.index]?.card.id}`;
    void (async () => {
      if ((await loadAccount()).status !== "in") return;
      const items = await reportMeeting(ticket, s.index);
      for (const item of items) track("collection_item_found", { part_kind: item.kind, part_value: item.value, tier: item.tier });
      if (items.length > 0) setFound({ at, items });
    })();
  };

  const trackShown = (s: FlowState) => {
    const pick = s.draw?.picks[s.index];
    if (!pick) return;
    track("bookmark_shown", {
      book_id: pick.card.id, position: s.index + 1, one_liner_style: pick.card.oneLinerStyle, pick_type: pick.kind, art: pick.art, ...challengeProps(s.draw?.challenge),
    });
    meet(s);
  };

  /** E-10: the 궁금해요 book now on S-06 — once per book and round (taxonomy v0.11). */
  const viewedResults = useRef(new Set<string>());
  const trackResultBook = (s: FlowState) => {
    const pick = curiousPicks(s)[s.result];
    if (!pick || viewedResults.current.has(pick.card.id)) return;
    viewedResults.current.add(pick.card.id);
    track("result_book_viewed", { book_id: pick.card.id, position: s.result + 1, pick_type: pick.kind });
  };

  /** Into S-06: E-09 once, then E-10 for the first book; every 궁금해요 book's detail is asked for ahead. */
  const enterResult = (s: FlowState) => {
    const curious = curiousPicks(s);
    track("result_viewed", { curious_count: curious.length });
    viewedResults.current = new Set();
    trackResultBook(s);
    for (const p of curious) void readyCover(p.card.id);
  };

  /** S-01 [갈피 잡으러 가기] (E-02): no branch and no route yet — the questions set them. */
  const start = () => {
    syncCommon([]);
    track("entry_selected", { source: "home" });
    advance();
    act({ type: "start" });
  };

  /**
   * [처음으로] (E-20) — first_page = S-04 dead end, end = S-08, question = the first question's [← 이전 질문],
   * device_back = the phone's back key, header = the header's [처음으로] (10-09).
   */
  const home = (source: "first_page" | "end" | "question" | "device_back" | "header") => {
    track("home_clicked", { curious_count: state.reactions.filter((r) => r === "curious").length, source });
    syncCommon([]);
    act({ type: "home" });
  };

  const node = state.step === "questions" ? nextQuestion(state.answers) : null;

  /** E-32 for every answer (common = before it), then E-34 when the path ends (common = the finished path). */
  const answer = (choice: AnswerChoice, elapsedMs: number) => {
    if (!node) return;
    track("question_answered", {
      node_id: node.id, kind: node.kind, choice, depth: state.answers.length + 1, position: state.asked + 1, elapsed_ms: elapsedMs,
    });
    advance();
    const next = act({ type: "answer", choice });
    syncCommon(next.answers);
    if (nextQuestion(next.answers) === null) track("path_completed", completedProps(next.answers));
  };

  const holdCancelled = (heldMs: number) => {
    if (!node) return;
    track("unsure_hold_cancelled", { node_id: node.id, depth: state.answers.length + 1, held_ms: heldMs });
  };

  /** S-02 [← 이전 질문] and S-04 [← 질문으로 돌아가기] (E-33): drop the last answer. On the first question: S-01.
   *  The phone's back key does the same (source device_back, 10-08). */
  const back = (device = false) => {
    const last = state.answers.at(-1);
    if (!last) {
      home(device ? "device_back" : "question");
      return;
    }
    const source = device ? "device_back" : state.step === "first" ? "first_page" : "question";
    track("question_back_clicked", { node_id: last.node, depth: state.answers.length, source });
    const next = act({ type: "back" });
    syncCommon(next.answers);
  };

  const open = () => {
    track("book_opened", {});
    advance();
    act({ type: "open" });
  };

  const nextPage = () => {
    advance();
    const next = act({ type: "next" });
    if (next.step === "bookmarks") trackShown(next);
  };

  const react = (reaction: Reaction) => {
    const pick = state.draw?.picks[state.index];
    if (state.step !== "bookmarks" || !pick) return;
    if (reaction === "curious") void readyCover(pick.card.id);       // its cover starts loading now (10-02)
    track("bookmark_reacted", {
      book_id: pick.card.id, position: state.index + 1, reaction, pick_type: pick.kind, one_liner_style: pick.card.oneLinerStyle,
    });
    const next = act({ type: "react", reaction });
    if (next.step === "bookmarks") trackShown(next);
    if (next.step === "back") {
      setClosing(true);
      // the server starts drawing the story picture now, while the book shuts (10-08: the sheet's preview came late)
      void storyFile(`${new URL(shareUrl(next)).pathname}/story`);
    }
  };
  /** The book has shut: its back cover shows now (E-41 — when it is seen, taxonomy). */
  const closed = () => {
    setClosing(false);
    track("back_cover_shown", { curious_count: curiousPicks(state).length, label_count: state.draw?.label?.chips.length ?? 0 });
  };

  /** S-11 main button: S-06 with something 궁금해요, S-08 without (PRD 2절). */
  const leaveBack = () => {
    advance();
    const next = act({ type: "leaveBack" });
    if (next.step === "result") enterResult(next);
  };
  const shared = (method: ShareMethod, isLinkCopied: boolean | null) => {
    track("share_clicked", { method, label_count: state.draw?.label?.chips.length ?? 0, is_link_copied: isLinkCopied });
  };

  const nextResult = () => {
    advance();
    const next = act({ type: "nextResult" });
    if (next.step === "result") trackResultBook(next);
  };
  /** S-06 ‹: no event (taxonomy v0.11). */
  const prevResult = () => { act({ type: "prevResult" }); };

  // The phone's back key (10-08, plans/2026-10-08-device-back.md): every tap that takes a step forward adds one history
  // entry (lib/nav/deviceBack `advance`), so the back key moves one step back — several presses, several steps. On the
  // bookmarks and the 뒤표지 it stays (a reaction is never undone) and offers [처음으로]. Back at S-01, the flow's
  // entries left are gone over, so the next press leaves the site.
  const screen = `${state.step}:${state.index}`;
  const [noticeFor, setNoticeFor] = useState<string | null>(null);
  const deviceBack = useEffectEvent(() => {
    switch (deviceBackMove(state)) {
      case "question":
        back(true);
        break;
      case "home":
        home("device_back");
        break;
      case "hold":
        setNoticeFor(screen);
        break;
      case "prevResult":
        prevResult();
        break;
      case "toBack":
        act({ type: "returnToBack" });
        break;
      case "leave":
        break;
    }
  });
  useEffect(() => setFlowBack(() => deviceBack()), []);
  // The header's [처음으로] (10-09, D안): offered while away from S-01, straight home with no confirmation.
  const headerHome = useEffectEvent(() => home("header"));
  const away = state.step !== "home";
  useEffect(() => setFlowHome(away ? () => headerHome() : null), [away]);
  useEffect(() => {
    if (state.step === "home") unwind();
  }, [state.step]);
  useEffect(() => {
    if (!noticeFor) return;
    const t = setTimeout(() => setNoticeFor(null), NOTICE_MS);
    return () => clearTimeout(t);
  }, [noticeFor]);

  /** S-08 [다시 뽑기] (E-19): track() moves the round on right after sending it (taxonomy 3-1a); the path stays. */
  const redraw = () => {
    track("redraw_clicked", { curious_count: state.reactions.filter((r) => r === "curious").length });
    advance();
    act({ type: "redraw" });
  };

  const inBook = state.step === "book" || state.step === "first" || state.step === "bookmarks" || (state.step === "back" && !!state.draw);
  const curious = curiousPicks(state);
  const resultPick = state.step === "result" ? curious[state.result] : undefined;
  // 10-02 (user): between screens, wait (≤ 3 s) for the book's cover so S-06 appears with its printed cover already there
  const waitingFor = resultPick?.card.id ?? null;
  useEffect(() => {
    if (!waitingFor || waitingFor === shownResult) return;
    let live = true;
    void waitForCover(waitingFor).then(() => { if (live) setShownResult(waitingFor); });
    return () => { live = false; };
  }, [waitingFor, shownResult]);

  return (
    <MotionConfig reducedMotion="user">
      {state.step === "home" && <Home onStart={start} library={library} />}
      {node && (
        // a new key per question shown (an answer or a step back): the tap guard and the hold start again
        <Question key={`${state.asked}-${state.answers.length}`} node={node} onAnswer={answer} onHoldCancel={holdCancelled} onBack={() => back()} />
      )}
      {inBook && (
        <BookScene
          state={state}
          onOpen={open}
          onBack={() => back()}
          onNext={nextPage}
          onRetry={() => act({ type: "retry" })}
          onReact={react}
          onHome={() => home("first_page")}
          found={found?.at === `${state.drawId}:${state.index}:${state.draw?.picks[state.index]?.card.id}` ? found.items : null}
          back={state.step === "back"
            ? { shutting: closing, curious: curious.length, shareUrl: shareUrl(state), onContinue: leaveBack, onShared: shared, onClosed: closed }
            : undefined}
        />
      )}
      {resultPick && shownResult === resultPick.card.id && (
        <ResultBook
          key={resultPick.card.id} pick={resultPick} position={state.result + 1} total={curious.length} onNext={nextResult} onPrev={prevResult}
          meeting={meetingOf(state.draw, resultPick)}
        />
      )}
      {resultPick && shownResult !== resultPick.card.id && <ResultLoading />}
      {state.step === "end" && <EndScreen onRedraw={redraw} onHome={() => home("end")} />}
      {noticeFor === screen && (
        <div className={styles.notice} role="status">
          <span>{HOLD_NOTICE}</span>
          <button type="button" className={styles.noticeHome} onClick={() => home("device_back")}>처음으로</button>
        </div>
      )}
    </MotionConfig>
  );
}
