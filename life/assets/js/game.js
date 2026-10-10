// ============================================================
// 上班魂 · 游戏引擎 + UI（零依赖 · 纯静态）
// 核心循环：roll 出身 → 推进人生（七系统）→ 60 岁退休 / 猝死 → 结算
// ============================================================
(function () {
  'use strict';
  const SHB = window.SHB;
  const C = SHB.const;

  // ---------------- 可复刻随机（mulberry32） ----------------
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  let rng = mulberry32((Date.now() ^ 0x9e3779b9) >>> 0);

  // ---------------- 状态 ----------------
  let state = null;
  let lastSeed = null;
  let autoTimer = null;
  let toastTimer = null;
  let _cancelTick = false;
  let modalToken = 0;
  let mewOpen = false;
  const mewQueue = [];

  // ---------------- 小工具 ----------------
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const fmt = n => Math.round(n).toLocaleString('zh-CN');
  const $ = sel => document.querySelector(sel);
  const pick = arr => arr[Math.floor(rng() * arr.length)];
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---------------- engine 公开（供 config 事件回调使用） ----------------
  SHB.engine = {};
  SHB.engine.markCancel = () => { _cancelTick = true; };
  SHB.engine.earnSalary = (s, amount) => {
    amount = Math.max(0, Math.round(amount));
    s.resources.salary += amount;
    s.stats.totalSalaryEarned += amount;
    return amount;
  };
  SHB.engine.deductSalary = (s, amount) => {
    amount = Math.max(0, Math.round(amount));
    if (s.buffs.shirk) { amount = Math.round(amount / 2); s.buffs.shirk = false; }
    s.resources.salary = Math.max(0, s.resources.salary - amount);
    return amount;
  };
  SHB.engine.marketShock = (s, factor) => {
    const m = s.systems.market;
    if (m.current) {
      m.current.price = Math.round(m.current.price * (1 + factor));
      m.history.push(m.current.price);
    }
    m.inventory.forEach(g => { g.price = Math.round(g.price * (1 + factor)); });
  };

  // ---------------- 初始状态 ----------------
  function freshState() {
    return {
      version: 1,
      seed: (Date.now() ^ 0x9e3779b9) >>> 0,
      age: C.AGE_START,
      _ticksToAge: 0,
      trait: null,
      ended: false,
      endType: 'none',      // none | retire | death | natural
      retired: false,
      atRetireCheckpoint: false,
      deathReason: '',
      resources: {
        lifespan: C.LIFESPAN_INIT,
        lifespanMax: C.LIFESPAN_INIT,
        salary: 0,
        catFood: 0,
        furball: 0,
        knowledge: 0,
      },
      activeSystem: 'qiju',
      buffs: { massage: 0, massageCooldown: 0, kpi: 0, cake: false, coffee: 0, bossAway: 0, shirk: false },
      systems: {
        qiju: { unlocked: true, doubleUnlocked: false },
        doujiao: { unlocked: false, planLevel: 0, searchUnlocked: false, multimodalUnlocked: false },
        moyu: { unlocked: true, fishCount: 1, fishRarity: 0 },
        cat: { unlocked: false, weight: 0, autoFeederUnlocked: false, autoFeederEnabled: false, furballRate: 3, dietUnlocked: false, fedCount: 0 },
        mecha: { unlocked: false, delayed: false, soulAbsorbed: 0, flagUpgrade: false, purifyUpgrade: false },
        market: { unlocked: false, slots: 3, slotsMax: 3, inventory: [], current: null, history: [], autoEnabled: false, _seq: 0 },
        massage: { unlocked: false, skillLevel: 0, masterUnlocked: false, fractureCount: 0 },
      },
      stats: {
        totalTicks: 0, totalMessages: 0, totalSalaryEarned: 0, totalLifespanSpent: 0, totalCatFoodGained: 0,
        deaths: 0, rebirths: 0, deathReasons: [],
        finalAge: 0, finalScore: 0, finalLTV: 0,
      },
      flags: { mewTriggered: [], checkupDone: false },
      settings: { tickIntervalMs: 1000, darkMode: 'auto' },
      log: [],
    };
  }

  function addLog(s, type, text, good) {
    s.log.push({ t: type, text, good: !!good, age: s.age });
    if (s.log.length > C.LOG_CAP) s.log.shift();
  }

  function applyTrait(s, trait) {
    s.trait = trait;
    if (trait.startSalary) s.resources.salary += trait.startSalary;
    if (trait.lifespanBonus) { s.resources.lifespan += trait.lifespanBonus; s.resources.lifespanMax += trait.lifespanBonus; }
    addLog(s, 'milestone', '🎲 出生词条：' + trait.name + ' — ' + trait.desc, true);
  }

  // ---------------- 系统数值 ----------------
  function systemBaseCost(sys) {
    switch (sys) {
      case 'qiju': return Math.max(0.5, 1 - 0.05 * state.systems.doujiao.planLevel);
      case 'doujiao': return 2;
      case 'moyu': return 1;
      case 'cat': return 1;
      case 'mecha': return 3;
      case 'market': return 2;
      case 'massage': return 5;
      default: return 1;
    }
  }
  function effectiveCost(s, base) {
    let cost = base;
    if (s.buffs.massage > 0 && !(s.trait && s.trait.noWellness)) {
      const reduce = 0.3 + s.systems.massage.skillLevel * 0.1;
      cost = cost * (1 - reduce);
    }
    if (s.buffs.coffee > 0) cost += 0.5;
    cost = Math.round(cost * 10) / 10;
    return Math.max(0.5, cost);
  }
  function qijuSalary(s) {
    let E = 1;
    if (s.buffs.kpi > 0) E *= 1.5;
    if (s.buffs.coffee > 0) E *= 1.2;
    if (s.trait && s.trait.workMult) E *= s.trait.workMult;
    if (s.buffs.cake) E *= 3;
    const plan = s.systems.doujiao.planLevel;
    let W = Math.round((5 + 0.5 * s.resources.knowledge) * (1 + 0.05 * plan) * E);
    if (s.systems.qiju.doubleUnlocked && rng() < 0.1) W *= 2;
    return W;
  }

  // ---------------- 系统效果 ----------------
  function pickMessage(s) {
    const plan = s.systems.doujiao.planLevel;
    const r = rng();
    if (plan >= 5 && r < 0.25) return pick(SHB.messages.report);
    if (plan >= 2 && r < 0.12) return pick(SHB.messages.night);
    return pick(SHB.messages.qiju);
  }
  function applyQiju(s) {
    const W = qijuSalary(s);
    SHB.engine.earnSalary(s, W);
    s.stats.totalMessages++;
    if (s.buffs.cake) s.buffs.cake = false;
    const suffix = s.systems.mecha.unlocked ? ' 喵' : '';
    addLog(s, 'qiju', pickMessage(s) + suffix, true);
  }
  function applyDoujiao(s) {
    const d = s.systems.doujiao;
    let p = C.STUDY_BASE;
    if (d.searchUnlocked) p += 0.15;
    if (s.trait && s.trait.studyBonus) p += s.trait.studyBonus;
    p = clamp(p, 0, C.STUDY_CAP);
    if (rng() < p) {
      let gain = 1;
      if (d.multimodalUnlocked && rng() < 0.1) gain = 2;
      s.resources.knowledge += gain;
      addLog(s, 'doujiao', '📚 ' + pick(SHB.messages.doujiao) + '（知识 +' + gain + '）', true);
    } else {
      addLog(s, 'doujiao', '💥 ' + pick(SHB.messages.doujiao) + '（乱码，无产出）', false);
    }
  }
  function applyMoyu(s) {
    const rarity = SHB.fishRarities[s.systems.moyu.fishRarity];
    let food = rarity.food;
    if (s.trait && s.trait.moyuMult) food *= s.trait.moyuMult;
    if (s.buffs.coffee > 0) food = Math.round(food * 1.2);
    food = Math.max(1, Math.round(food));
    s.resources.catFood += food;
    s.stats.totalCatFoodGained += food;
    let caught = rarity.caught;
    if (s.buffs.bossAway > 0) caught *= 0.2;
    if (s.trait && s.trait.moyuCaughtMult) caught *= s.trait.moyuCaughtMult;
    if (rng() < caught) {
      const fine = Math.max(10, 10 * (rarity.food + 1));
      SHB.engine.deductSalary(s, fine);
      addLog(s, 'event', '🚨 摸鱼被抓！扣工资 ' + fine, false);
    } else {
      addLog(s, 'moyu', '🐟 摸到 ' + rarity.name + '，猫粮 +' + food, true);
    }
  }
  function applyFeedCat(s) {
    s.resources.catFood -= 1;
    const gain = s.systems.cat.dietUnlocked ? 3 : 2;
    s.systems.cat.weight = Math.min(C.CAT_WEIGHT_MAX, s.systems.cat.weight + gain);
    s.systems.cat.fedCount++;
    const F = Math.round(1 + s.systems.cat.weight / 10);
    s.resources.furball += F;
    addLog(s, 'cat', '🍚 喂食，猫体重 +' + gain + '，猫球 +' + F, true);
    checkMewEvents(s);
  }
  function applyMecha(s) {
    const res = rollWanHun(s);
    const before = s.resources.lifespan;
    res.fx(s);
    s.resources.lifespan = clamp(s.resources.lifespan, 0, s.resources.lifespanMax);
    const delta = s.resources.lifespan - before;
    s.systems.mecha.soulAbsorbed += Math.max(0, Math.round(delta));
    addLog(s, 'mecha', '⚙️ 万魂幡 · ' + res.name + '（寿元 ' + (delta >= 0 ? '+' : '') + Math.round(delta) + '）', delta >= 0);
    addLog(s, 'mecha', '😾 喵星人抓捕 ' + pick(SHB.messages.names) + ' 成功，全员说话加「喵」', true);
  }
  function rollWanHun(s) {
    const m = s.systems.mecha;
    const weight = {
      za: 0.40 + (m.flagUpgrade ? 0.01 : 0) - (m.purifyUpgrade ? 0.04 : 0),
      xiao: 0.30,
      da: 0.20,
      bainian: 0.08 + (m.purifyUpgrade ? 0.04 : 0),
      po: 0.02 - (m.flagUpgrade ? 0.01 : 0),
    };
    const entries = SHB.wanHun.map(w => ({ w, weight: weight[w.key] }));
    const total = entries.reduce((a, e) => a + e.weight, 0);
    let r = rng() * total;
    for (const e of entries) { r -= e.weight; if (r <= 0) return e.w; }
    return entries[0].w;
  }

  // ---------------- 谷市 ----------------
  function newAuction(s) {
    const m = s.systems.market;
    const v = pick(SHB.marketVarieties);
    m._seq = (m._seq || 0) + 1;
    return { id: 'g' + m._seq, name: v.name, variety: v.id, base: v.base, price: v.base, vol: v.vol, cap: v.cap };
  }
  function ensureAuction(s) { if (!s.systems.market.current) s.systems.market.current = newAuction(s); }
  function applyMarketTick(s) {
    ensureAuction(s);
    const c = s.systems.market.current;
    const delta = (rng() * 2 - 1) * c.vol;
    let np = Math.round(c.price * (1 + delta));
    np = clamp(np, Math.round(c.base * 0.3), Math.round(c.base * c.cap));
    c.price = np;
    s.systems.market.history.push(np);
    if (s.systems.market.history.length > 40) s.systems.market.history.shift();
    addLog(s, 'market', '📈 ' + c.name + ' 现价 ¥' + np, delta >= 0);
  }
  function applyMarketRefresh(s) {
    s.systems.market.current = newAuction(s);
    s.systems.market.history = [];
    const c = s.systems.market.current;
    c.price = Math.round(c.base * (0.8 + rng() * 0.4));
    addLog(s, 'market', '🔁 换了一个拍卖品：' + c.name + ' 现价 ¥' + c.price, true);
  }
  function marketBuy(s) {
    ensureAuction(s);
    const m = s.systems.market;
    const c = m.current;
    if (m.inventory.length >= m.slots) { toast('包裹栏已满'); return; }
    if (s.resources.salary < c.price) { toast('工资不够'); return; }
    s.resources.salary -= c.price;
    m.inventory.push(Object.assign({}, c, { buyPrice: c.price }));
    addLog(s, 'market', '🛒 买入 ' + c.name + ' @¥' + c.price, true);
    m.current = newAuction(s);
  }
  function marketSell(s, index) {
    const m = s.systems.market;
    const g = m.inventory[index];
    if (!g) return;
    const profit = g.price - g.buyPrice;
    SHB.engine.earnSalary(s, g.price);
    m.inventory.splice(index, 1);
    addLog(s, 'market', '💰 卖出 ' + g.name + ' @¥' + g.price + (profit >= 0 ? '（赚 ' + profit + '）' : '（亏 ' + (-profit) + '）'), profit >= 0);
    ensureAuction(s);
  }

  // ---------------- 推拿 ----------------
  function startMassage(s) {
    const m = s.systems.massage;
    if (s.resources.lifespan < 5) { toast('寿元不足，无法推拿'); return; }
    if (s.buffs.massage > 0) { toast('推拿进行中'); return; }
    if (s.buffs.massageCooldown > 0) {
      let frac = 0.40 + s.buffs.massageCooldown * 0.02;
      if (m.masterUnlocked) frac -= 0.15;
      frac = clamp(frac, 0, 0.95);
      if (rng() < frac) {
        s.resources.lifespan = Math.max(0, s.resources.lifespan - 20);
        m.fractureCount++;
        s.buffs.massage = 0;
        s.buffs.massageCooldown = 30;
        addLog(s, 'event', '🦴 推拿骨折！寿元 -20，强制冷却 30 tick', false);
        return;
      }
    }
    s.resources.lifespan -= 5;
    s.buffs.massage = C.MASSAGE_DURATION;
    s.buffs.massageCooldown = C.MASSAGE_COOLDOWN;
    const reduce = Math.round((0.3 + m.skillLevel * 0.1) * 100);
    addLog(s, 'event', '💆 开始推拿，接下来 ' + C.MASSAGE_DURATION + ' tick 所有消耗 -' + reduce + '%', true);
  }

  // ---------------- 喵星人事件 ----------------
  function checkMewEvents(s) {
    // 延迟解锁兜底
    if (s.systems.mecha.delayed && !s.systems.mecha.unlocked && s.systems.cat.weight >= 60) {
      s.systems.mecha.unlocked = true;
      addLog(s, 'milestone', '🎉 机械飞升解锁（猫猫的意志无法阻挡）', true);
    }
    SHB.mewEvents.forEach(ev => {
      if (s.systems.cat.weight >= ev.at && s.flags.mewTriggered.indexOf(ev.at) === -1) {
        s.flags.mewTriggered.push(ev.at);
        showMewModal(ev);
      }
    });
  }

  // ---------------- buffs 递减 ----------------
  function decrementBuffs(s) {
    if (s.buffs.massage > 0) { s.buffs.massage--; }
    else if (s.buffs.massageCooldown > 0) { s.buffs.massageCooldown--; }
    if (s.buffs.kpi > 0) s.buffs.kpi--;
    if (s.buffs.coffee > 0) s.buffs.coffee--;
    if (s.buffs.bossAway > 0) s.buffs.bossAway--;
  }

  // ---------------- 年龄推进 ----------------
  function advanceAge(s) {
    s._ticksToAge = (s._ticksToAge || 0) + 1;
    if (s._ticksToAge >= C.TICKS_PER_YEAR) {
      s._ticksToAge = 0;
      s.age += 1;
      addLog(s, 'milestone', '🎂 ' + s.age + ' 岁了', true);
    }
  }

  // ---------------- 随机事件 ----------------
  function rollEvent(s) {
    if (s.resources.lifespan < 20 && s.resources.lifespan > 0 && rng() < 0.08) {
      addLog(s, 'event', '⚠️ 猝死警告：你离毕业只差一次加班', false);
      return;
    }
    if (rng() >= C.EVENT_CHANCE) return;
    const pool = [];
    for (const ev of SHB.events) {
      if (ev.cond && !ev.cond(s)) continue;
      if (ev.once && s.flags[ev.flagKey]) continue;
      if (s.trait && s.trait.noWellness && ev.wellness) continue;
      if (s.trait && s.trait.noLayoff && ev.layoff) continue;
      let w = 1;
      if (ev.kind === 'good') w *= (s.trait && s.trait.goodMult) || 1;
      if (ev.kind === 'bad') w *= (s.trait && s.trait.badMult) || 1;
      if (ev.id === 'milktea' && s.resources.lifespan < 70) w *= 2;
      for (let i = 0; i < Math.round(w * 10); i++) pool.push(ev);
    }
    if (pool.length === 0) return;
    const ev = pick(pool);
    if (ev.id === 'cake') _cancelTick = true;
    ev.fx(s, rng);
    if (ev.once) s.flags[ev.flagKey] = true;
    addLog(s, 'event', '【' + ev.name + '】' + ev.text, ev.kind === 'good');
    showEventModal(ev);
  }

  // ---------------- 解锁检查 ----------------
  function checkUnlocks(s) {
    for (const ms of SHB.milestones) {
      if (ms.unlocked) continue;
      if (ms.system === 'mecha') continue; // 机械飞升由喵星人事件解锁
      const sys = s.systems[ms.system];
      if (sys && !sys.unlocked && ms.cond(s)) {
        sys.unlocked = true;
        addLog(s, 'milestone', '🎉 新系统解锁：' + SHB.systemById[ms.system].name, true);
        toast('🎉 解锁 ' + SHB.systemById[ms.system].name);
      }
    }
  }

  // ---------------- 核心 tick ----------------
  function tick(fromAuto) {
    if (!state || state.ended || state.atRetireCheckpoint) return;
    const s = state;
    if (s.retired) { elderTick(s); return; }

    const sys = s.activeSystem;
    if (sys === 'settings') return;
    if (sys === 'massage') return; // 推拿由按钮手动触发
    if (sys === 'cat') {
      if (fromAuto && !s.systems.cat.autoFeederEnabled) return; // 自动喂需喂猫器
      if (s.resources.catFood < 1) { if (!fromAuto) toast('猫粮不足，先去摸鱼'); return; }
    }
    if (sys === 'market') ensureAuction(s);

    _cancelTick = false;
    // 消耗寿元
    const base = systemBaseCost(sys);
    const cost = effectiveCost(s, base);
    const before = s.resources.lifespan;
    const spend = Math.min(cost, before);
    s.resources.lifespan = before - spend;
    s.stats.totalLifespanSpent += spend;

    // 时间推进
    advanceAge(s);
    s.stats.totalTicks++;
    decrementBuffs(s);

    // 随机事件
    rollEvent(s);

    // 系统效果（被画饼/需求变更 会取消）
    if (!_cancelTick) {
      switch (sys) {
        case 'qiju': applyQiju(s); break;
        case 'doujiao': applyDoujiao(s); break;
        case 'moyu': applyMoyu(s); break;
        case 'cat': applyFeedCat(s); break;
        case 'mecha': applyMecha(s); break;
        case 'market': applyMarketTick(s); break;
      }
    }

    checkUnlocks(s);
    checkEnd(s);
    save();
    render();
  }

  // ---------------- 晚年（60 岁后继续） ----------------
  function elderTick(s) {
    if (s.ended) return;
    s.resources.lifespan -= 1;
    s.stats.totalLifespanSpent += 1;
    const pension = Math.max(0, Math.round(s.resources.salary * 0.02));
    SHB.engine.earnSalary(s, pension);
    advanceAge(s);
    s.stats.totalTicks++;
    decrementBuffs(s);
    _cancelTick = false;
    rollEvent(s);
    if (s.resources.lifespan <= 0) {
      s.resources.lifespan = 0;
      endGame(s, 'natural', '寿终正寝');
      return;
    }
    save();
    render();
  }

  // ---------------- 结束判定 ----------------
  function checkEnd(s) {
    if (s.ended) return;
    if (s.resources.lifespan <= 0) {
      s.resources.lifespan = 0;
      if (s.retired) endGame(s, 'natural', '寿终正寝');
      else endGame(s, 'death', '猝死');
      return;
    }
    if (!s.retired && s.age >= C.AGE_RETIRE) {
      stopAuto();
      s.atRetireCheckpoint = true;
      save();
      renderRetire();
      showScreen('retire');
    }
  }

  // ---------------- 结算 ----------------
  function computeScore(s) {
    const ageScore = clamp((s.age / 90) * 100, 0, 100);
    const ltvScore = clamp((s.stats.totalSalaryEarned / 300000) * 100, 0, 100);
    const knowScore = clamp((s.resources.knowledge / 50) * 100, 0, 100);
    const healthScore = s.resources.lifespanMax > 0 ? clamp((s.resources.lifespan / s.resources.lifespanMax) * 100, 0, 100) : 0;
    let total = ageScore * 0.30 + ltvScore * 0.35 + knowScore * 0.20 + healthScore * 0.15;
    if (s.endType === 'death' || s.deathReason === '猝死') total *= 0.7;
    return Math.round(total);
  }
  function grade(score) {
    if (score >= 90) return { g: 'S', label: '人生赢家', color: '#d4a017' };
    if (score >= 80) return { g: 'A', label: '相当精彩', color: '#3b8fd4' };
    if (score >= 70) return { g: 'B', label: '中上水平', color: '#2e8b57' };
    if (score >= 60) return { g: 'C', label: '平凡而完整', color: '#8a8a92' };
    if (score >= 40) return { g: 'D', label: '有点遗憾', color: '#d46a9a' };
    return { g: 'E', label: '重开吧朋友', color: '#d9482f' };
  }
  function endGame(s, type, reason) {
    s.ended = true;
    s.endType = type;
    s.deathReason = reason;
    const score = computeScore(s);
    s.stats.finalAge = s.age;
    s.stats.finalScore = score;
    s.stats.finalLTV = s.stats.totalSalaryEarned;
    if (type === 'death' || type === 'natural') {
      s.stats.deaths++;
      s.stats.deathReasons.push(reason + '（享年 ' + s.age + '）');
    }
    save();
    stopAuto();
    renderEnd();
    showScreen('end');
  }

  // ---------------- 升级 ----------------
  function upgradeInfo(sp, s) {
    if (sp.cond && !sp.cond(s)) return null;
    const val = sp.get ? sp.get(s) : null;
    if (sp.once) { if (val) return { done: true }; }
    else if (sp.max != null) { if (val >= sp.max) return { done: true }; }
    const cost = sp.costFor ? sp.costFor(s) : sp.cost;
    if (cost == null) return null;
    return { spec: sp, cost, done: false };
  }
  function buyUpgrade(id) {
    const s = state;
    const sp = SHB.upgradeSpecs.find(x => x.id === id && x.system === s.activeSystem);
    if (!sp) return;
    const info = upgradeInfo(sp, s);
    if (!info || info.done) return;
    if (s.resources.salary < info.cost) { toast('工资不够'); return; }
    s.resources.salary -= info.cost;
    sp.apply(s);
    addLog(s, 'event', '🛠️ 升级：' + sp.name, true);
    save();
    render();
  }
  function sellFurball() {
    const s = state;
    if (s.resources.furball <= 0) { toast('没有猫球可卖'); return; }
    const rate = s.systems.cat.furballRate;
    const earned = s.resources.furball * rate;
    SHB.engine.earnSalary(s, earned);
    addLog(s, 'cat', '💰 卖出 ' + s.resources.furball + ' 猫球，+ ' + earned + ' 工资', true);
    s.resources.furball = 0;
    save();
    render();
  }

  // ---------------- 开局 roll ----------------
  function startNewGame() {
    state = freshState();
    rng = mulberry32(state.seed);
    rollCandidates();
  }
  function startRebirth() {
    state = freshState();
    if (lastSeed != null && lastSeed !== undefined) state.seed = lastSeed;
    rng = mulberry32(state.seed);
    rollCandidates();
  }
  function rollCandidates() {
    const seen = new Set();
    const cands = [];
    while (cands.length < 3) {
      const t = pick(SHB.traits);
      if (!seen.has(t.id)) { seen.add(t.id); cands.push(t); }
    }
    renderRoll(cands);
    $('#roll-seed').textContent = state.seed;
    showScreen('start');
  }
  function renderRoll(cands) {
    const box = $('#roll-box');
    box.innerHTML = '';
    cands.forEach(t => {
      const card = document.createElement('button');
      card.className = 'trait-card';
      card.style.setProperty('--trait-color', t.color);
      card.innerHTML = '<span class="trait-name">' + t.name + '</span><span class="trait-desc">' + t.desc + '</span>';
      card.addEventListener('click', () => chooseTrait(t));
      box.appendChild(card);
    });
  }
  function chooseTrait(trait) {
    const s = state;
    if (trait.reuseSeed && lastSeed != null && lastSeed !== undefined) {
      s.seed = lastSeed;
      rng = mulberry32(s.seed);
      for (let i = 0; i < 1 + Math.floor(rng() * 5); i++) rng(); // 蝴蝶效应
    }
    applyTrait(s, trait);
    lastSeed = s.seed;
    save();
    showScreen('life');
    render();
  }

  // ---------------- 重生（保留遗产） ----------------
  function doRebirth() {
    const prev = state;
    const legacy = {
      knowledge: prev.resources.knowledge,
      planLevel: prev.systems.doujiao.planLevel,
      fishRarity: prev.systems.moyu.fishRarity,
      fishCount: prev.systems.moyu.fishCount,
      catWeight: prev.systems.cat.weight,
      furballRate: prev.systems.cat.furballRate,
      slots: prev.systems.market.slots,
      massageSkill: prev.systems.massage.skillLevel,
      lifespanMaxBonus: prev.resources.lifespanMax - C.LIFESPAN_MAX_BASE,
      salary10: Math.floor(prev.resources.salary * 0.10),
      rebirthCount: (prev.stats.rebirths || 0) + 1,
    };
    state = freshState();
    const s = state;
    s.resources.knowledge = legacy.knowledge;
    s.systems.doujiao.planLevel = legacy.planLevel;
    s.systems.moyu.fishRarity = legacy.fishRarity;
    s.systems.moyu.fishCount = legacy.fishCount;
    s.systems.cat.weight = legacy.catWeight;
    s.systems.cat.furballRate = legacy.furballRate;
    s.systems.market.slots = legacy.slots;
    s.systems.market.slotsMax = legacy.slots;
    s.systems.massage.skillLevel = legacy.massageSkill;
    s.resources.lifespanMax = Math.min(C.LIFESPAN_MAX_ABS, C.LIFESPAN_MAX_BASE + legacy.lifespanMaxBonus);
    s.resources.lifespan = s.resources.lifespanMax;
    s.resources.salary = legacy.salary10;
    s.stats.rebirths = legacy.rebirthCount;
    s.settings.tickIntervalMs = prev.settings.tickIntervalMs || 1000;
    SHB.engine.earnSalary(s, 50); // 内推入职
    lastSeed = prev.seed;
    rng = mulberry32(s.seed);
    rollCandidates();
  }

  // ---------------- 退休 / 结束交互 ----------------
  function continueElder() {
    const s = state;
    s.atRetireCheckpoint = false;
    s.retired = true;
    save();
    showScreen('life');
    render();
  }
  function finishRetire() {
    const s = state;
    s.atRetireCheckpoint = false;
    endGame(s, 'retire', '退休');
  }

  // ---------------- 渲染 ----------------
  function showScreen(id) {
    ['start', 'life', 'retire', 'end'].forEach(k => {
      const el = $('#screen-' + k);
      if (el) el.classList.toggle('active', k === id);
    });
  }
  function render() {
    if (!state) return;
    renderStatus(state);
    renderMonitor(state);
    renderControls(state);
    renderTaskbar(state);
  }
  function renderStatus(s) {
    $('#stat-lifespan').textContent = Math.floor(s.resources.lifespan);
    $('#stat-lifespan-max').textContent = Math.floor(s.resources.lifespanMax);
    $('#stat-salary').textContent = fmt(s.resources.salary);
    $('#stat-catfood').textContent = fmt(s.resources.catFood);
    $('#stat-furball').textContent = fmt(s.resources.furball);
    $('#stat-age').textContent = s.age;
    const pct = s.resources.lifespanMax > 0 ? clamp(s.resources.lifespan / s.resources.lifespanMax, 0, 1) : 0;
    const bar = $('#lifebar-fill');
    bar.style.width = (pct * 100) + '%';
    bar.style.background = pct < 0.2 ? '#d9482f' : pct < 0.5 ? '#d4a017' : '#2e8b57';
    $('#trait-badge').textContent = s.trait ? s.trait.name : '';
    $('#stage-label').textContent = (SHB.systemById[s.activeSystem] ? SHB.systemById[s.activeSystem].name : '') + (s.retired ? ' · 晚年' : ' · ' + s.age + '岁');
  }
  function renderTaskbar(s) {
    $('#taskbar-title').textContent = SHB.systemById[s.activeSystem].name;
    $('#btn-auto').textContent = autoTimer ? '⏸ 停止' : '▶ 自动';
    $('#btn-auto').classList.toggle('on', !!autoTimer);
  }
  function renderMonitor(s) {
    const el = $('#monitor-content');
    switch (s.activeSystem) {
      case 'qiju': el.innerHTML = renderChat(s); break;
      case 'doujiao': el.innerHTML = renderDoujiao(s); break;
      case 'moyu': el.innerHTML = renderFishTank(s); break;
      case 'cat': el.innerHTML = renderCat(s); break;
      case 'mecha': el.innerHTML = renderMecha(s); break;
      case 'market': el.innerHTML = renderMarket(s); break;
      case 'massage': el.innerHTML = renderMassage(s); break;
      case 'settings': el.innerHTML = renderHelp(s); break;
    }
  }
  function renderChat(s) {
    const msgs = s.log.filter(l => l.t === 'qiju').slice(-24);
    const bubbles = msgs.map(l => '<div class="bubble">' + escapeHtml(l.text) + '</div>').join('');
    return '<div class="chat">' + (bubbles || '<div class="placeholder">点下面的「回车」，开始用命换钱。</div>') + '</div>';
  }
  function renderDoujiao(s) {
    const d = s.systems.doujiao;
    const last = s.log.filter(l => l.t === 'doujiao').slice(-1)[0];
    const p = Math.round(clamp(C.STUDY_BASE + (d.searchUnlocked ? 0.15 : 0) + ((s.trait && s.trait.studyBonus) || 0), 0, C.STUDY_CAP) * 100);
    return '<div class="ai-dialog"><div class="ai-line">🤖 豆角</div>' +
      '<div class="ai-msg">' + (last ? escapeHtml(last.text) : '向我提问，我帮你涨知识。') + '</div>' +
      '<div class="ai-meta">对话成功率 ' + p + '% · plan Lv.' + d.planLevel + ' · 知识 ' + s.resources.knowledge + '</div></div>';
  }
  function renderFishTank(s) {
    const r = SHB.fishRarities[s.systems.moyu.fishRarity];
    const count = s.systems.moyu.fishCount;
    const positions = [[18, 40], [55, 25], [30, 62], [70, 55], [45, 30], [80, 70]];
    const fishes = [];
    for (let i = 0; i < count; i++) {
      const pos = positions[i % positions.length];
      fishes.push('<button class="fish" data-action="moyu-tap" style="left:' + pos[0] + '%;top:' + pos[1] + '%" aria-label="摸鱼">' + r.emoji + '</button>');
    }
    return '<div class="tank"><div class="tank-water">' + fishes.join('') + '</div>' +
      '<div class="tank-info">' + r.name + ' · 每摸 +' + r.food + ' 猫粮 · 被抓 ' + Math.round(r.caught * 100) + '%</div></div>';
  }
  function renderCat(s) {
    const c = s.systems.cat;
    const size = 40 + Math.round(c.weight * 1.6);
    const catFace = c.weight >= 50 ? '😼' : c.weight >= 20 ? '😺' : '🐱';
    return '<div class="cat-view"><div class="cat-emoji" style="font-size:' + size + 'px">' + catFace + '</div>' +
      '<div class="cat-stats">体重 ' + Math.round(c.weight) + '/100 · 猫球 ' + s.resources.furball + ' · 1猫球=' + c.furballRate + '工资</div>' +
      '<div class="cat-bar"><div class="cat-bar-fill" style="width:' + clamp(c.weight, 0, 100) + '%"></div></div></div>';
  }
  function renderMecha(s) {
    const m = s.systems.mecha;
    const logs = s.log.filter(l => l.t === 'mecha' || l.t === 'event').slice(-12).reverse();
    const lines = logs.map(l => '<div class="mecha-line">' + escapeHtml(l.text) + '</div>').join('');
    return '<div class="mecha-view"><div class="mecha-title">⚙️ 喵星人机械飞升</div>' +
      '<div class="mecha-log">' + (lines || '同事都变成了猫，说话都带喵。') + '</div>' +
      '<div class="mecha-meta">已吸取寿元累计 ' + m.soulAbsorbed + '</div></div>';
  }
  function renderMarket(s) {
    const m = s.systems.market;
    const c = m.current;
    const curHtml = c ? '<div class="auction"><span class="auction-name">' + escapeHtml(c.name) + '</span><span class="auction-price">¥' + c.price + '</span><span class="auction-meta">基础 ' + c.base + ' · 波动 ±' + Math.round(c.vol * 100) + '%</span></div>' : '<div class="placeholder">暂无拍卖品</div>';
    const inv = m.inventory.length
      ? m.inventory.map((g, i) => '<button class="inv-item" data-action="market-sell" data-i="' + i + '">' + escapeHtml(g.name) + ' <span class="inv-price">¥' + g.price + '</span></button>').join('')
      : '<span class="placeholder">包裹空</span>';
    return '<div class="market-view">' + curHtml + '<div class="curve">' + drawCurve(m.history) + '</div>' +
      '<div class="inv-label">包裹（' + m.inventory.length + '/' + m.slots + '）· 点货物卖出</div><div class="inv-list">' + inv + '</div></div>';
  }
  function drawCurve(history) {
    if (!history || history.length < 2) return '<div class="placeholder">行情推进后显示价格曲线</div>';
    const w = 100, h = 40;
    const min = Math.min.apply(null, history), max = Math.max.apply(null, history);
    const range = (max - min) || 1;
    const pts = history.map((v, i) => {
      const x = (i / (history.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
    return '<svg class="curve-svg" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none"><polyline points="' + pts + '" fill="none" stroke="currentColor" stroke-width="1"/></svg>';
  }
  function renderMassage(s) {
    const m = s.systems.massage;
    const active = s.buffs.massage > 0;
    const cd = s.buffs.massageCooldown;
    const reduce = Math.round((0.3 + m.skillLevel * 0.1) * 100);
    const ascii = '     o\n    /|\\\n    / \\\n    💆';
    let stateText = '可推拿 · 减耗 ' + reduce + '%';
    if (active) stateText = '推拿中，剩余 ' + s.buffs.massage + ' tick，减耗 ' + reduce + '%';
    else if (cd > 0) stateText = '冷却中 ' + cd + ' tick（强行推拿有骨折风险）';
    return '<div class="massage-view"><pre class="human">' + ascii + '</pre><div class="massage-state">' + stateText + '</div></div>';
  }
  function renderHelp() {
    return '<div class="help-view"><p><strong>上班魂 · 拿命换钱</strong></p><p>寿元是行动点，所有 tick 都消耗寿元。</p><p>60 岁退休默认结算，寿元归零则猝死。</p><p>知识是唯一带得走的硬通货。</p></div>';
  }

  // ---------------- 控件区 ----------------
  function renderControls(s) {
    $('#control-zone').innerHTML = controlsHTML(s, s.activeSystem);
  }
  function controlsHTML(s, sys) {
    switch (sys) {
      case 'qiju':
        return '<div class="ctl-row"><button class="btn btn-primary btn-big" data-action="tick">⏎ 发消息</button></div>' +
          '<div class="ctl-meta">单条工资 ≈ ' + qijuSalary(s) + ' · 累计 ' + s.stats.totalMessages + ' 条</div>' +
          upgradeListHTML(s, 'qiju');
      case 'doujiao':
        return '<div class="ctl-row"><button class="btn btn-primary btn-big" data-action="tick">💬 对话（涨知识）</button></div>' +
          '<div class="ctl-meta">知识 ' + s.resources.knowledge + ' · plan Lv.' + s.systems.doujiao.planLevel + '</div>' +
          upgradeListHTML(s, 'doujiao');
      case 'moyu':
        return '<div class="ctl-row"><span class="ctl-meta">👆 点上方鱼缸里的鱼来摸鱼</span></div>' + upgradeListHTML(s, 'moyu');
      case 'cat': {
        let feeder = '';
        if (s.systems.cat.autoFeederUnlocked) {
          feeder = '<div class="ctl-row"><button class="btn ' + (s.systems.cat.autoFeederEnabled ? 'btn-on' : '') + '" data-action="toggle-feeder">' + (s.systems.cat.autoFeederEnabled ? '自动喂猫：开' : '自动喂猫：关') + '</button></div>';
        }
        return '<div class="ctl-row"><button class="btn btn-primary" data-action="feed">🍚 喂食（1猫粮）</button><button class="btn" data-action="sell-furball">🧶 卖猫球</button></div>' + feeder + upgradeListHTML(s, 'cat');
      }
      case 'mecha':
        return '<div class="ctl-row"><button class="btn btn-danger btn-big" data-action="tick">🚩 万魂幡 · 吸取寿元</button></div>' +
          '<div class="ctl-meta">消耗 3 寿元，掷一次魂</div>' + upgradeListHTML(s, 'mecha');
      case 'market': {
        const c = s.systems.market.current;
        return '<div class="ctl-row"><button class="btn" data-action="market-buy">买入</button><button class="btn" data-action="market-refresh">换一个</button></div>' +
          '<div class="ctl-row"><button class="btn btn-primary" data-action="tick">📈 推行情</button></div>' +
          '<div class="ctl-meta">' + (c ? '当前 ' + c.name + ' ¥' + c.price : '暂无拍卖品') + '</div>' +
          upgradeListHTML(s, 'market');
      }
      case 'massage':
        return '<div class="ctl-row"><button class="btn btn-primary btn-big" data-action="massage-start">💆 开始推拿</button></div>' +
          '<div class="ctl-meta">消耗 5 寿元 · 减耗 ' + Math.round((0.3 + s.systems.massage.skillLevel * 0.1) * 100) + '% 持续 ' + C.MASSAGE_DURATION + ' tick · 骨折风险</div>' +
          upgradeListHTML(s, 'massage');
      case 'settings':
        return settingsHTML(s);
      default:
        return '';
    }
  }
  function upgradeListHTML(s, sys) {
    const specs = SHB.upgradeSpecs.filter(sp => sp.system === sys);
    const items = [];
    for (const sp of specs) {
      const info = upgradeInfo(sp, s);
      if (!info || info.done) continue;
      const afford = s.resources.salary >= info.cost;
      items.push('<button class="upgrade ' + (afford ? '' : 'no-afford') + '" data-action="upgrade" data-id="' + sp.id + '">' +
        sp.name + ' · ¥' + info.cost + '<span class="up-desc">' + sp.desc + '</span></button>');
    }
    if (items.length === 0) return '';
    return '<div class="upgrades"><div class="up-title">升级项</div>' + items.join('') + '</div>';
  }
  function settingsHTML(s) {
    const opts = [500, 1000, 2000, 5000].map(ms =>
      '<button class="chip ' + (s.settings.tickIntervalMs === ms ? 'on' : '') + '" data-action="set-interval" data-ms="' + ms + '">' + (ms / 1000) + 's</button>'
    ).join('');
    return '<div class="settings">' +
      '<div class="up-title">tick 频率</div><div class="ctl-row">' + opts + '</div>' +
      '<div class="up-title">主题</div><div class="ctl-row">' +
      '<button class="chip ' + (currentTheme() === 'auto' ? 'on' : '') + '" data-action="theme" data-t="auto">auto</button>' +
      '<button class="chip ' + (currentTheme() === 'light' ? 'on' : '') + '" data-action="theme" data-t="light">light</button>' +
      '<button class="chip ' + (currentTheme() === 'dark' ? 'on' : '') + '" data-action="theme" data-t="dark">dark</button>' +
      '</div>' +
      '<div class="up-title">存档</div><div class="ctl-row">' +
      '<button class="btn" data-action="export">导出</button>' +
      '<button class="btn" data-action="import">导入</button>' +
      '<button class="btn btn-danger" data-action="wipe">删档重来</button>' +
      '</div></div>';
  }

  // ---------------- 开始菜单 ----------------
  function isUnlockedSys(s, id) {
    if (id === 'settings') return true;
    return !!(s.systems[id] && s.systems[id].unlocked);
  }
  function unlockLabel(id) {
    const ms = SHB.milestones.find(m => m.system === id);
    if (ms && ms.label) return ms.label;
    return '猫体重 ≥ 50（回复喵星人消息）';
  }
  function renderStartMenu() {
    const grid = $('#start-menu-grid');
    grid.innerHTML = '';
    SHB.systems.forEach(sys => {
      const unlocked = isUnlockedSys(state, sys.id);
      const btn = document.createElement('button');
      btn.className = 'menu-item' + (state.activeSystem === sys.id ? ' active' : '') + (unlocked ? '' : ' locked');
      btn.innerHTML = '<span class="mi-icon">' + sys.icon + '</span><span class="mi-name">' + sys.name + '</span>' + (unlocked ? '' : '<span class="mi-lock">🔒</span>');
      if (unlocked) btn.addEventListener('click', () => switchSystem(sys.id));
      else btn.addEventListener('click', () => toast('未解锁：' + unlockLabel(sys.id)));
      grid.appendChild(btn);
    });
  }
  function switchSystem(id) {
    if (!isUnlockedSys(state, id)) return;
    state.activeSystem = id;
    closeStartMenu();
    render();
    save();
  }
  function openStartMenu() { renderStartMenu(); $('#start-menu').classList.add('open'); }
  function closeStartMenu() { $('#start-menu').classList.remove('open'); }

  // ---------------- 弹窗 / toast ----------------
  function showModal(html) {
    modalToken++;
    $('#modal-card').innerHTML = html;
    $('#modal').classList.add('open');
    $('#modal').setAttribute('aria-hidden', 'false');
    return modalToken;
  }
  function closeModal() {
    modalToken++; // 使挂起的自动关闭失效
    $('#modal').classList.remove('open');
    $('#modal').setAttribute('aria-hidden', 'true');
  }
  function showEventModal(ev) {
    if (mewOpen) return; // 不打断喵星人选择
    const icon = ev.kind === 'good' ? '🎁' : ev.kind === 'bad' ? '⚠️' : 'ℹ️';
    const t = showModal('<div class="modal-title">' + icon + ' ' + ev.name + '</div><div class="modal-body">' + escapeHtml(ev.text) + '</div>' +
      '<div class="modal-actions"><button class="btn btn-primary" data-modal-close>收到</button></div>');
    setTimeout(() => { if (modalToken === t) closeModal(); }, 2600);
  }
  function showMewModal(ev) {
    if (mewOpen) { mewQueue.push(ev); return; }
    mewOpen = true;
    stopAuto();
    showModal('<div class="modal-title">🐱 猫猫发来消息</div><div class="modal-body">「' + escapeHtml(ev.msg) + '」</div><div class="modal-actions">' +
      '<button class="btn btn-primary" data-mew="reply" data-at="' + ev.at + '">回复</button>' +
      '<button class="btn" data-mew="ignore" data-at="' + ev.at + '">不回复</button></div>');
  }
  function handleMew(at, action) {
    const s = state;
    const ev = SHB.mewEvents.find(e => e.at === at);
    if (!ev) return;
    if (action === 'reply') {
      const r = ev.reply;
      if (r.furball) s.resources.furball += r.furball;
      if (r.knowledge) s.resources.knowledge += r.knowledge;
      if (r.salary) SHB.engine.earnSalary(s, r.salary);
      if (r.unlockMecha) s.systems.mecha.unlocked = true;
      if (r.furballRatePlus) s.systems.cat.furballRate += 1;
      addLog(s, 'cat', '🐱 你回复了猫猫：' + ev.replyText, true);
    } else {
      if (ev.ignore && ev.ignore.delayUnlockMecha) {
        s.systems.mecha.delayed = true;
        addLog(s, 'cat', '🐱 你没有回复，机械飞升延迟解锁（体重 60 兜底）', false);
      } else {
        addLog(s, 'cat', '🐱 猫猫走开了', false);
      }
    }
    mewOpen = false;
    closeModal();
    save();
    render();
    if (mewQueue.length) { showMewModal(mewQueue.shift()); }
  }
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  // ---------------- 自动挂机 ----------------
  function toggleAuto() {
    if (autoTimer) stopAuto(); else startAuto();
  }
  function startAuto() {
    if (autoTimer) return;
    const ms = state.settings.tickIntervalMs || 1000;
    autoTimer = setInterval(() => { if (state && !state.ended && !state.atRetireCheckpoint) tick(true); }, ms);
    renderTaskbar(state);
  }
  function stopAuto() {
    if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
    renderTaskbar(state);
  }
  function restartAuto() {
    if (autoTimer) {
      clearInterval(autoTimer);
      const ms = state.settings.tickIntervalMs || 1000;
      autoTimer = setInterval(() => { if (state && !state.ended && !state.atRetireCheckpoint) tick(true); }, ms);
    }
  }

  // ---------------- 存档 ----------------
  function save() {
    if (!state) return;
    try {
      state.updatedAt = Date.now();
      localStorage.setItem(C.SAVE_KEY, JSON.stringify({ v: 1, state, lastSeed }));
    } catch (e) {}
  }
  function load() {
    try {
      const raw = localStorage.getItem(C.SAVE_KEY);
      if (!raw) return false;
      const d = JSON.parse(raw);
      if (d && d.v === 1 && d.state) {
        state = d.state;
        lastSeed = d.lastSeed;
        rng = mulberry32(state.seed);
        return true;
      }
    } catch (e) {}
    return false;
  }
  function clearSave() {
    try { localStorage.removeItem(C.SAVE_KEY); } catch (e) {}
  }
  function exportSave() {
    const data = JSON.stringify({ v: 1, state, lastSeed });
    try {
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'shangbanhun-save.json'; a.click();
      URL.revokeObjectURL(url);
      toast('已导出存档');
    } catch (e) { prompt('复制存档', data); }
  }
  function importSave() {
    const text = prompt('粘贴存档 JSON：');
    if (!text) return;
    try {
      const d = JSON.parse(text);
      if (d && d.state && d.v === 1) {
        state = d.state; lastSeed = d.lastSeed; rng = mulberry32(state.seed);
        save();
        if (state.atRetireCheckpoint) { showScreen('retire'); }
        else if (state.ended) { renderEnd(); showScreen('end'); }
        else { showScreen('life'); render(); }
        toast('存档已导入');
      } else toast('存档格式错误');
    } catch (e) { toast('存档格式错误'); }
  }
  function confirmWipe() {
    showModal('<div class="modal-title">⚠️ 删档重来</div><div class="modal-body">确定清空所有进度、从头开始吗？</div>' +
      '<div class="modal-actions"><button class="btn btn-danger" data-wipe="yes">确定删档</button><button class="btn" data-modal-close>取消</button></div>');
  }

  // ---------------- 渲染结算屏 ----------------
  function renderRetire() {
    const s = state;
    const score = computeScore(s);
    const g = grade(score);
    $('#retire-age').textContent = s.age;
    $('#retire-ltv').textContent = fmt(s.stats.totalSalaryEarned);
    $('#retire-money').textContent = fmt(s.resources.salary);
    $('#retire-life').textContent = Math.floor(s.resources.lifespan);
    $('#retire-life-hint').textContent = Math.floor(s.resources.lifespan);
    $('#retire-score').textContent = score;
    $('#retire-grade').textContent = g.g;
    $('#retire-grade').style.color = g.color;
    $('#retire-label').textContent = g.label;
  }
  function renderEnd() {
    const s = state;
    const g = grade(s.stats.finalScore);
    $('#end-grade').textContent = g.g;
    $('#end-grade').style.color = g.color;
    $('#end-label').textContent = g.label;
    $('#end-score').textContent = s.stats.finalScore;
    $('#end-age').textContent = s.age;
    $('#end-reason').textContent = s.deathReason;
    $('#end-trait').textContent = s.trait ? s.trait.name : '';
    $('#end-ltv').textContent = fmt(s.stats.finalLTV);
    $('#end-money').textContent = fmt(s.resources.salary);
    $('#end-knowledge').textContent = s.resources.knowledge;
    $('#end-messages').textContent = s.stats.totalMessages;
    $('#end-seed').textContent = s.seed;
    const alert = $('#end-death-alert');
    if (s.endType === 'death' && s.deathReason === '猝死') {
      alert.style.display = 'block';
      $('#end-death-age').textContent = s.age;
      $('#end-over').textContent = '猝死 · 结算';
    } else {
      alert.style.display = 'none';
      $('#end-over').textContent = s.endType === 'retire' ? '退休 · 结算' : 'GAME OVER · 结算';
    }
    const endings = ['这一生，值了。', '平凡，但不平庸。', '下辈子，换个活法。', '拿命换钱，钱没命花。', '蝴蝶扇动翅膀，人生全然不同。'];
    $('#end-line').textContent = endings[s.seed % endings.length];
  }

  // ---------------- 事件处理 ----------------
  function handleAction(action, el) {
    if (!state) return;
    const s = state;
    switch (action) {
      case 'tick': tick(false); break;
      case 'moyu-tap': tick(false); break;
      case 'feed': tick(false); break;
      case 'sell-furball': sellFurball(); break;
      case 'toggle-feeder': s.systems.cat.autoFeederEnabled = !s.systems.cat.autoFeederEnabled; save(); render(); break;
      case 'market-buy': marketBuy(s); save(); render(); break;
      case 'market-refresh': marketRefreshTick(); break;
      case 'market-sell': marketSell(s, parseInt(el.dataset.i, 10)); save(); render(); break;
      case 'massage-start': startMassage(s); checkEnd(s); save(); render(); break;
      case 'upgrade': buyUpgrade(el.dataset.id); break;
      case 'set-interval': s.settings.tickIntervalMs = parseInt(el.dataset.ms, 10); save(); render(); restartAuto(); break;
      case 'theme': applyTheme(el.dataset.t); save(); render(); break;
      case 'export': exportSave(); break;
      case 'import': importSave(); break;
      case 'wipe': confirmWipe(); break;
    }
  }
  function marketRefreshTick() {
    // 换一个 = 一个完整 tick（消耗寿元 + 推进时间 + 事件），效果为刷新拍卖品
    if (!state || state.ended || state.atRetireCheckpoint || state.retired) return;
    const s = state;
    _cancelTick = false;
    const cost = effectiveCost(s, 2);
    const before = s.resources.lifespan;
    const spend = Math.min(cost, before);
    s.resources.lifespan = before - spend;
    s.stats.totalLifespanSpent += spend;
    advanceAge(s);
    s.stats.totalTicks++;
    decrementBuffs(s);
    rollEvent(s);
    if (!_cancelTick) applyMarketRefresh(s);
    checkUnlocks(s);
    checkEnd(s);
    save();
    render();
  }

  // ---------------- 主题（三态） ----------------
  function currentTheme() {
    try { return localStorage.getItem(C.THEME_KEY) || 'auto'; } catch (e) { return 'auto'; }
  }
  function applyTheme(t) {
    const root = document.documentElement;
    if (t === 'light' || t === 'dark') root.setAttribute('data-theme', t);
    else root.removeAttribute('data-theme');
    try { localStorage.setItem(C.THEME_KEY, t); } catch (e) {}
    if (state) state.settings.darkMode = t;
    const icon = $('#theme-icon');
    const label = $('#theme-label');
    if (icon) icon.textContent = t === 'light' ? '☀️' : t === 'dark' ? '🌙' : '🌗';
    if (label) label.textContent = t;
  }
  function initTheme() {
    applyTheme(currentTheme());
  }

  // ---------------- 绑定 ----------------
  function bind() {
    document.body.addEventListener('click', (e) => {
      const closeEl = e.target.closest('[data-modal-close]');
      if (closeEl) { closeModal(); return; }
      const mewEl = e.target.closest('[data-mew]');
      if (mewEl) { handleMew(parseInt(mewEl.dataset.at, 10), mewEl.dataset.mew); return; }
      const wipeEl = e.target.closest('[data-wipe]');
      if (wipeEl) { closeModal(); clearSave(); startNewGame(); return; }
      const actEl = e.target.closest('[data-action]');
      if (actEl) { handleAction(actEl.dataset.action, actEl); return; }
    });
    $('#modal').addEventListener('click', (e) => { if (e.target === $('#modal')) closeModal(); });
    $('#btn-start').addEventListener('click', openStartMenu);
    $('#btn-close-menu').addEventListener('click', closeStartMenu);
    $('#btn-auto').addEventListener('click', toggleAuto);
    $('#theme-toggle').addEventListener('click', () => {
      const cur = currentTheme();
      applyTheme(cur === 'auto' ? 'light' : cur === 'light' ? 'dark' : 'auto');
      save();
    });
    $('#btn-roll').addEventListener('click', startNewGame);
    $('#btn-rebirth').addEventListener('click', startRebirth);
    $('#btn-retire-continue').addEventListener('click', continueElder);
    $('#btn-retire-end').addEventListener('click', finishRetire);
    $('#btn-rebirth2').addEventListener('click', doRebirth);
    $('#btn-again').addEventListener('click', () => { clearSave(); startNewGame(); });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') { e.preventDefault(); tick(false); }
      else if (e.code === 'Enter' && $('#screen-life').classList.contains('active')) { tick(false); }
    });
  }

  // ---------------- 启动 ----------------
  function init() {
    initTheme();
    bind();
    if (load() && state && state.trait) {
      if (state.atRetireCheckpoint) { renderRetire(); showScreen('retire'); }
      else if (state.ended) { renderEnd(); showScreen('end'); }
      else { showScreen('life'); render(); }
    } else {
      startNewGame();
    }
  }

  document.addEventListener('DOMContentLoaded', init);

  // ---- 供无头测试 / 调试使用（不影响正常游玩） ----
  SHB.debug = {
    tick, startNewGame, freshState, applyTrait, chooseTrait, rollCandidates,
    computeScore, grade, getState: () => state,
  };
})();
