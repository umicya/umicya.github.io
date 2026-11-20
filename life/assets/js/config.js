// ============================================================
// 上班魂 · 静态配置（词条 / 事件 / 文案 / 数值常量）
// 零依赖 · 纯静态
// ============================================================
(function () {
  'use strict';
  const SHB = (window.SHB = window.SHB || {});

  // ---------------- 全局常量 ----------------
  SHB.const = {
    SAVE_KEY: 'shangbanhun_save_v1',
    THEME_KEY: 'theme',
    AGE_START: 22,
    AGE_RETIRE: 60,
    TICKS_PER_YEAR: 3,      // 每 3 个 tick 年龄 +1
    LIFESPAN_INIT: 100,
    LIFESPAN_MAX_BASE: 100,
    LIFESPAN_MAX_ABS: 200,
    EVENT_CHANCE: 0.03,     // 每个 tick 触发随机事件的基础概率
    STUDY_BASE: 0.70,       // 豆角对话默认成功率（调低，让「天赋异禀」有意义）
    STUDY_CAP: 0.95,
    MAX_PLAN: 10,
    FISH_MAX_COUNT: 3,
    SLOTS_MAX: 8,
    CAT_WEIGHT_MAX: 100,
    MASSAGE_DURATION: 30,   // 推拿 buff 持续 tick
    MASSAGE_COOLDOWN: 20,   // 推拿结束后的冷却 tick
    LOG_CAP: 80,
  };

  // ---------------- 出身词条 ----------------
  SHB.traits = [
    { id: 'normal', name: '平凡之人', color: '#8a8a92', desc: '没有光环，也没有枷锁。标准人生，全看你自己。' },
    { id: 'juan', name: '卷王', color: '#d9482f', desc: '工作收益 ×1.8，但无法养生——推拿/养生类事件对你无效。', workMult: 1.8, noWellness: true },
    { id: 'rich', name: '家财万贯', color: '#d4a017', desc: '投胎技术满分，初始工资 +5000。', startSalary: 5000 },
    { id: 'genius', name: '天赋异禀', color: '#3b6fd4', desc: '学习成功概率 +15%（默认学习本来就难）。', studyBonus: 0.15 },
    { id: 'cursed', name: '天妒英才', color: '#7a3bd4', desc: '减寿元类事件概率 ×3，好运事件概率也 ×2。高风险高回报。', badMult: 3, goodMult: 2 },
    { id: 'rebirth', name: '重生之人', color: '#2e8b57', desc: '本局 seed 与上一局相同，但蝴蝶效应——结局未必一样。', reuseSeed: true },
    { id: 'longevity', name: '长寿基因', color: '#2e8b57', desc: '初始寿元 +20、上限 +20，能活得更久。', lifespanBonus: 20 },
    { id: 'koi', name: '锦鲤体质', color: '#d4508c', desc: '好运事件概率 ×1.5。', goodMult: 1.5 },
    { id: 'chosen', name: '天选打工人', color: '#3b8fd4', desc: '永不失业——裁员/优化类事件对你免疫。', noLayoff: true },
    { id: 'moyu', name: '摸鱼圣体', color: '#2e9e8f', desc: '摸鱼猫粮 ×1.5，被抓概率 ×0.4。', moyuMult: 1.5, moyuCaughtMult: 0.4 },
  ];
  SHB.traitById = {};
  SHB.traits.forEach(t => { SHB.traitById[t.id] = t; });

  // ---------------- 系统定义 ----------------
  SHB.systems = [
    { id: 'qiju', name: '企巨', icon: '💬', hint: 'neta 企微 · 回车发消息，用命换钱' },
    { id: 'doujiao', name: '豆角', icon: '🤖', hint: 'neta 豆包 · 对话涨知识，升级 plan' },
    { id: 'moyu', name: '摸鱼', icon: '🐟', hint: '点鱼摸猫粮，小心被抓' },
    { id: 'cat', name: '猫猫', icon: '🐱', hint: '喂猫产猫球，可变现' },
    { id: 'mecha', name: '机械飞升', icon: '⚙️', hint: '万魂幡赌寿元，高风险高回报' },
    { id: 'market', name: '谷市', icon: '📈', hint: 'neta 股市 · 低买高卖，小心烂手里' },
    { id: 'massage', name: '推拿.VR', icon: '💆', hint: '全局减耗，小心骨折' },
    { id: 'settings', name: '设置', icon: '⚙️', hint: '频率 / 主题 / 存档' },
  ];
  SHB.systemById = {};
  SHB.systems.forEach(s => { SHB.systemById[s.id] = s; });

  // ---------------- 里程碑解锁 ----------------
  // cond(state) 返回 true 即解锁；label 为未解锁时的提示
  SHB.milestones = [
    { system: 'qiju', unlocked: true },
    { system: 'moyu', unlocked: true },
    { system: 'settings', unlocked: true },
    { system: 'doujiao', cond: s => s.stats.totalSalaryEarned >= 100, label: '累计工资 ≥ 100' },
    { system: 'cat', cond: s => s.stats.totalCatFoodGained >= 15, label: '累计猫粮 ≥ 15' },
    { system: 'market', cond: s => s.stats.totalSalaryEarned >= 400, label: '累计工资 ≥ 400' },
    { system: 'massage', cond: s => s.stats.totalLifespanSpent >= 60, label: '累计寿元消耗 ≥ 60' },
    // 机械飞升（mecha）不在此处解锁：由喵星人发信息事件（体重 50）回复触发，忽略则体重 60 兜底。
  ];

  // ---------------- 企巨消息池 ----------------
  SHB.messages = {
    qiju: [
      '收到', '好的', '辛苦辛苦', '我这边同步一下', '稍后同步', '对齐一下', '拉通一下',
      '拉通对齐', '这个需求很简单', '明天上线', '再排一个版本', '版本延期了', '线上出问题了',
      '是谁改了配置', '我没有权限', '你拉个会', '这个我们私下对', '会议室抢不到', '需求又变了',
      '推翻重来', '加个班', '不耽误你休息', '周末团建，自愿参加', '老板要的', '领导批示',
      '收到，我这边尽快', '闭环了', '抓手找起来', '补齐短板', '形成合力', '上探一下',
      '下钻一层看看', '拉通对齐再对齐', '颗粒度还差一点', '分锅大会见',
    ],
    report: [
      '这个季度的关键进展如下', '我们取得了阶段性成果', '打通了任督二脉',
      '形成了一套可复用的方法论', '沉淀了底层能力', '打造护城河', '聚焦核心链路',
      '目标对齐对齐再对齐', '结果导向，数据说话', '拉新促活留存', '端到端闭环',
      '击穿心智', '占领用户心智', '抓大放小', '下次拆得更细',
    ],
    night: [
      '（凌晨 2:00）@所有人 这个今晚辛苦同步一下',
      '（深夜）@全员 明早例会前给个结论',
      '（凌晨 1:47）@你 有空看下这个，不急，明天前',
    ],
    doujiao: [
      '我将用最直白、最不绕弯子的方式回答你',
      '作为 AI 助手我无法完成这个操作',
      '重新思考了一下，结论是……',
      '其实你只需要这样做',
      '这边同步一下思路',
      '好的，我理解你的需求是……',
      '让我先确认一下你的上下文',
      '从更底层的逻辑来看……',
      '拆解成三个抓手：一是……二是……三是……',
      '一句话总结：……',
      '可能有点乱，我理一下',
      '抱歉刚才说错了，重新来',
      '我这边再核实一下',
      '你这个 prompt 可以更颗粒度一点',
      '建议拉通前后文，形成闭环',
      '赋能你的工作流',
      '（乱码）@#$%^&*……',
      '（乱码）segmentation fault（不是）',
      '（乱码）�✺❋▚▞',
    ],
    names: [
      '张三', '李四', '王五', '赵六', '钱七', '孙八', '周九', '吴十',
      '阿伟', '老王', '小美', '大壮', '组长', '总监', '隔壁组同学', '匿名网友',
    ],
  };

  // ---------------- 鱼稀有度表 ----------------
  SHB.fishRarities = [
    { name: '草鱼', emoji: '🐟', food: 1, caught: 0.05, cost: 0, desc: '朴实无华' },
    { name: '鲫鱼', emoji: '🐟', food: 2, caught: 0.05, cost: 150, desc: '略肥' },
    { name: '鲤鱼', emoji: '🐠', food: 4, caught: 0.08, cost: 400, desc: '更显眼' },
    { name: '锦鲤', emoji: '🐡', food: 8, caught: 0.12, cost: 1000, desc: '最金贵，附带好运' },
  ];

  // ---------------- 谷子品种 ----------------
  SHB.marketVarieties = [
    { id: 'badge', name: '限定吧唧', base: 50, vol: 0.15, cap: 3 },
    { id: 'stand', name: '亚克力立牌', base: 100, vol: 0.25, cap: 4 },
    { id: 'plush', name: '毛绒挂件', base: 150, vol: 0.30, cap: 4 },
    { id: 'ticket', name: '镭射票', base: 200, vol: 0.35, cap: 5 },
    { id: 'bag', name: '痛包', base: 300, vol: 0.40, cap: 5 },
    { id: 'sign', name: '亲签色纸', base: 500, vol: 0.50, cap: 6 },
  ];

  // ---------------- 万魂幡结果表 ----------------
  SHB.wanHun = [
    { key: 'za', name: '杂魂', p: 0.40, fx: s => { s.resources.lifespan += 2; } },
    { key: 'xiao', name: '小魂', p: 0.30, fx: s => { s.resources.lifespan += 6; } },
    { key: 'da', name: '大魂', p: 0.20, fx: s => { s.resources.lifespan += 15; } },
    { key: 'bainian', name: '百年魂', p: 0.08, fx: s => { s.resources.lifespan += 30; SHB.engine.earnSalary(s, 100); } },
    { key: 'po', name: '魂飞魄散', p: 0.02, fx: s => { s.resources.lifespan -= 20; } },
  ];

  // ---------------- 喵星人发信息事件（体重阈值） ----------------
  SHB.mewEvents = [
    { at: 20, msg: '主人，饿饿，饭饭', reply: { furball: 10 }, replyText: '+10 猫球' },
    { at: 40, msg: '你摸鱼的样子我看在眼里', reply: { knowledge: 2 }, replyText: '+2 知识' },
    { at: 50, msg: '我们决定把你也变成猫', reply: { unlockMecha: true }, replyText: '解锁机械飞升', ignore: { delayUnlockMecha: true }, ignoreText: '延迟解锁' },
    { at: 80, msg: '喵星人全面接管计划', reply: { salary: 200 }, replyText: '+200 工资' },
    { at: 100, msg: '你已经是合格的猫了', reply: { furballRatePlus: 1 }, replyText: '猫球兑换率永久 +1' },
  ];

  // ---------------- plan 升级花费表（0→1 ... 9→10） ----------------
  SHB.planCosts = [50, 90, 160, 290, 520, 940, 1700, 3000, 5400, 9800];

  // ---------------- 栏位升级花费表（3→4 ... 7→8） ----------------
  SHB.slotCosts = [400, 800, 1500, 2500, 4000];

  // ---------------- 升级项定义 ----------------
  // 每个 spec：system / id / name / desc / cost 或 costFor(s) / once 或 max
  // get(s) 返回当前值（用于判定 done），apply(s) 执行升级
  SHB.upgradeSpecs = [
    // 企巨
    { system: 'qiju', id: 'double', name: '多开分身', desc: '发消息 10% 概率双倍工资', cost: 800, once: true, get: s => s.systems.qiju.doubleUnlocked, apply: s => { s.systems.qiju.doubleUnlocked = true; } },
    // 豆角
    { system: 'doujiao', id: 'plan', name: '升级 plan', desc: '+5% 消息工资 / -0.05 寿元消耗', costFor: s => SHB.planCosts[s.systems.doujiao.planLevel], max: SHB.const.MAX_PLAN, get: s => s.systems.doujiao.planLevel, apply: s => { s.systems.doujiao.planLevel++; } },
    { system: 'doujiao', id: 'search', name: '联网搜索', desc: '对话成功率 +15%', cost: 600, once: true, get: s => s.systems.doujiao.searchUnlocked, apply: s => { s.systems.doujiao.searchUnlocked = true; } },
    { system: 'doujiao', id: 'multi', name: '多模态', desc: '对话 10% 概率 +2 知识', cost: 1200, once: true, get: s => s.systems.doujiao.multimodalUnlocked, apply: s => { s.systems.doujiao.multimodalUnlocked = true; } },
    // 摸鱼
    { system: 'moyu', id: 'rarity', name: '升级鱼稀有度', desc: '提升每次摸鱼猫粮产出', costFor: s => (SHB.fishRarities[s.systems.moyu.fishRarity + 1] || {}).cost, max: 3, get: s => s.systems.moyu.fishRarity, apply: s => { s.systems.moyu.fishRarity++; } },
    { system: 'moyu', id: 'count', name: '鱼数量 +1', desc: '更多鱼可摸', costFor: s => [200, 600][s.systems.moyu.fishCount - 1], max: SHB.const.FISH_MAX_COUNT, get: s => s.systems.moyu.fishCount, apply: s => { s.systems.moyu.fishCount++; } },
    // 猫猫
    { system: 'cat', id: 'feeder', name: '自动喂猫器', desc: '开启后自动喂食', cost: 120, once: true, get: s => s.systems.cat.autoFeederUnlocked, apply: s => { s.systems.cat.autoFeederUnlocked = true; } },
    { system: 'cat', id: 'furball1', name: '毛球收购商 I', desc: '猫球兑换率 3→4', cost: 300, once: true, cond: s => s.systems.cat.furballRate === 3, get: s => s.systems.cat.furballRate >= 4, apply: s => { s.systems.cat.furballRate = 4; } },
    { system: 'cat', id: 'furball2', name: '毛球收购商 II', desc: '猫球兑换率 4→5', cost: 900, once: true, cond: s => s.systems.cat.furballRate === 4, get: s => s.systems.cat.furballRate >= 5, apply: s => { s.systems.cat.furballRate = 5; } },
    { system: 'cat', id: 'diet', name: '减肥粮', desc: '喂食体重 +2→+3', cost: 500, once: true, get: s => s.systems.cat.dietUnlocked, apply: s => { s.systems.cat.dietUnlocked = true; } },
    // 机械飞升
    { system: 'mecha', id: 'flag', name: '幡旗加固', desc: '「魂飞魄散」概率 2%→1%', cost: 800, once: true, get: s => s.systems.mecha.flagUpgrade, apply: s => { s.systems.mecha.flagUpgrade = true; } },
    { system: 'mecha', id: 'purify', name: '灵魂提纯', desc: '「百年魂」概率 8%→12%', cost: 1500, once: true, get: s => s.systems.mecha.purifyUpgrade, apply: s => { s.systems.mecha.purifyUpgrade = true; } },
    // 谷市
    { system: 'market', id: 'slot', name: '栏位 +1', desc: '包裹容量 +1', costFor: s => SHB.slotCosts[s.systems.market.slots - 3], max: SHB.const.SLOTS_MAX, get: s => s.systems.market.slots, apply: s => { s.systems.market.slots++; s.systems.market.slotsMax = s.systems.market.slots; } },
    // 推拿
    { system: 'massage', id: 'skill1', name: '手法精进 I', desc: '减耗 30%→40%，寿元上限 +10', cost: 600, once: true, get: s => s.systems.massage.skillLevel >= 1, apply: s => { s.systems.massage.skillLevel = 1; s.resources.lifespanMax += 10; s.resources.lifespan += 10; } },
    { system: 'massage', id: 'skill2', name: '手法精进 II', desc: '减耗 40%→50%，寿元上限 +10', cost: 1500, once: true, cond: s => s.systems.massage.skillLevel >= 1, get: s => s.systems.massage.skillLevel >= 2, apply: s => { s.systems.massage.skillLevel = 2; s.resources.lifespanMax += 10; s.resources.lifespan += 10; } },
    { system: 'massage', id: 'master', name: '老中医加持', desc: '骨折概率 -15%', cost: 900, once: true, get: s => s.systems.massage.masterUnlocked, apply: s => { s.systems.massage.masterUnlocked = true; } },
  ];

  // ---------------- 随机事件 ----------------
  // kind: good / bad / neutral；wellness: 养生类（卷王无效）；layoff: 裁员类（天选打工人免疫）
  // fx(s, rng) 直接改状态；text 为结果文案
  SHB.events = [
    { id: 'kpi', name: 'KPI 突击', kind: 'good', fx: s => { s.buffs.kpi = 10; }, text: '接下来 10 tick 企巨工资 +50%' },
    { id: 'incident', name: '线上事故', kind: 'bad', fx: s => { SHB.engine.deductSalary(s, 50); SHB.engine.marketShock(s, -0.2); }, text: '扣工资 50，谷价 -20%' },
    { id: 'teamdinner', name: '团建 AA', kind: 'bad', fx: s => { SHB.engine.deductSalary(s, 30); }, text: '周末团建（自愿参加），扣工资 30' },
    { id: 'cake', name: '被画饼', kind: 'neutral', fx: s => { s.buffs.cake = true; }, text: '被画饼：本次无产出，下次工资 ×3' },
    { id: 'reqchange', name: '需求变更', kind: 'bad', fx: s => { SHB.engine.markCancel(); }, text: '需求又变了，本 tick 白干' },
    { id: 'payday', name: '发薪日', kind: 'good', fx: s => { SHB.engine.earnSalary(s, s.stats.totalMessages * 2); }, text: '发薪日，工资 +（累计发消息数 ×2）' },
    { id: 'gossip', name: '内网匿名区吃瓜', kind: 'good', fx: (s, rng) => { if (rng() < 0.5) s.resources.knowledge += 1; else SHB.engine.earnSalary(s, 20); }, text: '吃瓜吃到 +1 知识 或 +20 工资' },
    { id: 'milktea', name: '奶茶续命', kind: 'good', wellness: true, fx: s => { s.resources.lifespan = Math.min(s.resources.lifespanMax, s.resources.lifespan + 3); }, text: '命是咖啡/奶茶给的，回 +3 寿元' },
    { id: 'coffee', name: '咖啡因依赖', kind: 'neutral', fx: s => { s.buffs.coffee = 5; }, text: '接下来 5 tick 消耗寿元 +0.5，但收益 +20%' },
    { id: 'toilet', name: '带薪拉屎', kind: 'good', cond: s => s.activeSystem === 'moyu', fx: s => { s.resources.catFood += 5; s.stats.totalCatFoodGained += 5; }, text: '厕所摸鱼，猫粮 +5' },
    { id: 'bossaway', name: '老板出差', kind: 'good', fx: s => { s.buffs.bossAway = 15; }, text: '接下来 15 tick 摸鱼被抓概率 -80%' },
    { id: 'meeting', name: '拉通对齐会', kind: 'bad', fx: s => { s.resources.lifespan -= 1; }, text: '开会消耗 1 寿元，无产出' },
    { id: 'gray', name: '灰度发布', kind: 'bad', cond: s => s.systems.market.unlocked, fx: s => { SHB.engine.marketShock(s, -0.1); }, text: '灰度发布，谷价 -10%' },
    { id: 'redpacket', name: '抢红包', kind: 'good', cond: s => s.activeSystem === 'qiju', fx: (s, rng) => { SHB.engine.earnSalary(s, 1 + Math.floor(rng() * 50)); }, text: '抢到群里红包' },
    { id: 'pot', name: '背锅', kind: 'bad', fx: s => { SHB.engine.deductSalary(s, 20); s.resources.knowledge += 1; }, text: '背锅：-20 工资，+1 知识（吃一堑长一智）' },
    { id: 'shirk', name: '甩锅', kind: 'good', fx: s => { s.buffs.shirk = true; }, text: '甩锅成功，下次扣工资减半' },
    { id: 'checkup', name: '体检报告正常', kind: 'good', wellness: true, once: true, flagKey: 'checkupDone', fx: s => { s.resources.lifespanMax = Math.min(SHB.const.LIFESPAN_MAX_ABS, s.resources.lifespanMax + 5); s.resources.lifespan += 5; }, text: '寿元上限 +5' },
    { id: 'layoff', name: '优化/毕业', kind: 'bad', layoff: true, fx: s => { SHB.engine.deductSalary(s, 100); }, text: '被优化（35 岁危机），扣工资 100' },
  ];
})();
