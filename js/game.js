let game={


storyFinished:false,


knowledge:new Decimal(0),

lastSave:Date.now(),

// 想法系统:获得的"想法"数量(声望/重置货币)
ideas:0,

// 是否已看过"获得想法"剧情(仅第一次显示)
ideaStorySeen:false,

// 元-力量:基于想法数量产生,提升所有理论力量生产速度
metaPower:new Decimal(0),

// 时间碎片系统
// timeShards: 离线时间转化来的碎片(离线1秒→1碎片;储量上限)
// timeMult: 当前加速倍数(1=不加速;消耗碎片加速,倍率-1/秒)
timeShards:0,
timeMult:1,
debugSpeed:1,   // 兼容旧存档:旧调试速度(读取后迁移到 timeMult)

// 研究系统:第二声望层级
// 研究阶段(0 = 未解锁研究,1+ = 已进入研究阶段)
researchStage:0,

// 已进行的研究重置次数(里程碑效果依据)
researchResets:0,

// 行动点(研究重置获得,用于后续消费)
actionPoints:new Decimal(0),

// 是否已看过"研究解锁"剧情(仅第一次显示)
researchStorySeen:false,

// 三段后期剧情标记(仅各触发一次):
// firstResetHelperStorySeen: 第一次研究重置后(助手与实验介绍)
// stage3AutoStorySeen: 达到研究阶段3(重复实验与自动实验助手介绍)
// knowledgeLimitStorySeen: 知识速度达 1.79e308/s(知识边界介绍)
// stage4FrontierStorySeen: 达到研究阶段4(前沿领域介绍)
firstResetHelperStorySeen:false,
stage3AutoStorySeen:false,
knowledgeLimitStorySeen:false,
stage4FrontierStorySeen:false,

// 前沿领域(研究阶段4 解锁)
// frontierActive : 是否处于前沿领域中(理论2~5 不可用,但会产出灵感)
// inspiration    : 灵感(与知识获取速率相同速率增长;不随研究重置清空)
// summaryUnlocked: 论文升级"摘要"是否已购买(提高知识边界)
frontierActive:false,
inspiration:new Decimal(0),
summaryUnlocked:false,

// 成就系统:已达成成就登记 { id: true }
achievements:{},

// 高速研究计时(游戏总时间/上次研究重置时间/满足10秒标记)
totalTime:0,
lastResearchResetTime:null,
fastResearchFlag:false,

// 生涯统计(游戏统计页;累计值不清零,供跨重置展示)
// totalKnowledgeProduced:累计生产的知识总量
// totalIdeas:累计获得的想法数(研究重置清零 ideas 不影响此累计)
// maxIdeas:历史最高想法数
// totalResearchPoints:累计获得的研究点(行动点)
// fastestResearchReset:最快的一次研究重置用时(游戏时间秒;null=暂无)
totalKnowledgeProduced:new Decimal(0),
totalIdeas:0,
maxIdeas:0,
totalResearchPoints:new Decimal(0),
fastestResearchReset:null,

// 助手系统(消耗行动点解锁,解锁后可用开关控制)
// theorist: 理论研究员——自动解锁和升级理论
// ideaSorter: 想法整理员——自动进行想法重置
// researchSummarizer: 研究总结员——自动进行研究重置(阈值 AP)
assistants:{
theorist:{
unlocked:false,
enabled:true
},
ideaSorter:{
unlocked:false,
enabled:true
},
researchSummarizer:{
unlocked:false,
enabled:true,
threshold:5
},
expAuto1:{
unlocked:false,
enabled:true,
level:0
},
expAuto2:{
unlocked:false,
enabled:true,
level:0
},
expAuto3:{
unlocked:false,
enabled:true,
level:0
},
expAuto4:{
unlocked:false,
enabled:true,
level:0
}
},

// 实验系统(特色玩法,消耗行动点交互)
// exp1: 非线性元件测量
//   a/b/c: 玩家未知的伏安函数系数 f(U)=a*U+b*U^2+c*(e^U-1)
//   u0: 答案,即 I=1mA 时对应的电压 V(0~1V)
//   completed: 是否已达成 <0.005V 偏差完成实验
//   upgrades: 设备升级次数(0~6)
//   measurements: 历史测量结果 [{U, I}]
//   bestResult: 最佳提交 {U, deviation}
// 实验数据首次进入时生成并存档,之后保持不变
experiments:{},


theories:{


theory1:{
unlocked:false,
level:0,
power:new Decimal(1)
},


theory2:{
unlocked:false,
level:0,
power:new Decimal(1)
},


theory3:{
unlocked:false,
level:0,
power:new Decimal(1)
},


theory4:{
unlocked:false,
level:0,
power:new Decimal(1)
},


theory5:{
unlocked:false,
level:0,
power:new Decimal(1)
}


}



};
