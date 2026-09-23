// ============================================================
// 前沿领域(Frontier) —— 研究阶段4 解锁的探索模式
// 解锁:成就"求知"(达到研究阶段4),奖励"解锁前沿领域"。
//
// 进入 / 退出前沿领域都会进行一次"研究重置":
//   想法数 ≥ 12 → 与普通研究重置一致:获得行动点、可推进研究阶段,
//                 并计入研究重置次数、刷新最快用时、可触发"高速研究"
//   想法数 < 12 → 只做重置:不获得行动点、不推进阶段,也不计入任何数据
//
// 前沿领域中:
//   理论2~5 被禁用(不显示、无法解锁),仅基础理论有效
//   以与知识获取速率相同的速率获得"灵感"(详见 updateFrontier)
//   灵感不随研究重置清空(长期资源)
//
// 灵感用于编写论文(论文升级,配置见 FRONTIER_CONFIG.papers):
//   摘要 —— 消耗 1e36 灵感解锁;此后知识边界 ×sqrt(1+灵感)
//   引言 —— 消耗 1e50 灵感解锁;解锁新的元-力量效果
// ============================================================


// ============================================================
// 配置
// ============================================================

// 论文升级列表(按此顺序展示)
// 购买状态存放于 game.<key>Unlocked(如 game.summaryUnlocked)
// 新增论文只需在此追加一项
const FRONTIER_CONFIG = {
    papers: [
        {
            key: "summary",
            name: "摘要",
            cost: new Decimal("1e36"),
            desc: "基于灵感,提高知识边界(知识边界 × sqrt(1+灵感))"
        },
        {
            key: "intro",
            name: "引言",
            cost: new Decimal("1e50"),
            desc: "解锁新的元-力量效果"
        }
    ]
};


// 按 key 取论文配置(找不到返回 null)
function paperConfig(key){

    for(let i = 0;
        i < FRONTIER_CONFIG.papers.length;
        i++){

        if(FRONTIER_CONFIG.papers[i].key === key)
            return FRONTIER_CONFIG.papers[i];

    }

    return null;

}


// 某篇论文是否已完成(购买状态字段:game.<key>Unlocked)
function paperOwned(key){
    return !!game[key + "Unlocked"];
}


// 前沿领域是否已解锁(成就"求知":达到研究阶段4)
function frontierUnlocked(){
    return isAchievementUnlocked("stage4");
}


// 当前是否处于前沿领域中
function frontierActive(){
    return !!game.frontierActive;
}


// 灵感(Decimal;兼容旧存档)
function frontierInspiration(){

    if(game.inspiration === undefined
        || game.inspiration === null)
        game.inspiration = new Decimal(0);

    return game.inspiration;

}


// 灵感获取速率(= 知识获取速率;不在前沿领域时为 0)
function frontierInspirationRate(){

    if(!frontierActive())
        return new Decimal(0);

    return getKnowledgeSpeed();

}


// 每 tick 累计灵感(仅前沿领域中)
function updateFrontier(dt){

    if(!frontierActive())
        return;

    let rate =
    frontierInspirationRate();

    if(rate.lte(0))
        return;

    game.inspiration =
    frontierInspiration().add(
        rate.mul(dt)
    );

}


// ============================================================
// 知识边界(受论文升级"摘要"影响)
// ============================================================

// 摘要是否已购买
function summaryUnlocked(){
    return paperOwned("summary");
}


// 引言是否已购买(解锁新的元-力量效果)
function introUnlocked(){
    return paperOwned("intro");
}


// 摘要对知识边界的加成倍率 = sqrt(1 + 灵感);未购买为 ×1
function summaryBoundaryBonus(){

    if(!summaryUnlocked())
        return new Decimal(1);

    return new Decimal(1)
    .add(frontierInspiration())
    .sqrt();

}


// 当前知识边界(基础 1.79e308 × 摘要加成)
// 注意:成就"无限"仍以基础边界 1.79e308 判定
function knowledgeLimit(){
    return KNOWLEDGE_LIMIT.mul(
        summaryBoundaryBonus()
    );
}


// ============================================================
// 进入 / 退出
// ============================================================

// 前沿领域进出的研究重置
//   想法数 ≥ 12(正常研究重置条件) → 视为一次正常重置:
//       正常结算(获得AP、可推进阶段),并计入次数 / 最快用时 / 高速研究
//   想法数 < 12 → 只做重置:不获得AP、不推进阶段,也不计入任何数据
function frontierReset(){

    let normal =
    game.ideas >= researchNeedIdeas();

    applyResearchResetCore(normal, normal);

    if(normal)
        recordResearchReset();

    saveGame();

    renderTheories();
    renderIdeaPage();
    renderResearchPage();

}


// 进入前沿领域(会触发研究重置)
function enterFrontier(){

    if(!frontierUnlocked() || frontierActive())
        return;

    game.frontierActive = true;

    frontierReset();

    saveGame();

}


// 退出前沿领域(会触发研究重置)
function exitFrontier(){

    if(!frontierActive())
        return;

    game.frontierActive = false;

    frontierReset();

    saveGame();

}


// 页面按钮:进入 / 退出切换
function toggleFrontier(){

    if(frontierActive())
        exitFrontier();
    else
        enterFrontier();

}


// ============================================================
// 论文升级
// ============================================================

// 购买一篇论文(一次性;摘要的效果随当前灵感动态变化)
// 返回: "ok" | "owned"(已完成) | "noinspiration"(灵感不足) | "none"(无此论文)
function buyPaper(key){

    let conf =
    paperConfig(key);

    if(!conf)
        return "none";

    if(paperOwned(key))
        return "owned";

    if(frontierInspiration().lt(conf.cost))
        return "noinspiration";

    game.inspiration =
    frontierInspiration().sub(conf.cost);

    game[key + "Unlocked"] = true;

    saveGame();

    renderFrontierPage();

    return "ok";

}


// 购买"摘要"
function buySummary(){
    return buyPaper("summary");
}


// 购买"引言"
function buyIntro(){
    return buyPaper("intro");
}


// ============================================================
// 界面渲染
// ============================================================

// 结构签名:解锁/激活/论文 状态变化时才重建 DOM(数值每 tick 更新)
let lastFrontierKey = "";


// 生成某篇论文卡片的 HTML
function paperCardHTML(p){

    let owned =
    paperOwned(p.key);

    let html =
    '<div class="paper-card' + (owned ? " owned" : "") + '">' +
    '<div class="paper-head">' +
    '<span class="paper-name">' + p.name + '</span>' +
    '<span class="paper-price">' + format(p.cost) + ' 灵感</span>' +
    '</div>' +
    '<div class="paper-desc">' + p.desc + '</div>';

    if(owned){

        html +=
        '<div class="paper-state">已完成</div>';

    }else{

        html +=
        '<button class="assistant-btn paper-buy"' +
        ' data-paper="' + p.key + '"' +
        ' onclick="buyPaper(\'' + p.key + '\')">' +
        '编写(消耗 ' + format(p.cost) + ' 灵感)' +
        '</button>';

    }

    html += '</div>';

    return html;

}


// 生成前沿领域面板 HTML
function buildFrontierHTML(){

    if(!frontierUnlocked())
        return "";

    let active =
    frontierActive();

    let html = "";

    html +=
    '<p class="research-hint">' +
    '在前沿领域中,大部分理论不再适用,但你能获得和知识等量的灵感。' +
    '灵感可用于编写论文,换取各种加成。' +
    '</p>';

    // 灵感(不在前沿领域时不增长)
    html +=
    '<div class="fr-res">灵感:<span class="fr-insp">0</span>' +
    (active
        ? '<span class="fr-rate-wrap">(+<span class="fr-rate">0</span>/秒)</span>'
        : '<span class="fr-rate-wrap">(仅在前沿领域中增长)</span>') +
    '</div>';

    // 知识边界
    html +=
    '<div class="fr-res">知识边界:<span class="fr-boundary">0</span> /s' +
    (summaryUnlocked()
        ? '<span class="fr-rate-wrap">(摘要 ×<span class="fr-boundary-mult">1</span>)</span>'
        : '') +
    '</div>';

    if(active){
        html +=
        '<p class="fr-warn">' +
        '理论2~5 在此失效,只有基础理论有效。' +
        '</p>';
    }

    // 进入 / 退出按钮
    html +=
    '<button class="fr-toggle-btn' + (active ? " active" : "") +
    '" onclick="toggleFrontier()">' +
    (active ? "退出前沿领域" : "进入前沿领域") +
    '</button>';

    html +=
    '<p class="research-hint">' +
    '进入与退出都会进行一次研究重置;想法不足 12 时只重置,不获得行动点,' +
    '也不计入研究重置次数与最快重置用时。' +
    '</p>';

    // 论文升级(按配置顺序渲染)
    html +=
    '<h3>论文</h3>';

    for(let i = 0;
        i < FRONTIER_CONFIG.papers.length;
        i++){

        html +=
        paperCardHTML(
            FRONTIER_CONFIG.papers[i]
        );

    }

    return html;

}


// 更新面板内某个数值文本
function setFrontierVal(panel, sel, val){

    if(!panel || !panel.querySelector)
        return;

    let el =
    panel.querySelector(sel);

    if(el && el.innerText !== String(val))
        el.innerText = String(val);

}


// 绘制前沿领域(子页面标签 / 顶部提示 / 面板)
function renderFrontierPage(){

    // 子页面标签:解锁后才出现
    let tab =
    document.getElementById("frontierNavTab");

    if(tab)
        tab.style.display =
        frontierUnlocked() ? "" : "none";

    // 标题下方的"正在前沿领域中"提示
    let banner =
    document.getElementById("frontierBanner");

    if(banner)
        banner.style.display =
        frontierActive() ? "block" : "none";

    let panel =
    document.getElementById("frontierPanel");

    if(!panel)
        return;

    // 结构签名:解锁 / 激活 / 各论文完成状态
    let keyParts = [
        frontierUnlocked() ? 1 : 0,
        frontierActive() ? 1 : 0
    ];

    for(let i = 0;
        i < FRONTIER_CONFIG.papers.length;
        i++){

        keyParts.push(
            paperOwned(
                FRONTIER_CONFIG.papers[i].key
            ) ? 1 : 0
        );

    }

    let key =
    keyParts.join(":");

    // 结构变化 → 重建(按钮用 onclick 内联,无需重新绑定)
    if(key !== lastFrontierKey){

        lastFrontierKey = key;

        let html =
        buildFrontierHTML();

        if(panel.innerHTML !== html)
            panel.innerHTML = html;

    }

    // 数值更新
    setFrontierVal(panel, ".fr-insp", format(frontierInspiration()));
    setFrontierVal(panel, ".fr-boundary", format(knowledgeLimit()));

    if(frontierActive())
        setFrontierVal(panel, ".fr-rate", format(frontierInspirationRate()));

    if(summaryUnlocked())
        setFrontierVal(panel, ".fr-boundary-mult", format(summaryBoundaryBonus()));

    // 论文按钮:灵感不足时禁用
    if(panel.querySelectorAll){

        let btns =
        panel.querySelectorAll(".paper-buy");

        for(let i = 0; i < btns.length; i++){

            let btn =
            btns[i];

            let pkey =
            (btn.dataset && btn.dataset.paper)
            ? btn.dataset.paper
            : null;

            if(!pkey)
                continue;

            let conf =
            paperConfig(pkey);

            if(conf)
                btn.disabled =
                !frontierInspiration().gte(conf.cost);

        }

    }

}
