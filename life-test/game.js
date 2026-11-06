// ============================================================
// 人生模拟器 · 凡人歌 — 游戏逻辑
// 零依赖 · 纯静态 · seed 可复刻
// ============================================================
(function () {
  'use strict';

  // ---------------- 可复刻随机数（mulberry32） ----------------
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  let rng = mulberry32((Date.now() ^ 0x9e3779b9) >>> 0);

  // ---------------- 词条定义 ----------------
  const TRAITS = [
    {
      id: 'normal',
      name: '平凡之人',
      desc: '没有光环，也没有枷锁。标准人生，全看你自己。',
      color: '#8a8a92',
    },
    {
      id: 'juan',
      name: '卷王',
      desc: '工作收益 ×1.8，但无法养生——养生类事件对你无效。',
      color: '#d9482f',
      workMult: 1.8,
      noWellness: true,
    },
    {
      id: 'rich',
      name: '家财万贯',
      desc: '投胎技术满分，初始资金 +10000。',
      color: '#d4a017',
      startMoney: 10000,
    },
    {
      id: 'genius',
      name: '天赋异禀',
      desc: '学习成功率 +25%（默认学习本来就难）。',
      color: '#3b6fd4',
      studyBonus: 0.25,
    },
    {
      id: 'cursed',
      name: '天妒英才',
      desc: '寿元减少类事件概率 ×3，好运事件概率也 ×2。高风险高回报。',
      color: '#7a3bd4',
      badMult: 3,
      goodMult: 2,
    },
    {
      id: 'rebirth',
      name: '重生之人',
      desc: '种子与上一局相同，但蝴蝶效应——结局未必一样。',
      color: '#2e8b57',
      reuseSeed: true,
    },
    {
      id: 'longevity',
      name: '长寿基因',
      desc: '初始寿元 +20，能活得更久。',
      color: '#2e8b57',
      lifespanBonus: 20,
    },
    {
      id: 'koi',
      name: '锦鲤体质',
      desc: '好运事件概率 ×1.5。',
      color: '#d4508c',
      goodMult: 1.5,
    },
    {
      id: 'chosen',
      name: '天选打工人',
      desc: '永不失业——裁员/优化事件对你免疫。',
      color: '#3b8fd4',
      noLayoff: true,
    },
    {
      id: 'lovebrain',
      name: '恋爱脑',
      desc: '快乐波动 ×1.5，情绪大起大落。',
      color: '#d46a9a',
      moodMult: 1.5,
    },
  ];

  const TRAIT_BY_ID = {};
  TRAITS.forEach(t => { TRAIT_BY_ID[t.id] = t; });

  // ---------------- 事件池 ----------------
  // kind: good(好事) / bad(坏事) / neutral(中性)
  // 每阶段（stage）对应年龄段的事件池
  const EVENTS = {
    // 童年 0-12
    child: [
      { name: '抓到一只蝴蝶', kind: 'good', text: '童年无忧无虑，快乐 +5。', fx: s => { s.happiness += 5; } },
      { name: '被隔壁小孩欺负', kind: 'bad', text: '委屈巴巴，快乐 -4。', fx: s => { s.happiness -= 4; } },
      { name: '第一次考试拿满分', kind: 'good', text: '开窍了，智力 +2，快乐 +3。', fx: s => { s.intellect += 2; s.happiness += 3; } },
      { name: '生了一场小病', kind: 'bad', text: '体质 -2，寿元 -1。', fx: s => { s.physique -= 2; s.lifespan -= 1; } },
      { name: '学会骑自行车', kind: 'good', text: '快乐 +4。', fx: s => { s.happiness += 4; } },
      { name: '爸妈吵架', kind: 'bad', text: '快乐 -5。', fx: s => { s.happiness -= 5; } },
      { name: '收到新年红包', kind: 'good', text: '资金 +500，快乐 +3。', fx: s => { s.money += 500; s.happiness += 3; } },
      { name: '摔断了胳膊', kind: 'bad', text: '体质 -3，寿元 -2。', fx: s => { s.physique -= 3; s.lifespan -= 2; } },
      { name: '养了只小宠物', kind: 'good', text: '快乐 +6。', fx: s => { s.happiness += 6; } },
      { name: '平凡的一年', kind: 'neutral', text: '什么特别的事都没发生。', fx: s => {} },
    ],
    // 少年 13-18
    teen: [
      { name: '成绩突飞猛进', kind: 'good', text: '智力 +3，快乐 +4。', fx: s => { s.intellect += 3; s.happiness += 4; } },
      { name: '沉迷游戏', kind: 'bad', text: '快乐 +6，但智力 -2。', fx: s => { s.happiness += 6; s.intellect -= 2; } },
      { name: '早恋了', kind: 'good', text: '快乐 +8，但智力 -1（分心了）。', fx: s => { s.happiness += 8; s.intellect -= 1; } },
      { name: '被霸凌', kind: 'bad', text: '快乐 -8。', fx: s => { s.happiness -= 8; } },
      { name: '参加竞赛获奖', kind: 'good', text: '智力 +4，快乐 +5。', fx: s => { s.intellect += 4; s.happiness += 5; } },
      { name: '近视加深', kind: 'bad', text: '体质 -2。', fx: s => { s.physique -= 2; } },
      { name: '交到知心朋友', kind: 'good', text: '快乐 +6。', fx: s => { s.happiness += 6; } },
      { name: '中考失利', kind: 'bad', text: '快乐 -6，智力 -1。', fx: s => { s.happiness -= 6; s.intellect -= 1; } },
      { name: '暗恋无果', kind: 'bad', text: '快乐 -4。', fx: s => { s.happiness -= 4; } },
      { name: '篮球打进校队', kind: 'good', text: '体质 +3，快乐 +4。', fx: s => { s.physique += 3; s.happiness += 4; } },
      { name: '普通的学习生活', kind: 'neutral', text: '按部就班。', fx: s => {} },
    ],
    // 青年 19-30
    young: [
      { name: '拿到大厂 offer', kind: 'good', text: '资金 +8000，快乐 +6。', fx: s => { s.money += 8000; s.happiness += 6; } },
      { name: '创业失败', kind: 'bad', text: '资金 -5000，快乐 -8。', fx: s => { s.money -= 5000; s.happiness -= 8; } },
      { name: '升职加薪', kind: 'good', text: '资金 +6000，快乐 +5。', fx: s => { s.money += 6000; s.happiness += 5; } },
      { name: '被裁员/优化', kind: 'bad', text: '资金 -3000，快乐 -8。', fx: s => { s.money -= 3000; s.happiness -= 8; } },
      { name: '谈了场恋爱', kind: 'good', text: '快乐 +9。', fx: s => { s.happiness += 9; } },
      { name: '失恋了', kind: 'bad', text: '快乐 -9。', fx: s => { s.happiness -= 9; } },
      { name: '加班到进医院', kind: 'bad', text: '寿元 -3，体质 -2。', fx: s => { s.lifespan -= 3; s.physique -= 2; } },
      { name: '投资小赚一笔', kind: 'good', text: '资金 +4000。', fx: s => { s.money += 4000; } },
      { name: '买了房（背房贷）', kind: 'neutral', text: '资金 -20000，但快乐 +5（有家了）。', fx: s => { s.money -= 20000; s.happiness += 5; } },
      { name: '体检报告亮红灯', kind: 'bad', text: '寿元 -3。', fx: s => { s.lifespan -= 3; } },
      { name: '在职读研', kind: 'good', text: '智力 +5，寿元 -1（累的）。', fx: s => { s.intellect += 5; s.lifespan -= 1; } },
      { name: '规律锻炼身体变好', kind: 'good', text: '体质 +2，寿元 +2。', wellness: true, fx: s => { s.physique += 2; s.lifespan += 2; } },
      { name: '平淡的打工生活', kind: 'neutral', text: '日复一日。', fx: s => {} },
    ],
    // 中年 31-45
    mid: [
      { name: '升任管理层', kind: 'good', text: '资金 +10000，快乐 +4。', fx: s => { s.money += 10000; s.happiness += 4; } },
      { name: '中年危机', kind: 'bad', text: '快乐 -8。', fx: s => { s.happiness -= 8; } },
      { name: '孩子教育开销', kind: 'bad', text: '资金 -8000。', fx: s => { s.money -= 8000; } },
      { name: '副业干起来了', kind: 'good', text: '资金 +7000。', fx: s => { s.money += 7000; } },
      { name: '身体开始走下坡', kind: 'bad', text: '体质 -2，寿元 -2。', fx: s => { s.physique -= 2; s.lifespan -= 2; } },
      { name: '投资翻倍', kind: 'good', text: '资金 +15000，快乐 +6。', fx: s => { s.money += 15000; s.happiness += 6; } },
      { name: '被优化（35 岁危机）', kind: 'bad', text: '资金 -4000，快乐 -9。', fx: s => { s.money -= 4000; s.happiness -= 9; } },
      { name: '开始养生', kind: 'good', text: '寿元 +4，体质 +2。', wellness: true, fx: s => { s.lifespan += 4; s.physique += 2; } },
      { name: '体检发现慢性病', kind: 'bad', text: '寿元 -4。', fx: s => { s.lifespan -= 4; } },
      { name: '升到总监', kind: 'good', text: '资金 +12000。', fx: s => { s.money += 12000; } },
      { name: '坚持晨跑', kind: 'good', text: '体质 +2，寿元 +2。', wellness: true, fx: s => { s.physique += 2; s.lifespan += 2; } },
      { name: '上有老下有小', kind: 'neutral', text: '责任更重了，快乐 -3。', fx: s => { s.happiness -= 3; } },
    ],
    // 中老年 46-60
    senior: [
      { name: '孩子考上好大学', kind: 'good', text: '快乐 +10，资金 -5000（学费）。', fx: s => { s.happiness += 10; s.money -= 5000; } },
      { name: '健康报警', kind: 'bad', text: '寿元 -4。', fx: s => { s.lifespan -= 4; } },
      { name: '退休前攒了笔养老钱', kind: 'good', text: '资金 +8000。', fx: s => { s.money += 8000; } },
      { name: '查出三高', kind: 'bad', text: '寿元 -3，体质 -2。', fx: s => { s.lifespan -= 3; s.physique -= 2; } },
      { name: '含饴弄孙', kind: 'good', text: '快乐 +8。', fx: s => { s.happiness += 8; } },
      { name: '老友去世', kind: 'bad', text: '快乐 -7。', fx: s => { s.happiness -= 7; } },
      { name: '体检各项指标正常', kind: 'good', text: '寿元 +4。', wellness: true, fx: s => { s.lifespan += 4; } },
      { name: '突发心梗前兆', kind: 'bad', text: '寿元 -5。', fx: s => { s.lifespan -= 5; } },
      { name: '规律作息身体回春', kind: 'good', text: '寿元 +3，体质 +2。', wellness: true, fx: s => { s.lifespan += 3; s.physique += 2; } },
      { name: '平稳过渡', kind: 'neutral', text: '岁月静好。', fx: s => {} },
    ],
    // 老年 60+
    old: [
      { name: '广场舞 C 位', kind: 'good', text: '快乐 +6。', fx: s => { s.happiness += 6; } },
      { name: '老毛病犯了', kind: 'bad', text: '寿元 -3。', fx: s => { s.lifespan -= 3; } },
      { name: '儿孙绕膝', kind: 'good', text: '快乐 +9。', fx: s => { s.happiness += 9; } },
      { name: '跌了一跤', kind: 'bad', text: '寿元 -4，体质 -2。', fx: s => { s.lifespan -= 4; s.physique -= 2; } },
      { name: '安享晚年', kind: 'good', text: '寿元 +2。', wellness: true, fx: s => { s.lifespan += 2; } },
      { name: '老伴先走了', kind: 'bad', text: '快乐 -9。', fx: s => { s.happiness -= 9; } },
      { name: '百年修得同船渡', kind: 'good', text: '快乐 +5。', fx: s => { s.happiness += 5; } },
      { name: '寿终正寝的前兆', kind: 'bad', text: '寿元 -4。', fx: s => { s.lifespan -= 4; } },
      { name: '平静的一年', kind: 'neutral', text: '慢悠悠地过。', fx: s => {} },
    ],
  };

  const STAGE_OF_AGE = (age) => {
    if (age <= 12) return 'child';
    if (age <= 18) return 'teen';
    if (age <= 30) return 'young';
    if (age <= 45) return 'mid';
    if (age <= 60) return 'senior';
    return 'old';
  };

  // ---------------- 状态 ----------------
  const SAVE_KEY = 'fange_life_save_v1';

  let state = null;
  let lastSeed = null;       // 上一局 seed（供「重生之人」复用）
  let autoTimer = null;

  const STAGE_LABEL = {
    child: '童年',
    teen: '少年',
    young: '青年',
    mid: '中年',
    senior: '中老年',
    old: '老年',
  };

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function freshState() {
    const s = {
      seed: (Date.now() ^ 0x9e3779b9) >>> 0,
      age: 0,
      lifespan: 60,
      lifespanMax: 60,
      money: 0,
      // 五维
      appearance: 10,
      intellect: 10,
      physique: 10,
      wealth: 10,
      happiness: 60,
      // 词条
      trait: null,
      // 统计
      totalIncome: 0,      // LTV 口径：一生累计收入
      peakHappiness: 60,
      maxIntellect: 10,
      lifeLog: [],
      dead: false,
      deathReason: '',
      retired: false,
      ended: false,
      endType: '', // 'retire' | 'death'
      // 工作/学习系数
      workMult: 1,
      studyBonus: 0,
      badMult: 1,
      goodMult: 1,
      noWellness: false,
      noLayoff: false,
      moodMult: 1,
      lifespanBonus: 0,
    };
    return s;
  }

  function rollInitial(s) {
    // 初始五维：5~15
    s.appearance = 5 + Math.floor(rng() * 11);
    s.intellect = 5 + Math.floor(rng() * 11);
    s.physique = 5 + Math.floor(rng() * 11);
    s.wealth = 5 + Math.floor(rng() * 11);
    s.happiness = 50 + Math.floor(rng() * 21); // 50~70
    s.lifespan = Math.round(65 + s.physique * 1.5); // 72~87，预期寿命（不含事件波动）
    s.money = s.wealth * 100; // 500~1500
    s.peakHappiness = s.happiness;
    s.maxIntellect = s.intellect;
  }

  function applyTrait(s, trait) {
    s.trait = trait;
    const t = trait;
    if (t.workMult) s.workMult = t.workMult;
    if (t.studyBonus) s.studyBonus = t.studyBonus;
    if (t.badMult) s.badMult = t.badMult;
    if (t.goodMult) s.goodMult = t.goodMult;
    if (t.noWellness) s.noWellness = true;
    if (t.noLayoff) s.noLayoff = true;
    if (t.moodMult) s.moodMult = t.moodMult;
    if (t.lifespanBonus) { s.lifespanBonus = t.lifespanBonus; s.lifespan += t.lifespanBonus; }
    if (t.startMoney) s.money += t.startMoney;
    s.lifespanMax = s.lifespan;
  }

  function pickTraitFor(s, r) {
    // 按 seed 的 rng 流选词条（可复刻）
    const idx = Math.floor(r() * TRAITS.length);
    return TRAITS[idx];
  }

  // ---------------- 学习 / 工作 ----------------
  function studySuccess(s) {
    const base = 0.40 + s.intellect * 0.006 + s.studyBonus;
    return clamp(base, 0.1, 0.95);
  }

  function yearlyIncome(s) {
    // 22~60 岁工作收入
    const moodCoef = 0.8 + (s.happiness / 100) * 0.4;
    const base = (3000 + s.intellect * 220) * s.workMult * moodCoef * (0.8 + rng() * 0.4);
    return Math.round(base);
  }

  // ---------------- 事件选取 ----------------
  function pickEvent(s) {
    const pool = EVENTS[STAGE_OF_AGE(s.age)];
    // 加权：按 kind 的概率修正
    let candidates = pool.slice();
    // 天妒英才/锦鲤：好事概率 ×goodMult，坏事概率 ×badMult
    const weighted = [];
    for (const ev of candidates) {
      let w = 1;
      if (ev.kind === 'good') w *= s.goodMult;
      if (ev.kind === 'bad') w *= s.badMult;
      // 卷王：养生事件无效（排除）
      if (s.noWellness && ev.wellness) w = 0;
      // 天选打工人：裁员/优化免疫
      if (s.noLayoff && /裁员|优化|失业/.test(ev.name)) w = 0;
      for (let i = 0; i < Math.round(w * 10); i++) weighted.push(ev);
    }
    if (weighted.length === 0) weighted.push({ name: '平淡的一年', kind: 'neutral', text: '什么特别的事都没发生。', fx: () => {} });
    return weighted[Math.floor(rng() * weighted.length)];
  }

  // ---------------- 年度推进 ----------------
  function advanceYear() {
    if (!state || state.dead) return;

    const s = state;
    s.age += 1;

    const entries = []; // 本年度日志

    // 1. 自然衰老：一年一岁（事件额外增减寿元）
    s.lifespan -= 1;

    // 2. 学习阶段（6-18）
    if (s.age >= 6 && s.age <= 18) {
      const p = studySuccess(s);
      if (rng() < p) {
        const gain = 1 + Math.floor(rng() * 2); // 1~2
        s.intellect += gain;
        s.happiness += 3;
        entries.push({ t: 'study', good: true, text: `学业进步，智力 +${gain}，快乐 +3` });
      } else {
        s.happiness -= 3;
        entries.push({ t: 'study', good: false, text: '学业受挫，快乐 -3' });
      }
      // 18 岁高考
      if (s.age === 18) {
        if (rng() < studySuccess(s)) {
          s.intellect += 8;
          s.happiness += 10;
          entries.push({ t: 'milestone', good: true, text: '🎓 高考金榜题名！智力 +8，快乐 +10' });
        } else {
          s.happiness -= 8;
          entries.push({ t: 'milestone', good: false, text: '高考失利，快乐 -8' });
        }
      }
    }

    // 3. 工作阶段（22-59）
    if (s.age >= 22 && s.age < 60) {
      const income = yearlyIncome(s);
      s.money += income;
      s.totalIncome += income;
      entries.push({ t: 'work', good: true, text: `工作收入 +${income.toLocaleString()}` });
    }

    // 4. 退休阶段（60+）
    if (s.age === 60) {
      s.retired = true;
      entries.push({ t: 'milestone', good: true, text: '🏁 60 岁，退休了。寿元尚足则继续晚年。' });
    }
    if (s.age > 60 && s.retired) {
      const pension = Math.round(Math.max(0, s.money) * 0.015);
      s.money += pension;
      s.totalIncome += pension;
      entries.push({ t: 'work', good: true, text: `退休金 +${pension.toLocaleString()}` });
    }

    // 5. 快乐归零 → 抑郁加速衰老
    if (s.happiness <= 20) {
      s.lifespan -= 1;
      entries.push({ t: 'warn', good: false, text: '长期抑郁，寿元额外 -1' });
    }

    // 6. 年度事件：概率触发（不是每年必发生），给人生留白
    if (rng() < 0.6) {
      const ev = pickEvent(s);
      ev.fx(s);
      entries.push({ t: ev.kind, good: ev.kind === 'good', text: `【${ev.name}】${ev.text}` });
    } else {
      entries.push({ t: 'neutral', good: true, text: '平淡的一年，没什么大事。' });
    }

    // 7. 数值钳制
    s.appearance = clamp(s.appearance, 0, 100);
    s.intellect = clamp(s.intellect, 0, 100);
    s.physique = clamp(s.physique, 0, 100);
    s.wealth = clamp(s.wealth, 0, 100);
    s.happiness = clamp(s.happiness, 0, 100);
    s.maxIntellect = Math.max(s.maxIntellect, s.intellect);
    s.peakHappiness = Math.max(s.peakHappiness, s.happiness);
    if (s.lifespan > s.lifespanMax) s.lifespanMax = s.lifespan;

    // 8. 死亡判定（60 岁退休优先；<60 猝死；>60 寿终）
    if (s.lifespan <= 0) {
      s.lifespan = 0;
      if (s.age < 60) {
        s.dead = true;
        s.deathReason = '猝死';
        entries.push({ t: 'death', good: false, text: `☠ 猝死，享年 ${s.age} 岁` });
      } else if (s.age > 60) {
        s.dead = true;
        s.deathReason = '寿终正寝';
        entries.push({ t: 'death', good: false, text: `☠ 寿终正寝，享年 ${s.age} 岁` });
      }
      // age === 60 时不在此判定，交给下方退休停点（剩余寿元显示 0）
    }

    // 写回日志
    for (const e of entries) {
      s.lifeLog.push({ age: s.age, ...e });
    }

    save();
    renderLife();
    if (s.dead) {
      stopAuto();
      setTimeout(renderEnd, 350);
    } else if (s.age === 60) {
      // 60 岁退休：默认结算停点（可扩展：继续晚年）
      stopAuto();
      setTimeout(renderRetire, 350);
    }
  }

  // ---------------- 结算评分 ----------------
  function computeScore(s) {
    // 享年 0-100
    const ageScore = clamp((s.age / 90) * 100, 0, 100);
    // 财富：LTV 口径
    const wealthScore = clamp((s.totalIncome / 800000) * 100, 0, 100);
    // 快乐峰值
    const happyScore = clamp(s.peakHappiness, 0, 100);
    // 成就：智力巅峰
    const intelScore = clamp((s.maxIntellect / 100) * 100, 0, 100);

    const total = ageScore * 0.3 + wealthScore * 0.35 + happyScore * 0.2 + intelScore * 0.15;
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

  // ---------------- 渲染 ----------------
  const $ = (sel) => document.querySelector(sel);

  function renderRoll(traits) {
    const box = $('#roll-box');
    box.innerHTML = '';
    traits.forEach((t, i) => {
      const card = document.createElement('button');
      card.className = 'trait-card';
      card.style.setProperty('--trait-color', t.color);
      card.innerHTML = `
        <span class="trait-name">${t.name}</span>
        <span class="trait-desc">${t.desc}</span>
      `;
      card.addEventListener('click', () => chooseTrait(t));
      box.appendChild(card);
    });
  }

  function chooseTrait(trait) {
    // 「重生之人」：种子与上一局相同（若存在），蝴蝶效应让走向微变
    if (trait.id === 'rebirth' && lastSeed != null && lastSeed !== undefined) {
      state.seed = lastSeed;
      rng = mulberry32(state.seed);
      // 用相同种子重新 roll 初始（种子相同 → 初始属性相同）
      rollInitial(state);
      // 蝴蝶效应：推进事件选择时多消耗一丁点随机，让结局未必一样
      state.butterfly = Math.floor(rng() * 1000);
    }
    applyTrait(state, trait);
    // 记录 seed 供「重生」按钮复用（重生之人 = 种子相同）
    lastSeed = state.seed;
    state.lifeLog.push({ age: 0, t: 'milestone', good: true, text: `出生词条：${trait.name} — ${trait.desc}` });
    save();
    showScreen('life');
    renderLife();
  }

  function renderLife() {
    const s = state;
    $('#stat-age').textContent = s.age;
    $('#stat-lifespan').textContent = Math.max(0, Math.round(s.lifespan));
    $('#stat-money').textContent = s.money.toLocaleString();
    $('#stat-income').textContent = s.totalIncome.toLocaleString();

    // 五维条
    setBar('bar-appearance', s.appearance);
    setBar('bar-intellect', s.intellect);
    setBar('bar-physique', s.physique);
    setBar('bar-wealth', s.wealth);
    setBar('bar-happiness', s.happiness);

    // 阶段标签
    $('#stage-label').textContent = STAGE_LABEL[STAGE_OF_AGE(s.age)] + (s.retired ? ' · 退休' : '');

    // 词条徽章
    $('#trait-badge').textContent = s.trait ? s.trait.name : '';

    // 寿元条颜色
    const lifePct = s.lifespanMax > 0 ? clamp(s.lifespan / s.lifespanMax, 0, 1) : 0;
    const lifeBar = $('#bar-lifespan-fill');
    lifeBar.style.width = (lifePct * 100) + '%';
    lifeBar.style.background = lifePct < 0.2 ? '#d9482f' : lifePct < 0.5 ? '#d4a017' : '#2e8b57';

    // 日志（倒序显示最近在上）
    const log = $('#log');
    log.innerHTML = '';
    const items = s.lifeLog.slice().reverse().slice(0, 60);
    for (const e of items) {
      const div = document.createElement('div');
      div.className = 'log-item ' + (e.good ? 'good' : (e.t === 'death' ? 'death' : e.t === 'warn' ? 'warn' : 'bad'));
      div.innerHTML = `<span class="log-age">${e.age}岁</span> ${e.text}`;
      log.appendChild(div);
    }

    // 自动按钮状态
    $('#btn-auto').textContent = autoTimer ? '停止自动' : '自动推进';
  }

  function setBar(id, val) {
    const el = $(`#${id}`);
    if (el) el.style.width = clamp(val, 0, 100) + '%';
  }

  function renderEnd() {
    const s = state;
    const score = computeScore(s);
    const g = grade(score);
    $('#end-age').textContent = s.age;
    $('#end-reason').textContent = s.deathReason;
    $('#end-trait').textContent = s.trait ? s.trait.name : '';
    $('#end-ltv').textContent = s.totalIncome.toLocaleString();
    $('#end-money').textContent = s.money.toLocaleString();
    $('#end-peakhappy').textContent = s.peakHappiness;
    $('#end-intel').textContent = s.maxIntellect;
    $('#end-score').textContent = score;
    $('#end-grade').textContent = g.g;
    $('#end-grade').style.color = g.color;
    $('#end-label').textContent = g.label;
    $('#end-seed').textContent = s.seed;

    // 猝死醒目提示
    const alert = $('#end-death-alert');
    if (s.deathReason === '猝死') {
      alert.style.display = 'block';
      $('#end-death-age').textContent = s.age;
      $('#end-over').textContent = '猝死 · 结算';
    } else {
      alert.style.display = 'none';
      $('#end-over').textContent = 'GAME OVER · 结算';
    }

    // 结局文案
    const endings = [
      '这一生，值了。',
      '平凡，但不平庸。',
      '下辈子，换个活法。',
      '拿命换钱，钱没命花。',
      '蝴蝶扇动翅膀，人生全然不同。',
    ];
    $('#end-line').textContent = endings[s.seed % endings.length];

    showScreen('end');
  }

  function renderRetire() {
    const s = state;
    const score = computeScore(s);
    const g = grade(score);
    $('#retire-age').textContent = s.age;
    $('#retire-ltv').textContent = s.totalIncome.toLocaleString();
    $('#retire-money').textContent = s.money.toLocaleString();
    $('#retire-life').textContent = Math.max(0, Math.round(s.lifespan));
    $('#retire-life-hint').textContent = Math.max(0, Math.round(s.lifespan));
    $('#retire-score').textContent = score;
    $('#retire-grade').textContent = g.g;
    $('#retire-grade').style.color = g.color;
    $('#retire-label').textContent = g.label;
    showScreen('retire');
  }

  function showScreen(id) {
    ['start', 'life', 'retire', 'end'].forEach(k => {
      const el = $(`#screen-${k}`);
      if (el) el.classList.toggle('active', k === id);
    });
  }

  // ---------------- 存档 ----------------
  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        state,
        lastSeed,
        v: 1,
      }));
    } catch (e) {}
  }

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && d.state && d.v === 1) {
          state = d.state;
          lastSeed = d.lastSeed;
          return true;
        }
      }
    } catch (e) {}
    return false;
  }

  function clearSave() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
  }

  // ---------------- 开局 ----------------
  function startNewGame() {
    state = freshState();
    // 生成 3 个候选词条（可复刻，用当前 seed 的 rng）
    rng = mulberry32(state.seed);
    rollInitial(state);
    const candidates = [];
    const seen = new Set();
    while (candidates.length < 3) {
      const t = pickTraitFor(state, rng);
      if (!seen.has(t.id)) { seen.add(t.id); candidates.push(t); }
    }
    // 展示词条选择
    renderRoll(candidates);
    $('#roll-seed').textContent = state.seed;
    showScreen('start');
  }

  function startRebirth() {
    // 重生之人：沿用上一局 seed
    state = freshState();
    if (lastSeed != null && lastSeed !== undefined) {
      state.seed = lastSeed;
    }
    rng = mulberry32(state.seed);
    rollInitial(state);
    const candidates = [];
    const seen = new Set();
    while (candidates.length < 3) {
      const t = pickTraitFor(state, rng);
      if (!seen.has(t.id)) { seen.add(t.id); candidates.push(t); }
    }
    renderRoll(candidates);
    $('#roll-seed').textContent = state.seed;
    showScreen('start');
  }

  // ---------------- 自动推进 ----------------
  function startAuto() {
    if (autoTimer) return;
    autoTimer = setInterval(() => {
      if (state && !state.dead) advanceYear();
    }, 350);
  }

  function stopAuto() {
    if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
    renderLife();
  }

  function toggleAuto() {
    if (autoTimer) stopAuto();
    else startAuto();
  }

  // ---------------- 绑定 ----------------
  function bind() {
    $('#btn-roll').addEventListener('click', () => { startNewGame(); });
    $('#btn-rebirth').addEventListener('click', () => { startRebirth(); });
    $('#btn-year').addEventListener('click', () => { if (state && !state.dead) advanceYear(); });
    $('#btn-auto').addEventListener('click', toggleAuto);
    $('#btn-restart').addEventListener('click', () => { clearSave(); lastSeed = null; startNewGame(); });
    $('#btn-again').addEventListener('click', () => { clearSave(); lastSeed = null; startNewGame(); });
    $('#btn-retire-end').addEventListener('click', () => { if (state) { state.deathReason = '退休善终'; state.dead = true; } renderEnd(); });
    $('#btn-retire-continue').addEventListener('click', () => { showScreen('life'); renderLife(); });
    // 键盘：空格推进一年
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && state && !state.dead && $('#screen-life').classList.contains('active')) {
        e.preventDefault();
        advanceYear();
      }
    });
  }

  // ---------------- 主题（呼应主页三态） ----------------
  function initTheme() {
    const KEY = 'theme';
    let t = 'auto';
    try { t = localStorage.getItem(KEY) || 'auto'; } catch (e) {}
    applyTheme(t);
    const btn = $('#theme-toggle');
    if (btn) btn.addEventListener('click', () => {
      const cur = currentTheme();
      const next = cur === 'auto' ? 'light' : cur === 'light' ? 'dark' : 'auto';
      applyTheme(next);
    });
  }
  function currentTheme() {
    try { return localStorage.getItem('theme') || 'auto'; } catch (e) { return 'auto'; }
  }
  function applyTheme(t) {
    const root = document.documentElement;
    if (t === 'light' || t === 'dark') root.setAttribute('data-theme', t);
    else root.removeAttribute('data-theme');
    try { localStorage.setItem('theme', t); } catch (e) {}
    const icon = $('#theme-icon');
    const label = $('#theme-label');
    if (icon) icon.textContent = t === 'light' ? '☀️' : t === 'dark' ? '🌙' : '🌗';
    if (label) label.textContent = t;
  }

  // ---------------- 启动 ----------------
  function init() {
    bind();
    initTheme();
    if (load() && state && !state.dead) {
      // 恢复进行中的局
      showScreen('life');
      renderLife();
    } else {
      state = freshState();
      startNewGame();
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
