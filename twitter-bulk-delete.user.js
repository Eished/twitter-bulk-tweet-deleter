// ==UserScript==
// @name              X/Twitter 批量删除推文（含转贴、回复，自动跳过他人推文）
// @name:zh-CN        X/Twitter 批量删除推文（含转贴、回复，自动跳过他人推文）
// @name:zh-TW        X/Twitter 批次刪除推文（含轉貼、回覆，自動跳過他人推文）
// @name:en           X/Twitter Bulk Tweet Deleter (reposts, replies, auto-skip others)
// @name:ja           X/Twitter 一括ツイート削除（リポスト・リプライ対応、他人の投稿は自動スキップ）
// @name:ko           X/Twitter 트윗 일괄 삭제（리포스트·답글 지원, 타인 게시물 자동 건너뛰기）
// @namespace         https://github.com/Eished/twitter-bulk-tweet-deleter
// @version           1.0
// @description       自动批量删除你在 X(Twitter) 上的推文，支持转贴(撤销转帖)和回复。提供「模拟点击」和「内部API」两种删除模式；自动识别并跳过他人发布的内容；主页删完会自动跳转到回复页继续；遇到限流或卡住会自动等待并刷新页面续跑，真正清空后自动停止；内置防休眠功能防止浏览器节流。
// @description:zh-CN 自动批量删除你在 X(Twitter) 上的推文，支持转贴(撤销转帖)和回复。提供「模拟点击」和「内部API」两种删除模式；自动识别并跳过他人发布的内容；主页删完会自动跳转到回复页继续；遇到限流或卡住会自动等待并刷新页面续跑，真正清空后自动停止；内置防休眠功能防止浏览器节流。
// @description:zh-TW 自動批次刪除你在 X(Twitter) 上的推文，支援轉貼(撤銷轉帖)和回覆。提供「模擬點擊」與「內部API」兩種刪除模式；自動辨識並跳過他人發布的內容；主頁刪完會自動跳轉到回覆頁繼續；遇到限流或卡住會自動等待並重新整理頁面續跑，真正清空後自動停止；內建防休眠功能防止瀏覽器節流。
// @description:en    Automatically bulk-deletes your tweets on X/Twitter, including reposts (unretweet) and replies. Two modes: simulated clicks or internal API. Auto-detects and skips others' tweets. After clearing the main timeline it navigates to the Replies tab to continue. Auto-reloads on rate-limit/stuck and stops once truly empty. Built-in anti-sleep keeps the browser tab active.
// @description:ja    X(Twitter)上の自分のツイートを一括削除します。リポスト解除・リプライにも対応。「クリック」「内部API」の2モード搭載。他人の投稿は自動スキップ。タイムライン削除後は返信タブへ自動移動し、レート制限時は待機・自動リロードして再開、全て削除済みになると自動停止。タブのスリープを防ぐ機能付き。
// @description:ko    X(Twitter) 트윗을 자동으로 일괄 삭제합니다. 리포스트 취소·답글 지원. 클릭 시뮬레이션·내부 API 두 가지 모드 제공. 타인 게시물 자동 건너뜀. 타임라인 삭제 후 답글 탭으로 이동해 계속 진행하며, 속도 제한 시 자동 새로고침·재개, 삭제 완료 시 자동 정지. 탭 절전 방지 기능 내장.
// @author             Eished
// @supportURL         https://github.com/Eished/twitter-bulk-tweet-deleter/issues
// @homepage           https://github.com/Eished/twitter-bulk-tweet-deleter
// @match              https://twitter.com/*
// @match              https://x.com/*
// @run-at             document-idle
// @grant              none
// @license            MIT
// ==/UserScript==

(function () {
  'use strict';

  // ── i18n ──────────────────────────────────────────────────────────────────
  const I18N = {
    zh: {
      title: '批量删除推文',
      modeClick: '模拟点击',
      modeApi: 'API 模式',
      labelDeleted: '已删除',
      labelFailed: '失败',
      btnStart: '开始',
      btnStop: '停止',
      antiSleepOff: '💤 防休眠',
      antiSleepOn: '☕ 防休眠',
      hint: '主页删完自动转回复页 · 卡住/限流自动刷新 · 清空后自动停止',
      // 运行时消息
      msgStopped: '已停止',
      msgSkipped: '跳过非本人发的推文…',
      msgRateLimit: '被限流，60 秒后重试…',
      msgAutoResume: '页面已刷新，自动续跑中…',
      msgGoReplies: '主页已处理完，前往回复页继续…',
      msgWaiting: '等待中，避免频繁刷新…',
      msgStuck: s => `可能触发限流，${s} 秒后刷新页面…`,
      msgDone: '已无可删除内容，自动停止。可手动刷新页面确认。',
    },
    en: {
      title: 'Bulk Delete Tweets',
      modeClick: 'Click',
      modeApi: 'API',
      labelDeleted: 'Deleted',
      labelFailed: 'Failed',
      btnStart: 'Start',
      btnStop: 'Stop',
      antiSleepOff: '💤 Anti-sleep',
      antiSleepOn: '☕ Anti-sleep',
      hint: 'Auto-switches to Replies · Auto-reloads on rate-limit · Stops when clear',
      msgStopped: 'Stopped',
      msgSkipped: "Skipping others' tweets…",
      msgRateLimit: 'Rate limited, retrying in 60s…',
      msgAutoResume: 'Page reloaded, resuming…',
      msgGoReplies: 'Timeline clear, going to Replies tab…',
      msgWaiting: 'Waiting to avoid rapid reloads…',
      msgStuck: s => `Rate-limit likely, reloading in ${s}s…`,
      msgDone: 'Nothing left to delete, stopped. Reload to confirm.',
    },
  };

  // 根据浏览器语言自动选择默认语言，保存在 localStorage 以便页面刷新后复用
  const LANG_KEY = 'tm_bulk_delete_lang';
  let lang = localStorage.getItem(LANG_KEY) || ((navigator.language || '').startsWith('zh') ? 'zh' : 'en');

  function t(key, ...args) {
    const v = I18N[lang][key];
    return typeof v === 'function' ? v(...args) : (v ?? key);
  }
  function setLang(l) {
    lang = l;
    localStorage.setItem(LANG_KEY, l);
    updatePanelText();
  }

  // ── 配置 ──────────────────────────────────────────────────────────────────
  const CONFIG = {
    clickMinDelay: 2500,
    clickMaxDelay: 5000,
    apiMinDelay: 1500,
    apiMaxDelay: 3500,
    scrollDelay: 1500,
    // 连续滚动多少次还找不到推文时，触发卡住处理
    stuckThreshold: 8,
    // 卡住后等待多久再刷新（给限流一些恢复时间）
    refreshWaitMs: 60 * 1000,
    // 两次刷新的最短间隔，防止刷新风暴
    minReloadInterval: 45 * 1000,
    // 连续多少次刷新后仍无进展则判定为"真的删空了"
    maxReloadsWithoutProgress: 3,

    // X 前端内置的公开 Bearer Token（写在官方 JS 里，不是私钥）
    bearerToken:
      'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
    // 如果 API 模式失效：打开 F12→Network，手动删一条/撤销一条转帖，
    // 找对应请求（DeleteTweet / DeleteRetweet），把新的 queryId 填进来
    deleteTweetQueryId: 'VaenaVgh5q5ih7kvyVjgtg',
    deleteRetweetQueryId: 'iQtK4dl5hBmXewYZuEOKVw',
  };

  // ── 状态 ──────────────────────────────────────────────────────────────────
  const STORAGE_KEY = 'tm_bulk_delete_state_v3';
  let running = false;
  let deletedCount = 0;
  let failedCount = 0;
  let mode = 'click'; // 'click' | 'api'
  let stuckCounter = 0;
  let reloadsWithoutProgress = 0;
  let visitedReplies = false;
  let antiSleepEnabled = true;
  const skippedIds = new Set();

  // ── 防休眠（Web Audio API + Web Locks 双保险）─────────────────────────────
  let audioCtx = null;

  function startAntiSleep() {
    // 方案一：静音 AudioContext — 让浏览器认为页面在播放音频，不进行后台节流
    if (!audioCtx) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        gain.gain.value = 0.001; // 接近无声，但不为零（为零可能被优化掉）
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
      } catch (e) {
        audioCtx = null;
      }
    }
    // 方案二：Web Locks — 持有一把共享锁，通知浏览器此页面有待处理的任务
    if (navigator.locks) {
      navigator.locks
        .request(
          'tm_bulk_delete_keepalive',
          { mode: 'shared' },
          () => new Promise(() => {}), // 永远不 resolve，锁一直持有
        )
        .catch(() => {});
    }
    // 页面从后台切回前台时，恢复可能被系统暂停的 AudioContext
    document.addEventListener('visibilitychange', resumeAudioCtx);
  }

  function resumeAudioCtx() {
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  }

  function stopAntiSleep() {
    document.removeEventListener('visibilitychange', resumeAudioCtx);
    if (audioCtx) {
      audioCtx.close().catch(() => {});
      audioCtx = null;
    }
    // Web Locks 无法主动释放（页面关闭时自动释放），这是正常行为
  }

  function toggleAntiSleep() {
    antiSleepEnabled = !antiSleepEnabled;
    antiSleepEnabled ? startAntiSleep() : stopAntiSleep();
    updateAntiSleepButton();
  }

  function updateAntiSleepButton() {
    const btn = document.getElementById('tm-btn-antisleep');
    if (!btn) return;
    btn.textContent = antiSleepEnabled ? t('antiSleepOn') : t('antiSleepOff');
    btn.style.background = antiSleepEnabled ? '#00ba7c' : '#536471';
  }

  // ── 状态持久化（刷新后自动续跑）──────────────────────────────────────────
  function saveState() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          running,
          mode,
          deletedCount,
          failedCount,
          visitedReplies,
          reloadsWithoutProgress,
          antiSleepEnabled,
          lastReloadAt: Date.now(),
        }),
      );
    } catch (e) {}
  }
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }
  function getLastReloadAt() {
    const s = loadState();
    return s?.lastReloadAt ?? 0;
  }

  // ── 路径工具 ──────────────────────────────────────────────────────────────
  function getUsernameFromPath() {
    const segs = location.pathname.split('/').filter(Boolean);
    return segs.length ? segs[0] : null;
  }
  function isOnRepliesTab() {
    return /\/with_replies\/?$/.test(location.pathname);
  }
  function getRepliesUrl() {
    const u = getUsernameFromPath();
    return u ? `https://${location.hostname}/${u}/with_replies` : null;
  }

  // ── 工具 ──────────────────────────────────────────────────────────────────
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const randomDelay = (min, max) => min + Math.random() * (max - min);
  function getCookie(name) {
    const m = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
    return m ? decodeURIComponent(m[2]) : null;
  }

  // ── UI 面板 ───────────────────────────────────────────────────────────────
  const PANEL_ID = 'tm-del-panel';

  function createPanel() {
    if (document.getElementById(PANEL_ID)) return;

    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.style.cssText = `
      position:fixed; top:80px; right:20px; z-index:99999;
      background:#15202b; color:#fff; padding:14px 16px;
      border-radius:12px; font-family:sans-serif; font-size:14px;
      box-shadow:0 2px 12px rgba(0,0,0,.5); width:250px; user-select:none;
    `;
    panel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <span id="tm-title" style="font-weight:bold;font-size:15px;"></span>
        <div>
          <button id="tm-lang-zh" style="margin-left:4px;padding:2px 7px;border:1px solid #536471;border-radius:6px;background:transparent;color:#fff;cursor:pointer;font-size:12px;">中</button>
          <button id="tm-lang-en" style="margin-left:4px;padding:2px 7px;border:1px solid #536471;border-radius:6px;background:transparent;color:#fff;cursor:pointer;font-size:12px;">EN</button>
        </div>
      </div>
      <div style="margin-bottom:8px;display:flex;gap:8px;">
        <label><input type="radio" name="tm-mode" value="click"> <span id="tm-label-click"></span></label>
        <label><input type="radio" name="tm-mode" value="api">   <span id="tm-label-api"></span></label>
      </div>
      <div style="margin-bottom:8px;font-size:13px;">
        <span id="tm-label-deleted"></span>: <strong id="tm-count">0</strong>
        &nbsp;&nbsp;
        <span id="tm-label-failed"></span>: <strong id="tm-fail">0</strong>
      </div>
      <div id="tm-msg" style="min-height:14px;margin-bottom:8px;font-size:12px;color:#8b98a5;line-height:1.4;word-break:break-all;"></div>
      <button id="tm-btn-start" style="width:100%;margin-bottom:6px;padding:7px;border:none;border-radius:8px;background:#1d9bf0;color:#fff;cursor:pointer;font-size:14px;font-weight:bold;"></button>
      <button id="tm-btn-stop"  style="width:100%;margin-bottom:6px;padding:7px;border:none;border-radius:8px;background:#536471;color:#fff;cursor:pointer;font-size:14px;"></button>
      <button id="tm-btn-antisleep" style="width:100%;padding:6px;border:none;border-radius:8px;color:#fff;cursor:pointer;font-size:13px;"></button>
      <div id="tm-hint" style="margin-top:9px;font-size:11px;color:#536471;line-height:1.5;"></div>
    `;
    document.body.appendChild(panel);

    // 语言切换
    document.getElementById('tm-lang-zh').onclick = () => setLang('zh');
    document.getElementById('tm-lang-en').onclick = () => setLang('en');

    // 删除模式单选
    panel.querySelectorAll('input[name="tm-mode"]').forEach(r => {
      r.addEventListener('change', e => {
        mode = e.target.value;
        saveState();
      });
    });
    const modeRadio = panel.querySelector(`input[value="${mode}"]`);
    if (modeRadio) modeRadio.checked = true;

    // 开始 / 停止
    document.getElementById('tm-btn-start').onclick = () => {
      if (running) return;
      running = true;
      stuckCounter = 0;
      reloadsWithoutProgress = 0;
      visitedReplies = false;
      saveState();
      if (antiSleepEnabled) startAntiSleep();
      deleteLoop();
    };
    document.getElementById('tm-btn-stop').onclick = () => {
      running = false;
      saveState();
      setMsg(t('msgStopped'));
    };

    // 防休眠切换
    document.getElementById('tm-btn-antisleep').onclick = toggleAntiSleep;

    updatePanelText();
    updateStatus();
    updateAntiSleepButton();
  }

  // 更新面板上所有文本（切换语言时调用）
  function updatePanelText() {
    const $ = id => document.getElementById(id);
    const set = (id, txt) => {
      const el = $(id);
      if (el) el.textContent = txt;
    };
    set('tm-title', t('title'));
    set('tm-label-click', t('modeClick'));
    set('tm-label-api', t('modeApi'));
    set('tm-label-deleted', t('labelDeleted'));
    set('tm-label-failed', t('labelFailed'));
    set('tm-btn-start', t('btnStart'));
    set('tm-btn-stop', t('btnStop'));
    set('tm-hint', t('hint'));
    updateAntiSleepButton();
    // 高亮当前语言按钮
    ['zh', 'en'].forEach(l => {
      const btn = $(`tm-lang-${l}`);
      if (btn) btn.style.background = lang === l ? '#1d9bf0' : 'transparent';
    });
  }

  function updateStatus() {
    const c = document.getElementById('tm-count');
    const f = document.getElementById('tm-fail');
    if (c) c.textContent = deletedCount;
    if (f) f.textContent = failedCount;
  }
  function setMsg(text) {
    const el = document.getElementById('tm-msg');
    if (el) el.textContent = text;
  }

  // ── DOM 工具：识别推文卡片 ────────────────────────────────────────────────

  // 过滤掉引用推文里嵌套的 article（防止误操作他人内容）
  function isNestedTweet(el) {
    let p = el.parentElement;
    while (p) {
      if (p.matches?.('article[data-testid="tweet"]')) return true;
      p = p.parentElement;
    }
    return false;
  }
  function getTopLevelTweetArticles() {
    return [...document.querySelectorAll('article[data-testid="tweet"]')].filter(el => !isNestedTweet(el));
  }

  // 从卡片内的第一个 status 链接提取推文 ID
  function getTweetId(el) {
    const link = el.querySelector('a[href*="/status/"]');
    const m = link?.getAttribute('href').match(/\/status\/(\d+)/);
    return m?.[1] ?? null;
  }

  // socialContext 显示"你已转帖"/"你已转推"时，这条是转贴卡片
  function isRetweetCard(el) {
    const ctx = el.querySelector('[data-testid="socialContext"]');
    return /转推|转帖|repost|retweet/i.test(ctx?.textContent ?? '');
  }

  // 从头像容器 data-testid 里拿到卡片的真实作者用户名
  function getCardAuthorUsername(el) {
    const avatar = el.querySelector('[data-testid^="UserAvatar-Container-"]');
    return avatar?.getAttribute('data-testid')?.replace('UserAvatar-Container-', '') ?? null;
  }
  function isOwnAuthoredTweet(el) {
    const own = getUsernameFromPath();
    if (!own) return true; // 拿不到路径时保守处理，不漏删
    const author = getCardAuthorUsername(el);
    if (!author) return true;
    return author.toLowerCase() === own.toLowerCase();
  }

  // 返回第一条未被跳过的顶层卡片
  function getFirstTopLevelTweet() {
    for (const el of getTopLevelTweetArticles()) {
      const id = getTweetId(el);
      if (id && skippedIds.has(id)) continue;
      return el;
    }
    return null;
  }

  // ── 模式一：模拟点击 ──────────────────────────────────────────────────────

  async function clickMoreButton(tweet) {
    const btn = tweet.querySelector('button[data-testid="caret"]');
    if (!btn) return false;
    btn.click();
    await sleep(600);
    return true;
  }

  async function clickDeleteMenuItem() {
    for (const item of document.querySelectorAll('div[role="menuitem"]')) {
      if (/删除|^delete$/i.test(item.textContent?.trim() ?? '')) {
        item.click();
        await sleep(600);
        return true;
      }
    }
    return false;
  }

  // 转贴的入口是工具栏上那个变绿的转帖按钮（data-testid="unretweet"）
  async function clickUnretweetButton(tweet) {
    const btn = tweet.querySelector('[data-testid="unretweet"]');
    if (!btn) return false;
    btn.click();
    await sleep(600);
    return true;
  }

  // 菜单文案多端不一致，全部覆盖（撤销/取消 × 转帖/转贴/转推 + 英文）
  const UNDO_RE = /撤销转(帖|贴|推)|取消转(帖|贴|推)|undo\s*repost|undo\s*retweet|^unretweet$/i;
  async function clickUndoRepostMenuItem() {
    for (const item of document.querySelectorAll('div[role="menuitem"]')) {
      if (UNDO_RE.test(item.textContent ?? '')) {
        item.click();
        await sleep(600);
        return true;
      }
    }
    return false;
  }

  // 确认弹窗（删除推文 or 撤销转帖，前者必须确认，后者不一定有弹窗）
  async function clickConfirm() {
    for (const sel of ['[data-testid="confirmationSheetConfirm"]', '[data-testid="unretweetConfirm"]']) {
      const btn = document.querySelector(sel);
      if (btn) {
        btn.click();
        await sleep(800);
        return true;
      }
    }
    return false;
  }

  async function deleteOneByClick() {
    const tweet = getFirstTopLevelTweet();
    if (!tweet) return 'no-tweet';

    // ── 转贴：点击绿色转帖按钮 → 撤销菜单 ──
    if (isRetweetCard(tweet)) {
      if (!(await clickUnretweetButton(tweet))) return 'no-unretweet-button';
      if (!(await clickUndoRepostMenuItem())) {
        // 极少数情况下点击直接生效不弹菜单
        await sleep(400);
        if (!tweet.querySelector('[data-testid="unretweet"]')) return 'deleted';
        document.body.click();
        return 'no-undo-option';
      }
      await clickConfirm();
      return 'deleted';
    }

    // ── 非本人发的推文（回复页里别人的内容）跳过 ──
    if (!isOwnAuthoredTweet(tweet)) {
      const id = getTweetId(tweet);
      if (id) skippedIds.add(id);
      return 'skipped-not-own';
    }

    // ── 普通推文：更多菜单 → 删除 ──
    if (!(await clickMoreButton(tweet))) return 'no-menu-button';
    if (!(await clickDeleteMenuItem())) {
      document.body.click();
      return 'no-delete-option';
    }
    if (!(await clickConfirm())) return 'no-confirm';
    return 'deleted';
  }

  // ── 模式二：内部 API ──────────────────────────────────────────────────────

  // 收集页面上所有可处理的推文（已跳过 / 非本人的都排除掉）
  function getTweetTargetsOnScreen() {
    const targets = [],
      seen = new Set();
    for (const el of getTopLevelTweetArticles()) {
      const id = getTweetId(el);
      if (!id || seen.has(id) || skippedIds.has(id)) continue;
      seen.add(id);
      const retweet = isRetweetCard(el);
      if (!retweet && !isOwnAuthoredTweet(el)) {
        skippedIds.add(id);
        continue;
      }
      targets.push({ id, isRetweet: retweet });
    }
    return targets;
  }

  async function callGraphQL(queryId, mutationName, variables) {
    const ct0 = getCookie('ct0');
    if (!ct0) return { status: 'no-csrf-token' };
    const res = await fetch(`https://x.com/i/api/graphql/${queryId}/${mutationName}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${CONFIG.bearerToken}`,
        'x-csrf-token': ct0,
        'x-twitter-active-user': 'yes',
        'x-twitter-auth-type': 'OAuth2Session',
      },
      body: JSON.stringify({ variables, queryId }),
    });
    if (res.status === 429) return { status: 'rate-limited' };
    if (!res.ok) return { status: `http-${res.status}` };
    const json = await res.json().catch(() => null);
    if (json?.errors?.length) {
      console.warn('[TweetDeleter] API error:', json.errors);
      return { status: 'api-error' };
    }
    return { status: 'deleted' };
  }

  const deleteTweetByApi = id =>
    callGraphQL(CONFIG.deleteTweetQueryId, 'DeleteTweet', { tweet_id: id, dark_request: false });
  const undoRetweetByApi = id =>
    callGraphQL(CONFIG.deleteRetweetQueryId, 'DeleteRetweet', { source_tweet_id: id, dark_request: false });

  function removeCardFromDom(tweetId) {
    document.querySelectorAll(`article[data-testid="tweet"] a[href*="/status/${tweetId}"]`).forEach(a => {
      const article = a.closest('article[data-testid="tweet"]');
      if (article && !isNestedTweet(article)) article.remove();
    });
  }

  // ── 卡住处理 ──────────────────────────────────────────────────────────────

  async function handleStuckAndMaybeReload() {
    stuckCounter++;

    // 还没到阈值：往下滚，继续等
    if (stuckCounter < CONFIG.stuckThreshold) {
      window.scrollBy(0, 800);
      await sleep(CONFIG.scrollDelay);
      return;
    }

    // 主页已处理完，还没去过回复页 → 跳转过去
    if (!isOnRepliesTab() && !visitedReplies) {
      const repliesUrl = getRepliesUrl();
      if (repliesUrl) {
        visitedReplies = true;
        stuckCounter = 0;
        reloadsWithoutProgress = 0;
        setMsg(t('msgGoReplies'));
        saveState();
        await sleep(1500);
        if (running) location.href = repliesUrl;
        return;
      }
    }

    // 防止刷新风暴
    const since = Date.now() - getLastReloadAt();
    if (since < CONFIG.minReloadInterval) {
      setMsg(t('msgWaiting'));
      await sleep(CONFIG.minReloadInterval - since);
    }

    // 连续多次刷新后依然没有进展 → 认为真的删空了
    reloadsWithoutProgress++;
    if (reloadsWithoutProgress > CONFIG.maxReloadsWithoutProgress) {
      running = false;
      saveState();
      setMsg(t('msgDone'));
      return;
    }

    setMsg(t('msgStuck', Math.round(CONFIG.refreshWaitMs / 1000)));
    saveState(); // running 仍为 true，刷新后自动续跑
    await sleep(CONFIG.refreshWaitMs);
    if (running) location.reload();
  }

  // ── 主循环 ────────────────────────────────────────────────────────────────

  async function deleteLoop() {
    while (running) {
      if (mode === 'click') {
        const result = await deleteOneByClick();
        if (result === 'deleted') {
          deletedCount++;
          stuckCounter = 0;
          reloadsWithoutProgress = 0;
          setMsg('');
          updateStatus();
          saveState();
          await sleep(randomDelay(CONFIG.clickMinDelay, CONFIG.clickMaxDelay));
        } else if (result === 'no-tweet') {
          await handleStuckAndMaybeReload();
        } else if (result === 'skipped-not-own') {
          setMsg(t('msgSkipped'));
          await sleep(300);
        } else {
          // 其它失败：记录日志，稍等后继续（不触发卡住逻辑）
          failedCount++;
          updateStatus();
          console.warn('[TweetDeleter] click mode failed:', result);
          await sleep(2000);
        }
      } else {
        const targets = getTweetTargetsOnScreen();
        if (targets.length === 0) {
          await handleStuckAndMaybeReload();
          continue;
        }
        const { id, isRetweet } = targets[0];
        const { status } = isRetweet ? await undoRetweetByApi(id) : await deleteTweetByApi(id);
        if (status === 'deleted') {
          deletedCount++;
          stuckCounter = 0;
          reloadsWithoutProgress = 0;
          setMsg('');
          updateStatus();
          saveState();
          removeCardFromDom(id);
          await sleep(randomDelay(CONFIG.apiMinDelay, CONFIG.apiMaxDelay));
        } else if (status === 'rate-limited') {
          setMsg(t('msgRateLimit'));
          await sleep(60000);
        } else {
          failedCount++;
          updateStatus();
          console.warn('[TweetDeleter] API mode failed:', status, 'id:', id, 'isRetweet:', isRetweet);
          await sleep(3000);
        }
      }
    }
  }

  // ── 启动 ──────────────────────────────────────────────────────────────────

  window.addEventListener('load', () => {
    setTimeout(() => {
      // 恢复上次状态
      const saved = loadState();
      if (saved) {
        mode = saved.mode ?? mode;
        deletedCount = saved.deletedCount ?? 0;
        failedCount = saved.failedCount ?? 0;
        visitedReplies = !!saved.visitedReplies;
        reloadsWithoutProgress = saved.reloadsWithoutProgress ?? 0;
        antiSleepEnabled = saved.antiSleepEnabled ?? true;
      }

      createPanel();

      // 初始化防休眠
      if (antiSleepEnabled) startAntiSleep();

      // 如果刷新前在运行，自动续跑
      if (saved?.running) {
        running = true;
        stuckCounter = 0;
        setMsg(t('msgAutoResume'));
        setTimeout(() => deleteLoop(), 3000); // 等页面渲染完再继续
      }
    }, 1500);
  });
})();
