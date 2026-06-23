import { adjectives, animals, uniqueNamesGenerator } from "unique-names-generator";

/**
 * A playful, human-friendly name like "Sneaky Otter" — used as the default
 * player label and the 🎲 re-roll button. The browser exposes no real player
 * identity (no device/host name, no MAC address), so a fun generated name is a
 * better default than a blank field.
 */
export const randomName = (): string =>
  uniqueNamesGenerator({
    dictionaries: [adjectives, animals],
    separator: " ",
    style: "capital",
    length: 2,
  });
