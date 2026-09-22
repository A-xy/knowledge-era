// ============================================================
// 成就系统(Achievements)
// 成就页面:5 列 × n 行网格。格子未点亮/已点亮两态;
// 悬停显示成就名/内容/奖励/完成状态;达成时顶部弹提示。
// 奖励:时间碎片 或 解锁新内容(倍率档位/碎片储量/机制)。
// 检查:update() 集中调用 checkAchievements()(事件分散易漏)。
// ============================================================


// 成就定义(顺序即网格排列:每 5 个一行)
// id: 唯一标识  name: 成就名
// condDesc: 达成条件描述(悬停显示)
// rewardDesc: 奖励描述(悬停显示)
// shards: 达成奖励的时间碎片(无则 0/省略)
// unlock: 奖励解锁的特殊内容(可选;均为"实时查询"式解锁,不额外发放):
//   keep10    重置后保留 10 知识(想法/研究重置)
//   speed3    解锁 ×3 加速倍率
//   speed5    解锁 ×5 加速倍率
//   cap8h     时间碎片储量上限 → 8 小时
//   cap12h    时间碎片储量上限 → 12 小时
//   buyMax    全部最大按钮永久解锁(不被想法重置影响)
//   record    纯记录型(解锁内容由已有机制自动提供,仅登记)
// check: 达成条件函数
// 说明:格子上点击可选中,选中的成就会在上方详情面板中显示条件/奖励/状态。
const ACHIEVEMENT_LIST = [
    // ---- 第一行(理论) ----
    {
        id: "theory1",
        name: "开端",
        condDesc: "解锁基础理论",
        rewardDesc: "10 时间碎片",
        shards: 10,
        check: function(){ return !!game.theories.theory1.unlocked; }
    },
    {
        id: "theory2",
        name: "脚踏实地",
        condDesc: "解锁物质理论",
        rewardDesc: "20 时间碎片",
        shards: 20,
        check: function(){ return !!game.theories.theory2.unlocked; }
    },
    {
        id: "theory3",
        name: "守恒",
        condDesc: "解锁能量理论",
        rewardDesc: "30 时间碎片",
        shards: 30,
        check: function(){ return !!game.theories.theory3.unlocked; }
    },
    {
        id: "theory4",
        name: "大爆炸",
        condDesc: "解锁宇宙理论",
        rewardDesc: "40 时间碎片",
        shards: 40,
        check: function(){ return !!game.theories.theory4.unlocked; }
    },
    {
        id: "theory5",
        name: "终极理论吗?",
        condDesc: "解锁终极理论",
        rewardDesc: "解锁全部最大按钮",
        unlock: "buyMax",
        check: function(){ return !!game.theories.theory5.unlocked; }
    },
    // ---- 第二行(想法数,统计当前想法数) ----
    {
        id: "idea1",
        name: "第一个想法",
        condDesc: "拥有 1 想法",
        rewardDesc: "解锁 ×3 加速倍率",
        unlock: "speed3",
        check: function(){ return game.ideas >= 1; }
    },
    {
        id: "idea4",
        name: "更多加成",
        condDesc: "拥有 4 想法",
        rewardDesc: "60 时间碎片",
        shards: 60,
        check: function(){ return game.ideas >= 4; }
    },
    {
        id: "idea7",
        name: "自我提升",
        condDesc: "拥有 7 想法",
        rewardDesc: "60 时间碎片",
        shards: 60,
        check: function(){ return game.ideas >= 7; }
    },
    {
        id: "idea10",
        name: "多元想法",
        condDesc: "拥有 10 想法",
        rewardDesc: "60 时间碎片",
        shards: 60,
        check: function(){ return game.ideas >= 10; }
    },
    {
        id: "idea12",
        name: "整理一下想法?",
        condDesc: "拥有 12 想法",
        rewardDesc: "解锁研究",
        unlock: "record",
        check: function(){ return game.ideas >= 12; }
    },
    // ---- 第三行 ----
    {
        id: "stage1",
        name: "新篇之始",
        condDesc: "达到研究阶段 1",
        rewardDesc: "重置后保留 10 知识",
        unlock: "keep10",
        check: function(){ return game.researchStage >= 1; }
    },
    {
        id: "exp1",
        name: "思路导通",
        condDesc: "完成实验1",
        rewardDesc: "120 时间碎片",
        shards: 120,
        check: function(){ return !!(game.experiments && game.experiments.exp1 && game.experiments.exp1.completed); }
    },
    {
        id: "twoHelpers",
        name: "解放双手",
        condDesc: "购买前两个助手",
        rewardDesc: "时间碎片上限增加到 8 小时",
        unlock: "cap8h",
        check: function(){
            return !!(game.assistants && game.assistants.theorist && game.assistants.theorist.unlocked
                && game.assistants.ideaSorter && game.assistants.ideaSorter.unlocked);
        }
    },
    {
        id: "exp2",
        name: "节拍",
        condDesc: "完成实验2",
        rewardDesc: "120 时间碎片",
        shards: 120,
        check: function(){ return !!(game.experiments && game.experiments.exp2 && game.experiments.exp2.completed); }
    },
    {
        id: "googol",
        name: "古戈尔",
        condDesc: "达到 1e100 知识",
        rewardDesc: "120 时间碎片",
        shards: 120,
        check: function(){ return game.knowledge.gte(new Decimal("1e100")); }
    },
    // ---- 第四行 ----
    {
        id: "stage2",
        name: "领域拓展",
        condDesc: "达到研究阶段 2",
        rewardDesc: "解锁新的助手和实验3,4",
        unlock: "record",
        check: function(){ return game.researchStage >= 2; }
    },
    {
        id: "exp3",
        name: "梯度下降",
        condDesc: "完成实验3",
        rewardDesc: "120 时间碎片",
        shards: 120,
        check: function(){ return !!(game.experiments && game.experiments.exp3 && game.experiments.exp3.completed); }
    },
    {
        id: "exp4",
        name: "生命本源",
        condDesc: "完成实验4",
        rewardDesc: "120 时间碎片",
        shards: 120,
        check: function(){ return !!(game.experiments && game.experiments.exp4 && game.experiments.exp4.completed); }
    },
    {
        id: "fastResearch",
        name: "高速研究",
        condDesc: "在游戏时间 " + RESEARCH_CONFIG.fastResearchWindow +
            " 秒内完成一次研究重置",
        rewardDesc: "解锁 ×5 加速倍率",
        unlock: "speed5",
        check: function(){ return !!game.fastResearchFlag; }
    },
    {
        id: "research10",
        name: "项目迭代",
        condDesc: "进行 10 次研究重置",
        rewardDesc: "120 时间碎片",
        shards: 120,
        check: function(){ return game.researchResets >= 10; }
    },
    // ---- 第五行 ----
    {
        id: "stage3",
        name: "全自动化",
        condDesc: "达到研究阶段 3",
        rewardDesc: "时间碎片上限增加到 12 小时",
        unlock: "cap12h",
        check: function(){ return game.researchStage >= 3; }
    },
    {
        id: "allAutoHelpers",
        name: "解放双手II",
        condDesc: "解锁所有自动实验助手",
        rewardDesc: "180 时间碎片",
        shards: 180,
        check: function(){
            let all = true;
            for(let i = 1; i <= 4; i++){
                let a = game.assistants["expAuto" + i];
                if(!a || !a.unlocked) all = false;
            }
            return all;
        }
    },
    {
        id: "optimizeAll",
        name: "终极优化",
        condDesc: "最优化全部四个实验",
        rewardDesc: "180 时间碎片",
        shards: 180,
        check: function(){
            let keys = ["exp1", "exp2", "exp3", "exp4"];
            for(let i = 0; i < keys.length; i++){
                let opt = expOptimalOps(keys[i]);
                let e = game.experiments[keys[i]];
                if(opt === null || !e || e.bestOperations === null
                    || e.bestOperations === undefined
                    || e.bestOperations > opt)
                    return false;
            }
            return true;
        }
    },
    {
        id: "repeat100",
        name: "重复实验",
        condDesc: "四个实验的完成次数总和达到 100",
        rewardDesc: "180 时间碎片",
        shards: 180,
        check: function(){
            let total = 0;
            for(let i = 1; i <= 4; i++)
                total += expCompletions("exp" + i);
            return total >= 100;
        }
    },
    {
        id: "infinity",
        name: "无限",
        condDesc: "达到 1.79e308 知识",
        rewardDesc: "180 时间碎片",
        shards: 180,
        check: function(){
            return game.knowledge.gte(KNOWLEDGE_LIMIT);
        }
    },
    // ---- 第六行 ----
    {
        id: "stage4",
        name: "求知",
        condDesc: "达到研究阶段 4",
        rewardDesc: "解锁前沿领域",
        unlock: "record",
        check: function(){ return game.researchStage >= 4; }
    }
];


// 成就是否已达成(含检查通过但未登记的运行时查询)
function isAchievementDone(id){
    if(game.achievements && game.achievements[id])
        return true;
    for(let i = 0; i < ACHIEVEMENT_LIST.length; i++){
        let a = ACHIEVEMENT_LIST[i];
        if(a.id === id)
            return a.check();
    }
    return false;
}


// 是否已登记达成(存档)
function isAchievementUnlocked(id){
    return !!(game.achievements && game.achievements[id]);
}


// 达成时的奖励逻辑(登记 + 发碎片/解锁)
function grantAchievement(id){
    if(isAchievementUnlocked(id))
        return;
    if(!game.achievements)
        game.achievements = {};
    game.achievements[id] = true;
    let conf = null;
    for(let i = 0; i < ACHIEVEMENT_LIST.length; i++){
        if(ACHIEVEMENT_LIST[i].id === id){ conf = ACHIEVEMENT_LIST[i]; break; }
    }
    if(!conf) return;
    // 奖励:先解锁上限/机制(储量的成就要先扩容再发碎片,避免被旧上限截断)
    if(conf.unlock === "cap8h" || conf.unlock === "cap12h"){
        // 储量上限由 timeMaxShards() 依据成就实时计算,无需额外动作
    }
    // 发时间碎片
    if(conf.shards){
        game.timeShards = Math.min(
            (game.timeShards || 0) + conf.shards,
            timeMaxShards()
        );
    }
    // 弹提示
    showAchievementToast(conf);
    saveGame();
    renderAchievementsPage();
    renderTimePage();
}


// 集中检查所有未达成成就(update 中调用)
function checkAchievements(){
    if(!game) return;
    let any = false;
    for(let i = 0; i < ACHIEVEMENT_LIST.length; i++){
        let a = ACHIEVEMENT_LIST[i];
        if(isAchievementUnlocked(a.id))
            continue;
        if(a.check()){
            grantAchievement(a.id);
            any = true;
        }
    }
    // 高速研究标记一次性消耗
    if(game.fastResearchFlag && !isAchievementUnlocked("fastResearch")){
        // 保留给成就检查使用;达成后清空
    }
    if(any){
        // 存档在 grantAchievement 内已保存
    }
}


// 成就达成弹提示(顶部显示数秒后消失)
let toastTimer = null;
function showAchievementToast(conf){
    let toast = document.getElementById("achvToast");
    if(!toast) return;
    toast.innerHTML =
    "获得成就:" + conf.name +
    " 奖励:" + conf.rewardDesc;
    toast.style.display = "block";
    if(toastTimer){
        clearTimeout(toastTimer);
        toastTimer = null;
    }
    toastTimer = setTimeout(function(){
        toast.style.display = "none";
    }, 4000);
}


// ============================================================
// 成就页面渲染(5 列网格 + 点击选中详情)
// ============================================================
function renderAchievementsPage(){

    let panel =
    document.getElementById(
        "achvPanel"
    );

    if(!panel)
        return;

    // 增量:仅达成数量/状态变化时重建
    let doneCount = 0;
    let key = "";

    for(let i = 0; i < ACHIEVEMENT_LIST.length; i++){

        let a =
        ACHIEVEMENT_LIST[i];

        let done =
        isAchievementUnlocked(a.id);

        if(done)
            doneCount++;

        key += (done ? "1" : "0");

    }

    if(lastAchvKey !== key){

        lastAchvKey = key;

        let summary =
        document.getElementById(
            "achvSummary"
        );

        if(summary)
            summary.innerText =
            doneCount + " / " + ACHIEVEMENT_LIST.length + " 已达成";

        // 5 列网格:格子里显示成就名(未点亮灰暗/已点亮金色发光)
        let html =
        '<div class="achv-grid">';

        for(let i = 0; i < ACHIEVEMENT_LIST.length; i++){

            let a =
            ACHIEVEMENT_LIST[i];

            let done =
            isAchievementUnlocked(a.id);

            let tip =
            a.name + " - " + a.condDesc + ";奖励:" +
            a.rewardDesc + ";" +
            (done ? "已完成" : "未完成");

            let sel =
            (a.id === selectedAchvId) ? " sel" : "";

            html +=
            '<div class="achv-cell' + (done ? " lit" : "") + sel +
            '" data-achv="' + a.id + '" title="' + tip + '">' +
            a.name +
            '</div>';

        }

        html += '</div>';

        panel.innerHTML = html;

        // 点击格子 → 选中并在上方显示详情
        let cells =
        panel.querySelectorAll
        ? panel.querySelectorAll(".achv-cell")
        : [];

        for(let i = 0; i < cells.length; i++){

            cells[i].addEventListener("click", function(){

                selectedAchvId = this.dataset.achv;

                for(let j = 0; j < cells.length; j++){

                    if(cells[j].dataset.achv === selectedAchvId)
                        cells[j].classList.add("sel");
                    else
                        cells[j].classList.remove("sel");

                }

                renderAchvDetail();

            });

        }

    }

    // 详情面板每 tick 刷新(内容不变时不重建 DOM)
    renderAchvDetail();

}


let lastAchvKey = "";


// ============================================================
// 选中成就详情(网格上方)
// ============================================================
// 当前被选中的成就 id(点击格子设置;null = 未选中,面板隐藏)
let selectedAchvId = null;


// 按 id 取成就配置
function achvById(id){

    for(let i = 0; i < ACHIEVEMENT_LIST.length; i++){

        if(ACHIEVEMENT_LIST[i].id === id)
            return ACHIEVEMENT_LIST[i];

    }

    return null;

}


// 绘制选中成就详情(未选中时隐藏)
function renderAchvDetail(){

    let box =
    document.getElementById(
        "achvDetail"
    );

    if(!box)
        return;

    let a =
    selectedAchvId
    ? achvById(selectedAchvId)
    : null;

    if(!a){

        box.style.display = "none";

        if(box.innerHTML !== "")
            box.innerHTML = "";

        return;

    }

    let done =
    isAchievementUnlocked(a.id);

    let html =
    '<div class="achv-detail-head">' +
    a.name +
    '<span class="achv-detail-state' + (done ? " done" : "") + '">' +
    (done ? "已达成" : "未达成") +
    '</span></div>' +
    '<div class="achv-detail-line">达成条件:' + a.condDesc + '</div>' +
    '<div class="achv-detail-line">奖励:' + a.rewardDesc + '</div>';

    if(box.innerHTML !== html)
        box.innerHTML = html;

    box.style.display = "block";

}


// 成就页面初始化入口(页面可见时渲染,update 中调用)
function updateAchievementsUI(){
    checkAchievements();
    renderAchievementsPage();
}
