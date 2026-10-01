// Runs before vitest.setup.ts loads React DOM. jsdom has no AnimationEvent, so React DOM would listen for the prefixed
// webkitAnimationEnd and onAnimationEnd handlers (C-16 BookmarkInBook) could not be tested with fireEvent.animationEnd.
if (typeof window !== "undefined" && !("AnimationEvent" in window)) {
  Object.assign(window, { AnimationEvent: class AnimationEvent extends Event {} });
}
