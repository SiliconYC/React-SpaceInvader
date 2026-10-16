import { LevelValidationError } from './parse.ts';

export interface LevelListing {
  readonly id: string;
  readonly name: string;
  readonly description: string;
}
export interface LevelCatalog {
  readonly schemaVersion: 1;
  readonly levels: readonly LevelListing[];
}
export function parseLevelCatalog(value: unknown): LevelCatalog {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new LevelValidationError('关卡清单必须是对象');
  const root = value as Record<string, unknown>;
  if (root.schemaVersion !== 1) throw new LevelValidationError('关卡清单 schemaVersion 不支持');
  if (Object.keys(root).sort().join(',') !== 'levels,schemaVersion') throw new LevelValidationError('关卡清单字段不正确');
  if (!Array.isArray(root.levels) || root.levels.length < 2 || root.levels.length > 16) {
    throw new LevelValidationError('清单必须包含 2～16 个关卡');
  }
  const seen = new Set<string>();
  const levels = root.levels.map((item, index) => {
    const path = 'levels[' + index + ']';
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new LevelValidationError(path + ' 必须是对象');
    const entry = item as Record<string, unknown>;
    if (Object.keys(entry).sort().join(',') !== 'description,id,name') throw new LevelValidationError(path + ' 字段不正确');
    if (typeof entry.id !== 'string' || !/^[a-z][a-z0-9-]{0,39}$/.test(entry.id) || seen.has(entry.id)) {
      throw new LevelValidationError(path + ' id 不合法或重复');
    }
    seen.add(entry.id);
    for (const key of ['name', 'description'] as const) {
      const field = entry[key];
      if (typeof field !== 'string' || !field.trim() || field.length > (key === 'name' ? 48 : 240)) {
        throw new LevelValidationError(path + ' ' + key + ' 非法');
      }
    }
    return Object.freeze({ id: entry.id, name: entry.name as string, description: entry.description as string });
  });
  return Object.freeze({ schemaVersion: 1, levels: Object.freeze(levels) });
}
export async function loadLevelCatalog(signal?: AbortSignal): Promise<LevelCatalog> {
  const response = await fetch(import.meta.env.BASE_URL + 'levels/index.json', { signal });
  if (!response.ok) throw new Error('关卡清单加载失败（' + response.status + '）');
  let payload: unknown;
  try { payload = await response.json() as unknown; }
  catch { throw new LevelValidationError('关卡清单不是有效 JSON'); }
  return parseLevelCatalog(payload);
}
