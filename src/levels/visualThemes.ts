/** Pure data (no Three.js or DOM): curated, same-origin visual choices only.
 * The gameplay schema stays v1. Untrusted IDs or URLs never enter resource loading.
 */
export const VISUAL_THEMES = Object.freeze({
  'nebula-blue':Object.freeze({
    id:'nebula-blue',sky:0x07152b,galaxyTint:0xffffff,
    planetTint:0xffffff,asteroidTint:0xffffff,foregroundTint:0xffffff,
    rimTint:0x94b7ed,
    background:'art/backgrounds/galaxy-reactmono-veil.webp',
  }),
  'violet-drift':Object.freeze({
    id:'violet-drift',sky:0x130e30,galaxyTint:0xd0b8f2,
    planetTint:0xcbb2f2,asteroidTint:0xc6b1df,foregroundTint:0xbbaacc,
    rimTint:0xbda0ea,
    background:'art/backgrounds/galaxy-p4-veil.webp',
  }),
});
export type VisualThemeId=keyof typeof VISUAL_THEMES;
export type VisualTheme=(typeof VISUAL_THEMES)[VisualThemeId];
export const DEFAULT_VISUAL_THEME:VisualThemeId='nebula-blue';

export function resolveVisualTheme(value:unknown):{id:VisualThemeId;warning:string|null}{
  if(value===undefined)return {id:DEFAULT_VISUAL_THEME,warning:null};
  if(typeof value==='string' && Object.prototype.hasOwnProperty.call(VISUAL_THEMES,value))
    return {id:value as VisualThemeId,warning:null};
  // Fail closed for resources while allowing the already-validated XY gameplay to run.
  return {id:DEFAULT_VISUAL_THEME,warning:'未知视觉主题，已安全回退默认主题'};
}
