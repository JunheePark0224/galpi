import { TrackVisit } from "@/components/TrackVisit";
import { FlowRoot } from "@/components/flow/FlowRoot";
import { ACTIVE_VOCAB } from "@/lib/books/catalog";

export default function Page() {
  return (
    <>
      <TrackVisit />
      <FlowRoot vocab={ACTIVE_VOCAB} />
    </>
  );
}
