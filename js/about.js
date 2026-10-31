// ============================================================
// 关于页面(About) —— "游戏介绍"子页渲染
// 每个主题显示标题,点击标题展开/收起详细说明。
// 部分主题按游戏进度解锁显示:
//   研究 : 完成解锁研究的成就(整理一下想法?,12 想法)
//   助手/实验 : 研究重置一次后
//   阶段3追加内容 : 达到研究阶段3(助手/实验的补充说明)
//   前沿领域 : 达到研究阶段4
// ⚠ 解锁是"永久"的:登记在 game.permaUnlocks(见 game.js 的
//   PERMA_UNLOCK_LIST),完成研究把研究阶段清零后这些说明不会消失。
// 更新日志为静态内容,直接写在 index.html 中。
// ============================================================


// 展开状态(按主题 id 记忆;重建 DOM 后保留)
let aboutExpand = {};


// 组可见签名(研究解锁/研究重置/阶段3),变化时重建 DOM
let lastAboutKey = "";

function aboutKey(){
    return [
        permaUnlock("research") ? 1 : 0,
        permaUnlock("reset1") ? 1 : 0,
        permaUnlock("stage3") ? 1 : 0,
        // 研究阶段4:显示"前沿领域"主题
        permaUnlock("frontier") ? 1 : 0,
        // 本源层:显示"本源"与"你的理论"主题
        permaUnlock("origin") ? 1 : 0,
        permaUnlock("ownTheory") ? 1 : 0,
        // 发现拓展理论(理论6)后,"理论共有几种"的文案要跟着变
        theoryKindCount()
    ].join(":");
}


// 理论种类数:未发现拓展理论时为 5,发现后为 6
// 用"已发现"标记(theory6StorySeen)而非 unlocked 判断:
// 理论6 会随研究重置被清空,但玩家一旦发现过,就应始终看到"共有6种"
function theoryKindCount(){
    return (typeof game !== "undefined" && game.theory6StorySeen) ? 6 : 5;
}


// 主题定义(顺序即显示顺序)
// id: 唯一标识  title: 标题
// visible: 是否显示
// paras: 展开后显示的段落
// stage3Paras: 研究阶段3后追加的段落(可选)
// 段落可写成字符串(静态)或函数(按当前进度动态求值)
const ABOUT_SECTIONS = [
    {
        id: "theory",
        title: "理论",
        visible: function(){ return true; },
        paras: [
            function(){
                return "理论共有" + theoryKindCount() +
                "种,在解锁后会产出理论力量,消耗知识升级以生产更多理论力量。知识的生产会乘以各个理论力量的乘积。";
            },
            "当理论的等级达到5后,升级理论的价格增长会加快,即价格膨胀。"
        ]
    },
    {
        id: "time",
        title: "时间",
        visible: function(){ return true; },
        paras: [
            "在离线时,每1秒的离线时间会转化为1个时间碎片,获得一些成就也会奖励时间碎片。时间碎片可以用于加速游戏中的时间流速,加速倍率越大,消耗时间碎片越快。通过成就可以提升时间碎片的储存上限并解锁更高的加速倍率。"
        ]
    },
    {
        id: "idea",
        title: "想法",
        visible: function(){ return true; },
        paras: [
            "达到一定知识后,可以重置知识和理论以获得想法,之后获得下个想法的花费会提高,并在超过10个想法后有类似的价格膨胀。",
            "基于想法数量可以产出元-力量,最初可以提升所有理论力量的生产,随着想法数的增加,还会解锁更多效果。"
        ]
    },
    {
        id: "research",
        title: "研究",
        visible: function(){ return permaUnlock("research"); },
        paras: [
            "达到12个想法后,你将可以进行研究重置。研究重置可以基于知识获取行动点,此外,如果重置时达到了一定的想法数,还能推进研究阶段。通过推进研究阶段可以完成相应的里程碑。"
        ]
    },
    {
        id: "helpers",
        title: "助手",
        visible: function(){ return permaUnlock("reset1"); },
        paras: [
            "花费行动点可以招募助手,提供一些实用的自动化功能。"
        ],
        stage3Paras: [
            "自动实验助手还可以帮你自动完成实验,在实验达到最优化之前,自动实验助手的效率与你进行此实验的最优操作次数反比。",
            "自动实验助手可以升级以提高效率,每次升级乘以升级底数(初始为2倍)。等级达到10后,升级的价格增长会加快,即价格膨胀。"
        ]
    },
    {
        id: "experiments",
        title: "实验",
        visible: function(){ return permaUnlock("reset1"); },
        paras: [
            "实验是一些交互性的问题,你可以通过消耗行动点来进行测量,提交答案或改进实验,基于提交的答案与预设的正确答案接近程度提供加成,达到最高的加成时即可完成实验。"
        ],
        stage3Paras: [
            "你也可以重新开始已完成的实验,实验原来的效果和相应的升级会保留,但会重新生成一个答案。在每个实验中,完成实验所用的最少操作次数,即测量和提交答案次数的总和将被记录并决定自动实验助手的效率,同时实验完成次数也会提供加成。",
            "当四个实验的最少操作次数分别达到9,20,20,6时,记作已经最优化了相应实验,此时自动实验助手将达到最大效率。"
        ]
    },
    {
        id: "frontier",
        title: "前沿领域",
        visible: function(){ return permaUnlock("frontier"); },
        paras: [
            "你可以随时进入和退出前沿领域,但这样做时将进行一次研究重置。",
            "在前沿领域中,你无法解锁理论2~5,但你能获得和知识等量的灵感。",
            "灵感可以用于论文升级,提供各种加成。",
            "同一行的论文升级只能获取一个。此外,一些升级会额外需要一些条件才能获取,达到需要的条件即可,不消耗相应资源。你也可以重置某一行的升级,这样会同样进行一次研究重置。"
        ]
    },
    {
        id: "origin",
        title: "本源",
        visible: function(){ return permaUnlock("origin"); },
        paras: [
            "本源是游戏的第三个重置层级。当你获得论文升级「结论」后,将可以完成研究并获得本源。",
            "完成研究会重置研究层级的大部分内容,不过你也可以基于完成研究的次数获得里程碑。",
            "本源的获取基于行动点和研究阶段。",
            "本源可以用于购买本源升级,以提供各种加成。"
        ]
    },
    {
        id: "ownTheory",
        title: "你的理论",
        visible: function(){ return permaUnlock("ownTheory"); },
        paras: [
            "你的理论和其它理论一样具有理论力量,力量的产出受到未分配的定理的加成。",
            "你的理论的效果由理论力量和公式决定。",
            "定理可以分别通过达到一定的知识,累计行动点和累计本源来获取;定理可以用于购买升级以提升公式或理论力量的效果。",
            "完成研究或购买定理升级后会重置你的理论力量。",
            "你的理论力量不受其它对理论力量的加成影响。"
        ]
    }
];


// 把段落数组渲染为 <p>(段落可为字符串或函数,函数按当前进度动态求值)
function aboutParasHTML(paras){
    let html = "";
    for(let p = 0; p < paras.length; p++){
        let txt = (typeof paras[p] === "function")
            ? paras[p]() : paras[p];
        html += '<p>' + txt + '</p>';
    }
    return html;
}


// 生成游戏介绍 HTML(折叠结构,默认收起)
function buildAboutHTML(){
    // 阶段3的补充说明同样永久显示(研究阶段清零后不再隐藏)
    let showStage3 = permaUnlock("stage3");
    let html = "";
    for(let i = 0; i < ABOUT_SECTIONS.length; i++){
        let s = ABOUT_SECTIONS[i];
        if(!s.visible()) continue;
        let open = !!aboutExpand[s.id];
        html +=
        '<div class="about-sec">' +
        '<div class="about-sec-head" data-sec="' + s.id + '">' +
        (open ? "▾ " : "▸ ") + s.title +
        '</div>' +
        '<div class="about-sec-body" data-sec="' + s.id + '"' +
        (open ? '' : ' style="display:none"') + '>';
        html += aboutParasHTML(s.paras);
        if(showStage3 && s.stage3Paras)
            html += aboutParasHTML(s.stage3Paras);
        html += '</div></div>';
    }
    return html;
}


// 切换某个主题的展开/收起(直接改 DOM,不重建)
function toggleAboutSec(id){
    aboutExpand[id] = !aboutExpand[id];
    let head = document.querySelector(
        '.about-sec-head[data-sec="' + id + '"]');
    let body = document.querySelector(
        '.about-sec-body[data-sec="' + id + '"]');
    if(head){
        let s = null;
        for(let i = 0; i < ABOUT_SECTIONS.length; i++){
            if(ABOUT_SECTIONS[i].id === id){ s = ABOUT_SECTIONS[i]; break; }
        }
        if(s) head.innerText = (aboutExpand[id] ? "▾ " : "▸ ") + s.title;
    }
    if(body)
        body.style.display = aboutExpand[id] ? "block" : "none";
}


// 绘制游戏介绍(每 tick 调用;签名变化才重建)
function renderAboutIntro(){
    let panel = document.getElementById("aboutIntroPanel");
    if(!panel) return;
    let key = aboutKey();
    if(key === lastAboutKey) return;
    lastAboutKey = key;
    panel.innerHTML = buildAboutHTML();
    // 绑定标题点击(浏览器环境;模拟器 mock 的 querySelectorAll 返回空数组)
    let heads = panel.querySelectorAll
        ? panel.querySelectorAll(".about-sec-head") : [];
    for(let i = 0; i < heads.length; i++){
        heads[i].addEventListener("click", function(){
            toggleAboutSec(this.dataset.sec);
        });
    }
}


// 关于页子页面切换(游戏介绍/更新日志)
(function(){
    let subNav = document.querySelector(".about-subnav");
    if(!subNav || !subNav.addEventListener)
        return;
    let subMap = {
        intro: "aboutIntroPage",
        changelog: "aboutChangelogPage"
    };
    subNav.addEventListener("click", function(e){
        let btn = e.target.closest(".about-tab");
        if(!btn) return;
        let sub = btn.dataset.sub;
        for(let key in subMap){
            let el = document.getElementById(subMap[key]);
            if(!el) continue;
            el.style.display = (key === sub) ? "block" : "none";
        }
        let tabs = subNav.querySelectorAll(".about-tab");
        for(let i = 0; i < tabs.length; i++){
            let t = tabs[i];
            if(t.dataset.sub === sub)
                t.classList.add("active");
            else
                t.classList.remove("active");
        }
    });
})();
