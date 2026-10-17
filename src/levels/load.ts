import { parseLevel, LevelValidationError, type ThemedLevelPlan } from './parse.ts';

/** 仅下载静态同源 JSON；BASE_URL 使其兼容 GitHub Pages 项目子路径。 */
export async function loadLevel(id: string, signal?: AbortSignal): Promise<ThemedLevelPlan> {
  if (!/^[a-z][a-z0-9-]{0,39}$/.test(id)) throw new LevelValidationError('关卡文件名非法');
  const response = await fetch(import.meta.env.BASE_URL + 'levels/' + id + '.json', { signal });
  if (!response.ok) throw new Error('关卡加载失败：无法读取 ' + id + '（' + response.status + '）');
  let payload: unknown;
  try { payload = await response.json() as unknown; }
  catch { throw new LevelValidationError('关卡文件不是有效 JSON'); }
  const level = parseLevel(payload);
  if (level.id !== id) throw new LevelValidationError('文件标识与所选关卡不一致：' + id);
  return level;
}
