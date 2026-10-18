// Themes and avatars the server accepts. Art lives in web/src/themes.ts and web/src/art/avatars.tsx.

export const THEMES = ['quest', 'sparkle', 'space', 'ocean', 'dino'] as const;
/** Avatar families; any avatar can be used with any theme. */
export const AVATARS: Record<string, string[]> = {
  quest: ['knight', 'ranger', 'wizard', 'archer', 'royal', 'dragon'],
  sparkle: ['bunny', 'kitten', 'unicorn', 'puppy', 'panda', 'fairy'],
  space: ['astronaut', 'alien', 'robot', 'starcat'],
  ocean: ['mermaid', 'octopus', 'dolphin', 'turtle'],
  dino: ['trex', 'triceratops', 'explorer', 'pterodactyl'],
};

export const ALL_AVATARS = Object.keys(AVATARS).reduce<string[]>((all, t) => all.concat(AVATARS[t]), []);

export function isTheme(v: unknown): boolean {
  return (THEMES as readonly unknown[]).includes(v);
}
