import { expect } from "@playwright/test";
import { specMismatches, test } from "./helpers";

const common = { anon_id: "a", user_id: null, session_id: "s", round: 1, entry: null, mode: null, screen_version: "v2",
  referrer: "", is_returning: false, device: "phone", is_in_app_browser: false };

// No page: proves the check the flow specs rely on can fail.
test("the posted-event check catches old names, wrong prop keys and old common keys", () => {
  expect(specMismatches([{ name: "book_opened", props: {}, common }, { name: "site_visited", props: {}, common }])).toEqual([]);
  expect(specMismatches([{ name: "visit", props: {}, common }])).toEqual(["visit: not in EVENT_SPEC"]);
  expect(specMismatches([{ name: "home_clicked", props: { curious: 0 }, common }]))
    .toEqual(["home_clicked: props [curious], spec [curious_count,source]"]);
  const { is_returning, ...rest } = common;
  expect(specMismatches([{ name: "book_opened", props: {}, common: { ...rest, returning: is_returning } }]))
    .toEqual(["book_opened: common [anon_id,device,entry,is_in_app_browser,mode,referrer,returning,round,screen_version,session_id,user_id]"]);
});
