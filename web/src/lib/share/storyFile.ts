/**
 * The story picture (C-30) as a File for the share sheet's [인스타 스토리로] (F-27). A share must start right on the tap
 * (iOS), so the file is in hand beforehand: the S-11 buttons ask for it as the book shuts, and the sheet gets the same
 * one (10-08, user: the tile came a moment late). One fetch per story path; a failed one is asked again next time.
 */
const stories = new Map<string, Promise<File | null>>();

export function storyFile(path: string): Promise<File | null> {
  const known = stories.get(path);
  if (known) return known;
  const asked = fetch(path)
    .then((res) => (res.ok ? res.blob() : Promise.reject(new Error(`story ${res.status}`))))
    .then((blob) => new File([blob], "galpi-bookmarks.png", { type: "image/png" }))
    .catch(() => {
      stories.delete(path);
      return null;
    });
  stories.set(path, asked);
  return asked;
}

/** Tests only: start from nothing. */
export function forgetStories(): void {
  stories.clear();
}

/** Can this browser hand a picture to the share sheet (Instagram story …)? Not the app's name — what it does (10-07). */
export function canShareImages(): boolean {
  if (typeof navigator === "undefined" || typeof navigator.canShare !== "function") return false;
  const probe = new File([new Uint8Array(1)], "x.png", { type: "image/png" });   // not empty: some browsers refuse an empty file
  return navigator.canShare({ files: [probe] });
}
