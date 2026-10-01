"use client";
import { useEffect, useReducer } from "react";
import { MotionConfig } from "motion/react";
import vocab from "@/data/vocab.json";
import type { BalanceChoice, Entry } from "@/lib/recommend";
import { newArtSeed } from "@/lib/art/combine";
import { loadDetail } from "@/lib/books/detailClient";
import type { Vocab } from "@/lib/books/types";
import { drawBody, requestDraw, toDrawView } from "@/lib/flow/api";
import { curiousPicks, flowReducer, type FlowAction, type FlowState, type Reaction } from "@/lib/flow/state";
import { loadFlow, saveFlow } from "@/lib/flow/storage";
import { coverageBucket, editedQuestions, editedTargetFields } from "@/lib/flow/summary";
import { goalSubmittedProps, type TargetForm } from "@/lib/flow/target";
import { matchGoal } from "@/lib/goal/match";
import { setEntry } from "@/lib/track/common";
import { track } from "@/lib/track/client";
import { BalanceGame } from "./BalanceGame";
import { BookScene } from "./BookScene";
import { EndScreen } from "./EndScreen";
import { Home } from "./Home";
import { ResultBook } from "./ResultBook";
import { TargetInput } from "./TargetInput";

const VOCAB = vocab as Vocab;

/** S-01 → S-05 → S-06 → S-08. Cross-screen events are sent here, in the handlers (never from effects). */
export function Flow() {
  const [state, dispatch] = useReducer(flowReducer, undefined, loadFlow);

  useEffect(() => { saveFlow(state); }, [state]);
  useEffect(() => { window.scrollTo(0, 0); }, [state.step, state.result]);

  const runDraw = async (s: FlowState) => {
    try {
      const res = await requestDraw(drawBody(s));
      if (s.entry === "target" && s.goal) {
        const found = s.goal.matched ? (res.found ?? 0) : 0;
        track("goal_coverage_checked", { coverage_bucket: coverageBucket(found), found_count: found });
      }
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

  const trackShown = (s: FlowState) => {
    const pick = s.draw?.picks[s.index];
    if (!pick) return;
    track("bookmark_shown", {
      book_id: pick.card.id, position: s.index + 1, one_liner_style: pick.card.oneLinerStyle, pick_type: pick.kind, art: pick.art,
    });
  };

  /** E-10: the 궁금해요 book now on S-06 (position counts within the 궁금해요 books, from 1). */
  const trackResultBook = (s: FlowState) => {
    const pick = curiousPicks(s)[s.result];
    if (pick) track("result_book_viewed", { book_id: pick.card.id, position: s.result + 1, pick_type: pick.kind });
  };

  /** Into S-06: E-09 once, then E-10 for the first book; every 궁금해요 book's detail is asked for ahead. */
  const enterResult = (s: FlowState) => {
    const curious = curiousPicks(s);
    track("result_viewed", { curious_count: curious.length });
    trackResultBook(s);
    for (const p of curious) void loadDetail(p.card.id);
  };

  const start = (entry: Entry) => {
    setEntry(entry);
    track("entry_selected", {});    // the entry itself is the common `entry`, set just above
    act({ type: "start", entry });
  };

  const answer = (choice: BalanceChoice) => {
    const next = act({ type: "answer", choice });
    if (next.drawId !== state.drawId && state.prevChoices) {
      track("first_page_edited", { changed_items: editedQuestions(state.prevChoices, next.choices) });
    }
  };

  const submitTarget = (form: TargetForm) => {
    const goal = form.free !== null ? matchGoal(form.free, VOCAB) : null;
    track("goal_submitted", goalSubmittedProps(form, goal, state.edited));
    if (goal) {
      track("free_goal_written", {
        goal_text: goal.text, topic: goal.topic, keywords: goal.keywords, is_matched: goal.matched, method: goal.method,
      });
    }
    if (state.prevForm) track("first_page_edited", { changed_items: editedTargetFields(state.prevForm, form) });
    act({ type: "submitTarget", form, goal });
  };

  const open = () => {
    track("book_opened", {});
    act({ type: "open" });
  };

  const nextPage = () => {
    const next = act({ type: "next" });
    if (next.step === "bookmarks") trackShown(next);
  };

  const react = (reaction: Reaction) => {
    const pick = state.draw?.picks[state.index];
    if (state.step !== "bookmarks" || !pick) return;
    track("bookmark_reacted", {
      book_id: pick.card.id, position: state.index + 1, reaction, pick_type: pick.kind, one_liner_style: pick.card.oneLinerStyle,
    });
    const next = act({ type: "react", reaction });
    if (next.step === "bookmarks") trackShown(next);
    if (next.step === "result") enterResult(next);
  };

  const nextResult = () => {
    const next = act({ type: "nextResult" });
    if (next.step === "result") trackResultBook(next);
  };

  /** S-08 [다시 뽑기] (E-19): track() moves the round on right after sending it (taxonomy 3-1a); the entry stays. */
  const redraw = () => {
    track("redraw_clicked", { curious_count: state.reactions.filter((r) => r === "curious").length });
    act({ type: "redraw" });
  };

  /** [처음으로] — source: first_page = S-04 dead end (draw failed / no books), end = S-08 (taxonomy E-20). */
  const home = (source: "first_page" | "end") => {
    track("home_clicked", { curious_count: state.reactions.filter((r) => r === "curious").length, source });
    setEntry(null);
    act({ type: "home" });
  };

  const inBook = state.step === "book" || state.step === "first" || state.step === "bookmarks";
  const curious = curiousPicks(state);
  const resultPick = state.step === "result" ? curious[state.result] : undefined;

  return (
    <MotionConfig reducedMotion="user">
      {state.step === "home" && <Home onStart={start} />}
      {state.step === "leaf" && <BalanceGame choices={state.choices} edit={state.edited} onAnswer={answer} />}
      {state.step === "target" && <TargetInput initial={state.form} edit={state.edited} onSubmit={submitTarget} />}
      {inBook && (
        <BookScene
          state={state}
          onOpen={open}
          onEdit={() => act({ type: "edit" })}
          onNext={nextPage}
          onRetry={() => act({ type: "retry" })}
          onReact={react}
          onHome={() => home("first_page")}
        />
      )}
      {resultPick && (
        <ResultBook key={resultPick.card.id} pick={resultPick} position={state.result + 1} total={curious.length} onNext={nextResult} />
      )}
      {state.step === "end" && <EndScreen onRedraw={redraw} onHome={() => home("end")} />}
    </MotionConfig>
  );
}
