const CHAPTERS: Record<string, number> = {
  "Prologue": 0,
  "Forsaken City": 1,
  "Old Site": 2,
  "Celestial Resort": 3,
  "Golden Ridge": 4,
  "Mirror Temple": 5,
  "Reflection": 6,
  "The Summit": 7
};

export function parseAPLocation(name: string) {
  // Ignore B/C sides
  if (name.includes(" B -") || name.includes(" C -")) return null;

  // Ignore post-Ch7
  if (
    name.startsWith("Core") ||
    name.startsWith("Farewell")
  ) return null;

  const [chapterPart, roomPart] = name.split(" - ");
  if (!roomPart) return null;

  const chapterKey = Object.keys(CHAPTERS)
    .find(c => chapterPart.startsWith(c));

  if (!chapterKey) return null;

  let type: "strawberry" | "key" | "cassette" | "heart" | null = null;

  if (roomPart.includes("Strawberry")) type = "strawberry";
  else if (roomPart.includes("Key")) type = "key";
  else if (roomPart.includes("Cassette")) type = "cassette";
  else if (roomPart.includes("Crystal Heart")) type = "heart";
  else return null;

  const indexMatch = roomPart.match(/(Strawberry|Key)\s*(\d+)/);
  const index = indexMatch ? Number(indexMatch[2]) : 1;

  const roomSlug = roomPart
    .replace(/Strawberry.*|Key.*|Cassette|Crystal Heart/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .toLowerCase();

    return {
    id: `ch${CHAPTERS[chapterKey]}_${roomSlug}_${type}_${index}`,
    chapter: CHAPTERS[chapterKey],
    type,
    name: `${roomPart} (${type} ${index})`,
    room: roomPart,
    apLocation: name
    };
}
