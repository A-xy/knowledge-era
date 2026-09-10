// ============================================================
// 展示面板(Stats)
// 显示知识产出/理论力量/元-力量产出的加成分解,
// 帮助玩家发现主要提升来源(哪个乘区是瓶颈)。
//
// 注意:后续引入新加成时,记得在这里同步补充对应条目。
// 所有数值直接复用现有的公式函数,不重复计算。
// ============================================================


// 结构签名:解锁理论数/里程碑/效果解锁变化时重建 DOM
// (数值变化只更新文本,不重建,保持 details 展开状态)
let lastStatsKey = "";

function statsKey(){

    let unlocked = 0;

    for(let id in game.theories){
        if(game.theories[id].unlocked)
            unlocked++;
    }

    return [
        unlocked,
        isMilestoneActive("stage1") ? 1 : 0,
        isEffectUnlocked("metaGain") ? 1 : 0,
        game.ideas >= 4 ? 1 : 0   // 升级倍率效果影响理论力量分解
    ].join(":");

}


// 绘制展示面板(增量更新)
function renderStatsPage(){

    let panel =
    document.getElementById(
        "statsPanel"
    );

    if(!panel)
        return;

    let key = statsKey();

    if(key !== lastStatsKey){

        lastStatsKey = key;

        panel.innerHTML =
        buildStatsHTML();

    }

    updateStatVals();

}


// 生成面板 HTML(折叠结构,默认不展开)
function buildStatsHTML(){

    let html = "";

    // ---------- 知识产出 ----------
    html +=
    '<details class="stat-group">' +
    '<summary>知识产出:<span class="stat-val" data-key="kps"></span>/s</summary>' +
    '<div class="stat-line">基础值:1/s</div>';

    for(let id in game.theories){

        let t =
        game.theories[id];

        if(!t.unlocked)
            continue;

        html +=
        '<div class="stat-line">' +
        id.replace("theory", "理论") +
        '力量:×<span class="stat-val" data-key="tp_' + id + '"></span></div>';

    }

    if(isMilestoneActive("stage1")){
        html +=
        '<div class="stat-line">研究加成(阶段1):×<span class="stat-val" data-key="resKnow"></span></div>';
    }

    // 知识边界(软上限):显示知识生产被除以的倍数(= 原始速度 / 受限后速度)
    html +=
    '<div class="stat-line">知识边界:÷<span class="stat-val" data-key="knowledgeCap"></span></div>';

    html += '</details>';

    // ---------- 理论力量 ----------
    html +=
    '<details class="stat-group">' +
    '<summary>理论力量</summary>';

    for(let id in game.theories){

        let t =
        game.theories[id];

        if(!t.unlocked)
            continue;

        html +=
        '<details class="stat-sub">' +
        '<summary>' +
        id.replace("theory", "理论") +
        '力量产出:<span class="stat-val" data-key="tg_' + id + '"></span>/s</summary>' +
        '<div class="stat-line">基础值:0.1/s</div>' +
        '<div class="stat-line">理论升级:×<span class="stat-val" data-key="rateNum_' + id + '"></span>^<span class="stat-val" data-key="levelNum_' + id + '"></span> = <span class="stat-val" data-key="rate_' + id + '"></span></div>' +
        '<div class="stat-line">元-力量:×(1+<span class="stat-val" data-key="mpNum_' + id + '"></span>)^<span class="stat-val" data-key="exp1Num_' + id + '"></span> = <span class="stat-val" data-key="meta_' + id + '"></span></div>';

        // 重复完成实验4:理论力量 ×completions²(融入各理论力量)
        html +=
        '<div class="stat-line">重复实验4加成:×<span class="stat-val" data-key="exp4Mult"></span>(完成 <span class="stat-val" data-key="exp4C"></span> 次)</div>';

        if(isMilestoneActive("stage1")){
            html +=
            '<div class="stat-line">研究加成(阶段1):×<span class="stat-val" data-key="res_' + id + '"></span></div>';
        }

        html += '</details>';

    }

    html += '</details>';

    // ---------- 元-力量产出 ----------
    html +=
    '<details class="stat-group">' +
    '<summary>元-力量产出:<span class="stat-val" data-key="mpg"></span>/s</summary>' +
    '<div class="stat-line">基础值:0.1/s</div>' +
    '<div class="stat-line">想法:×<span class="stat-val" data-key="mpBaseNum"></span>^(<span class="stat-val" data-key="mpIdeasNum"></span>-1) = <span class="stat-val" data-key="mpbase"></span></div>';

    // 重复完成实验2:底数额外 +0.1ln(融入想法/底数)
    html +=
    '<div class="stat-line">重复实验2加成:底数额外 +<span class="stat-val" data-key="exp2Add"></span>(完成 <span class="stat-val" data-key="exp2C"></span> 次)</div>';

    if(isEffectUnlocked("metaGain")){
        html +=
        '<div class="stat-line">元-力量效果3:×<span class="stat-val" data-key="mpgain"></span></div>';
    }

    // 重复完成实验1:元-力量生产 ×completions(融入元-力量产出)
    html +=
    '<div class="stat-line">重复实验1加成:×<span class="stat-val" data-key="exp1Mult"></span>(完成 <span class="stat-val" data-key="exp1C"></span> 次)</div>';

    html += '</details>';

    // ---------- 想法价格(实验3 效果:价格膨胀起始点延后) ----------
    html +=
    '<details class="stat-group">' +
    '<summary>想法价格</summary>' +
    '<div class="stat-line">下个想法价格:<span class="stat-val" data-key="ideaCostVal"></span></div>' +
    '<div class="stat-line">价格膨胀起始点 N:<span class="stat-val" data-key="ideaN"></span>(基础 10 + 实验3效果 <span class="stat-val" data-key="exp3EffectVal"></span>)</div>' +
    // 重复完成实验3:想法花费 ÷completions^10(融入想法价格)
    '<div class="stat-line">重复实验3加成:想法花费 ÷<span class="stat-val" data-key="exp3Div"></span>(完成 <span class="stat-val" data-key="exp3C"></span> 次)</div>' +
    '</details>';

    // ---------- 理论升级价格(实验4 效果:膨胀起始点延后) ----------
    // N 取理论1 的实际配置(getTheoryPrice),非全局默认值
    let t1N = getTheoryPrice("theory1").N;
    html +=
    '<details class="stat-group">' +
    '<summary>理论升级价格</summary>' +
    '<div class="stat-line">理论1升级价格:<span class="stat-val" data-key="tUpCost1"></span></div>' +
    '<div class="stat-line">理论1价格膨胀起始等级 N:<span class="stat-val" data-key="tUpN"></span>(基础 ' + t1N + ' + 实验4效果 <span class="stat-val" data-key="exp4EffectVal"></span>)</div>' +
    '</details>';

    // ---------- 实验完成次数生产速率(自动实验助手,研究阶段3) ----------
    html +=
    '<details class="stat-group">' +
    '<summary>实验完成次数生产速率</summary>' +
    '<div class="stat-line">实验1:<span class="stat-val" data-key="expAutoRate1"></span>/s</div>' +
    '<div class="stat-line">实验2:<span class="stat-val" data-key="expAutoRate2"></span>/s</div>' +
    '<div class="stat-line">实验3:<span class="stat-val" data-key="expAutoRate3"></span>/s</div>' +
    '<div class="stat-line">实验4:<span class="stat-val" data-key="expAutoRate4"></span>/s</div>' +
    '</details>';

    return html;

}


// 更新所有数值文本
function updateStatVals(){

    // 知识产出
    setStat("kps", getKnowledgeSpeed());

    for(let id in game.theories){

        let t =
        game.theories[id];

        if(!t.unlocked)
            continue;

        setStat("tp_" + id, t.power);

    }

    if(isMilestoneActive("stage1"))
        setStat("resKnow", researchPowerBonus());

    // 知识边界:软上限使知识生产除以的倍数(原始速度/受限后速度,未超限=1)
    setStat("knowledgeCap", knowledgeCapDivisor());

    // 理论力量
    for(let id in game.theories){

        let t =
        game.theories[id];

        if(!t.unlocked)
            continue;

        setStat("tg_" + id, theoryPowerGain(id));

        let rate =
        isEffectUnlocked("upgradeRate")
        ? metaUpgradeRate()
        : new Decimal(2);

        // 理论升级:具体 rate 与 level
        setStat("rateNum_" + id, rate);
        setStat("levelNum_" + id, t.level);
        setStat("rate_" + id, Decimal.pow(rate, t.level));

        // 元-力量:具体 metaPower 与 exp1Exponent
        setStat("mpNum_" + id, game.metaPower);
        setStat("exp1Num_" + id, exp1Exponent());
        setStat("meta_" + id, metaPowerBonus());

        if(isMilestoneActive("stage1"))
            setStat("res_" + id, researchPowerBonus());

    }

    // 元-力量产出
    setStat("mpg", metaPowerGain());

    // 想法:具体 exp2Base() 与 ideas 数
    setStat("mpBaseNum", exp2Base());
    setStat("mpIdeasNum", game.ideas);
    setStat(
        "mpbase",
        Decimal.pow(
            exp2Base(),
            Math.max(game.ideas - 1, 0)
        )
    );

    if(isEffectUnlocked("metaGain"))
        setStat("mpgain", metaGainBonus());

    // 想法价格
    setStat("ideaCostVal", ideaCost());
    setStat("ideaN", IDEA_PRICE.N + exp3Effect());
    setStat("exp3EffectVal", exp3Effect());

    // 理论升级价格(实验4)
    setStat("tUpCost1", theoryUpgradeCost("theory1"));
    setStat("tUpN", getTheoryPrice("theory1").N + exp4Effect());
    setStat("exp4EffectVal", exp4Effect());

    // 重复完成实验加成(显示实际效果值)
    setStat("exp1C", expCompletions("exp1"));
    setStat("exp1Mult", exp1CompletionBonus());
    setStat("exp2C", expCompletions("exp2"));
    setStat("exp2Add", exp2CompletionBonus());
    setStat("exp3C", expCompletions("exp3"));
    setStat("exp3Div", exp3CompletionDivisor());
    setStat("exp4C", expCompletions("exp4"));
    setStat("exp4Mult", exp4CompletionBonus());

    // 实验完成次数生产速率(自动实验助手)
    setStat("expAutoRate1", expAutoRate("expAuto1"));
    setStat("expAutoRate2", expAutoRate("expAuto2"));
    setStat("expAutoRate3", expAutoRate("expAuto3"));
    setStat("expAutoRate4", expAutoRate("expAuto4"));

}


// ============================================================
// 游戏统计(Game Stats) —— 统计页"游戏统计"子页
// 生涯累计数据,部分行按游戏进度解锁显示:
//   基础   : 游戏时间
//   想法解锁后 : 累计生产知识 / 累计获得想法 / 历史最高想法
//   研究解锁后 : 累计获得研究点 / 研究重置次数
//   研究阶段3后: 最快研究重置用时 / 实验完成总次数
// ============================================================

// 组可见签名(想法/研究/阶段3),变化时重建 DOM
let lastGameStatsKey = "";

function gameStatsKey(){

    return [
        (game.totalIdeas > 0 || game.ideaStorySeen) ? 1 : 0,
        (game.researchResets > 0 || game.researchStage >= 1
            || game.researchStorySeen) ? 1 : 0,
        (game.researchStage >= 3) ? 1 : 0
    ].join(":");

}


// 格式化游戏时间(秒 → 天/时/分/秒)
function formatGameTime(sec){

    sec = Math.max(0, Math.floor(sec));

    let d = Math.floor(sec / 86400);
    let h = Math.floor((sec % 86400) / 3600);
    let m = Math.floor((sec % 3600) / 60);
    let s = sec % 60;

    if(d > 0)
        return d + " 天 " + h + " 小时 " + m + " 分";

    if(h > 0)
        return h + " 小时 " + m + " 分 " + s + " 秒";

    if(m > 0)
        return m + " 分 " + s + " 秒";

    return s + " 秒";

}


// 绘制游戏统计(每 tick 调用;组状态变化才重建)
function renderGameStats(){

    let panel =
    document.getElementById(
        "statsGamePanel"
    );

    if(!panel)
        return;

    let key = gameStatsKey();

    let parts = key.split(":");

    let showIdea =
    parts[0] === "1";

    let showResearch =
    parts[1] === "1";

    let showStage3 =
    parts[2] === "1";

    if(key !== lastGameStatsKey){

        lastGameStatsKey = key;

        let html =
        '<div class="game-stat">你一共玩了<span class="stat-val gs-time"></span>(游戏时间)</div>';

        if(showIdea){
            html +=
            '<div class="game-stat">你一共生产了<span class="stat-val gs-produced"></span>知识</div>' +
            '<div class="game-stat">你累计获得了<span class="stat-val gs-totalideas"></span>想法</div>' +
            '<div class="game-stat">你的历史最高想法数是<span class="stat-val gs-maxideas"></span></div>';
        }

        if(showResearch){
            html +=
            '<div class="game-stat">你累计获得了<span class="stat-val gs-totalap"></span>研究点</div>' +
            '<div class="game-stat">你一共进行了<span class="stat-val gs-resets"></span>次研究重置</div>';
        }

        if(showStage3){
            html +=
            '<div class="game-stat">最快的研究重置用时<span class="stat-val gs-fastest"></span></div>' +
            '<div class="game-stat">所有实验合计已完成<span class="stat-val gs-expall"></span>次</div>';
        }

        panel.innerHTML = html;

    }

    // 数值更新
    let set = function(sel, val){
        let el =
        panel.querySelector(
            sel
        );
        if(el && el.innerText !== String(val))
            el.innerText = String(val);
    };

    set(".gs-time", formatGameTime(game.totalTime || 0));

    if(showIdea){
        set(".gs-produced", format(
            game.totalKnowledgeProduced || 0
        ));
        set(".gs-totalideas", game.totalIdeas || 0);
        set(".gs-maxideas", game.maxIdeas || 0);
    }

    if(showResearch){
        set(".gs-totalap", format(
            game.totalResearchPoints || 0
        ));
        set(".gs-resets", game.researchResets || 0);
    }

    if(showStage3){
        let fastest =
        (game.fastestResearchReset === null
            || game.fastestResearchReset === undefined)
        ? "-"
        : formatGameTime(game.fastestResearchReset);
        set(".gs-fastest", fastest);
        set(".gs-expall", totalExpCompletions());
    }

}


// 四个实验完成次数总和(自动实验助手/重复完成累计;未解锁实验为 0)
function totalExpCompletions(){

    let total = 0;

    for(let i = 1; i <= 4; i++)
        total += expCompletions("exp" + i);

    return total;

}


// 设置某个数值文本
function setStat(key, val){

    let els =
    document.querySelectorAll(
        '.stat-val[data-key="' + key + '"]'
    );

    for(let i = 0; i < els.length; i++){

        if(els[i])
            els[i].innerText = format(val);

    }

}
