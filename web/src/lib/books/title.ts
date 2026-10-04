/** How a book title is written on a bookmark (front and back, 10-04 user request): inside 『 』, the Korean book mark. */
export function bookTitle(title: string): string {
  return `『${title.trim()}』`;
}
