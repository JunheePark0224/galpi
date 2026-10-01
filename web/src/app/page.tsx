import { TrackVisit } from "@/components/TrackVisit";
import { FlowRoot } from "@/components/flow/FlowRoot";
import { ACTIVE_VOCAB, library } from "@/lib/books/catalog";

/** F-23 "오늘 +M": the page is built again at most every 10 minutes, so today's count follows the Korean date. */
export const revalidate = 600;

export default function Page() {
  return (
    <>
      <TrackVisit />
      <FlowRoot vocab={ACTIVE_VOCAB} library={library(new Date())} />
    </>
  );
}
