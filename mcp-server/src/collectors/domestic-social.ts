import { z } from 'zod';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Collector } from '../types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEDIA_ROOT = path.resolve(__dirname, '../../tools/mediacrawler');
const PYTHON =
  process.platform === 'win32'
    ? path.join(MEDIA_ROOT, '.venv/Scripts/python.exe')
    : path.join(MEDIA_ROOT, '.venv/bin/python');

/** 对外友好平台名 -> MediaCrawler platform 值 */
const PLATFORM_MAP: Record<string, string> = {
  xiaohongshu: 'xhs',
  douyin: 'dy',
  kuaishou: 'ks',
  bilibili: 'bili',
  weibo: 'wb',
  tieba: 'tieba',
  zhihu: 'zhihu',
};

function killTree(pid: number) {
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/F', '/T', '/PID', String(pid)], { stdio: 'ignore', windowsHide: true });
    } else {
      process.kill(-pid, 'SIGKILL');
    }
  } catch {
    /* ignore */
  }
}

function runMediaCrawler(args: string[], timeoutMs = 150000): Promise<{ code: number | null; out: string }> {
  return new Promise((resolve, reject) => {
    if (!existsSync(PYTHON)) {
      reject(new Error(`未找到 MediaCrawler 的 Python 环境: ${PYTHON}（请先运行 npm run setup:media）`));
      return;
    }
    const nodeDir = path.dirname(process.execPath);
    const child: ChildProcess = spawn(PYTHON, ['main.py', ...args], {
      cwd: MEDIA_ROOT,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
        PYTHONDONTWRITEBYTECODE: '1',
        // execjs 在 Windows 上靠 PATH + PATHEXT 找 node.exe，且可用性在 import 时冻结；
        // 确保二者齐备，否则 MediaCrawler 的 douyin 模块 import 时偶发"找不到 JS runtime"。
        PATH: process.env.PATH ? `${nodeDir}${path.delimiter}${process.env.PATH}` : nodeDir,
        PATHEXT: process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD;.VBS;.VBE;.JS;.JSE;.WSF;.WSH;.MSC',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    });
    let out = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      if (child.pid) killTree(child.pid);
      resolve({ code: -1, out: (out + '\n[超时，已终止]').slice(-4000) });
    }, timeoutMs);
    child.stdout?.on('data', (d) => (out += d.toString()));
    child.stderr?.on('data', (d) => (out += d.toString()));
    child.on('error', (e) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(e);
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, out: out.slice(-4000) });
    });
  });
}

/**
 * 递归找 dir 下最新的"内容" .jsonl 文件。
 * MediaCrawler 会同时写 {type}_contents_*.jsonl（视频/笔记本体）和 {type}_comments_*.jsonl（评论），
 * 这里优先取 contents 文件、排除 comments 文件，同级再按 mtime 取最新。
 */
function findLatestJsonl(dir: string): string | null {
  let best: { p: string; m: number; s: number } | null = null;
  const walk = (d: string) => {
    let entries;
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith('.jsonl')) {
        const m = statSync(full).mtimeMs;
        const s = /contents/i.test(e.name) ? 2 : /comment/i.test(e.name) ? 0 : 1;
        if (!best || s > best.s || (s === best.s && m > best.m)) best = { p: full, m, s };
      }
    }
  };
  walk(dir);
  return best ? (best as { p: string }).p : null;
}

/** 统计文件的非空 JSON 行数（MediaCrawler 按日期把多次结果追加写同一文件） */
function countLines(file: string): number {
  try {
    return readFileSync(file, 'utf-8').split('\n').filter((l) => l.trim() !== '').length;
  } catch {
    return 0;
  }
}

function extractRecord(raw: Record<string, unknown>) {
  const title = (raw.title as string) || (raw.desc as string)?.slice(0, 60) || '';
  let url = (raw.note_url as string) || (raw.url as string) || (raw.video_url as string) || '';
  if (!url && raw.bvid) url = `https://www.bilibili.com/video/${raw.bvid}`;
  if (!url && raw.aid) url = `https://www.bilibili.com/video/av${raw.aid}`;
  if (!url && raw.note_id) url = `https://www.xiaohongshu.com/explore/${raw.note_id}`;
  const author =
    (raw.author as string) || (raw.nickname as string) || (raw as { user?: { nickname?: string } }).user?.nickname || '';
  const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
  const stats: Record<string, number> = {};
  const statMap: [string, string[]][] = [
    ['play', ['play', 'view_count', 'video_play_count']],
    ['like', ['like', 'liked_count', 'likes_count', 'digg_count']],
    ['danmaku', ['danmaku', 'video_danmaku', 'danmaku_count']],
    ['comment', ['comment', 'comment_count', 'video_comment', 'reply']],
    ['favorite', ['favorite', 'favorite_count', 'video_favorite_count']],
    ['share', ['share', 'share_count', 'video_share_count']],
    ['coin', ['coin', 'video_coin_count', 'coins']],
  ];
  for (const [k, keys] of statMap) {
    for (const key of keys) {
      const n = num(raw[key]);
      if (!Number.isNaN(n)) {
        stats[k] = n;
        break;
      }
    }
  }
  return { title, desc: (raw.desc as string) || (raw.description as string) || '', url, author, stats, raw };
}

export const domesticSocialCollector: Collector = {
  name: 'domestic-social',
  description: '国内社交平台采集（小红书/抖音/B站/微博/贴吧/知乎，基于 MediaCrawler 无头浏览器）',

  tools: [
    {
      tool: {
        name: 'social_search',
        description:
          '在指定国内社交平台搜索/采集内容（基于 MediaCrawler，需先登录该平台）。参数：platform（bilibili/xiaohongshu/douyin/weibo/tieba/zhihu），keyword，type（search 默认/creator），creator_ids（creator 类型用），get_comment，limit（默认10）。首次用某平台需先扫码登录。',
        inputSchema: {
          platform: z
            .enum(['bilibili', 'xiaohongshu', 'douyin', 'weibo', 'tieba', 'zhihu'])
            .describe('平台'),
          keyword: z.string().optional().describe('搜索关键词（search 类型必填）'),
          type: z.enum(['search', 'creator']).optional().describe('采集类型，默认 search'),
          creator_ids: z.string().optional().describe('博主 ID（creator 类型用，逗号分隔）'),
          get_comment: z.boolean().optional().describe('是否抓评论，默认 false'),
          limit: z.number().int().min(1).max(30).optional().describe('采集条数，默认 10'),
        },
      },
      handler: async (args) => {
        const platform = args.platform as string;
        const mc = PLATFORM_MAP[platform];
        if (!mc) return `不支持的平台: ${platform}`;
        const type = (args.type as string) || 'search';
        const keyword = (args.keyword as string) || '';
        const creatorIds = (args.creator_ids as string) || '';
        const getComment = !!args.get_comment;
        const limit = (args.limit as number) || 10;

        if (!existsSync(MEDIA_ROOT)) {
          return `未找到 MediaCrawler 目录: ${MEDIA_ROOT}（请确认已 clone 到 tools/mediacrawler）`;
        }
        const browserData = path.join(MEDIA_ROOT, 'browser_data', `${mc}_user_data_dir`, 'Default');
        const loggedIn = existsSync(browserData);
        if (!loggedIn) {
          return `平台 ${platform} 尚未登录（无 browser_data/${mc}_user_data_dir 登录态）。\n请先扫码登录：在仓库根运行\n  node scripts/social-login.mjs --platform ${platform}\n扫码成功后即可用本工具采集。`;
        }

        const cmd = [
          '--platform', mc,
          '--type', type,
          '--save_data_option', 'jsonl',
          '--lt', 'qrcode',
          '--headless', 'true',
          '--get_comment', String(getComment),
          '--get_sub_comment', 'false',
          '--get_media', 'false',
          '--crawler_max_notes_count', String(limit),
        ];
        if (type === 'search') {
          if (!keyword) return 'search 类型需要 keyword 参数。';
          cmd.push('--keywords', keyword);
        } else if (type === 'creator') {
          if (!creatorIds) return 'creator 类型需要 creator_ids 参数。';
          cmd.push('--creator_id', creatorIds);
        }

        const dataDir = path.join(MEDIA_ROOT, 'data', mc);
        const beforeFile = existsSync(dataDir) ? findLatestJsonl(dataDir) : null;
        const beforeCount = beforeFile ? countLines(beforeFile) : 0;
        let res: { code: number | null; out: string };
        try {
          res = await runMediaCrawler(cmd);
          // execjs 偶发"找不到 JS runtime"（首次进程竞争），重试一次
          if (res.out.includes('JavaScript runtime') || res.out.includes('RuntimeUnavailable')) {
            res = await runMediaCrawler(cmd);
          }
        } catch (e) {
          return `MediaCrawler 启动失败: ${e instanceof Error ? e.message : String(e)}`;
        }

        // MediaCrawler 把当天多次结果追加写入同一 {type}_contents_{date}.jsonl，
        // 因此只解析"本次运行新增的行"（运行前基线行数 -> 运行后）。
        const afterFile = existsSync(dataDir) ? findLatestJsonl(dataDir) : null;
        const latest = afterFile || beforeFile;
        const skip = afterFile && beforeFile && afterFile === beforeFile ? beforeCount : 0;
        let records: unknown[] = [];
        if (latest) {
          const lines = readFileSync(latest, 'utf-8').split('\n');
          let seen = 0;
          for (const ln of lines) {
            const t = ln.trim();
            if (!t) continue;
            if (seen < skip) {
              seen++;
              continue;
            }
            try {
              records.push(JSON.parse(t));
            } catch {
              /* skip */
            }
          }
        }
        const items = records.slice(0, limit).map((r) => extractRecord(r as Record<string, unknown>));
        const summary: {
          platform: string;
          type: string;
          keyword: string;
          count: number;
          source_file: string | null;
          records: unknown[];
          note?: string;
        } = {
          platform,
          type,
          keyword: type === 'search' ? keyword : creatorIds,
          count: items.length,
          source_file: latest || null,
          records: items,
        };
        if (res.code !== 0 && items.length === 0) {
          summary.note = `采集结束（退出码 ${res.code}），未解析到数据。日志尾部:\n${res.out.slice(-1500)}`;
        }
        return JSON.stringify(summary, null, 2);
      },
    },
  ],
};
