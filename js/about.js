// ============================================================
// 关于页面(About) —— "游戏介绍"子页渲染
// 每个主题显示标题,点击标题展开/收起详细说明。
// 部分主题按游戏进度解锁显示:
//   研究 : 完成解锁研究的成就(整理一下想法?,12 想法)
//   助手/实验 : 研究重置一次后
//   阶段3追加内容 : 达到研究阶段3(助手/实验的补充说明)
// 更新日志为静态内容,直接写在 index.html 中。
// ============================================================


// 展开状态(按主题 id 记忆;重建 DOM 后保留)
let aboutExpand = {};


// 组可见签名(研究解锁/研究重置/阶段3),变化时重建 DOM
let lastAboutKey = "";

function aboutKey(){
    return [
        isAchievementUnlocked("idea12") ? 1 : 0,
        game.researchResets >= 1 ? 1 : 0,
        game.researchStage >= 3 ? 1 : 0
    ].join(":");
}


// 主题定义(顺序即显示顺序)
// id: 唯一标识  title: 标题
// visible: 是否显示
// paras: 展开后显示的段落
// stage3Paras: 研究阶段3后追加的段落(可选)
const ABOUT_SECTIONS = [
    {
        id: "theory",
        title: "理论",
        visible: function(){ return true; },
        paras: [
            "理论共有5种,在解锁后会产出理论力量,消耗知识升级以生产更多理论力量。知识的生产会乘以各个理论力量的乘积。",
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
        visible: function(){ return isAchievementUnlocked("idea12"); },
        paras: [
            "达到12个想法后,你将可以进行研究重置。研究重置可以基于知识获取行动点,此外,如果重置时达到了一定的想法数,还能推进研究阶段。通过推进研究阶段可以完成相应的里程碑。"
        ]
    },
    {
        id: "helpers",
        title: "助手",
        visible: function(){ return game.researchResets >= 1; },
        paras: [
            "花费行动点可以招募助手,提供一些实用的自动化功能。"
        ],
        stage3Paras: [
            "自动实验助手还可以帮你自动完成实验,在实验达到最优化之前,自动实验助手的效率与你进行此实验的最优操作次数反比。"
        ]
    },
    {
        id: "experiments",
        title: "实验",
        visible: function(){ return game.researchResets >= 1; },
        paras: [
            "实验是一些交互性的问题,你可以通过消耗行动点来进行测量,提交答案或改进实验,基于提交的答案与预设的正确答案接近程度提供加成,达到最高的加成时即可完成实验。"
        ],
        stage3Paras: [
            "你也可以重新开始已完成的实验,实验原来的效果和相应的升级会保留,但会重新生成一个答案。在每个实验中,完成实验所用的最少操作次数,即测量和提交答案次数的总和将被记录并决定自动实验助手的效率,同时实验完成次数也会提供加成。",
            "当四个实验的最少操作次数分别达到9,15,20,6时,记作已经最优化了相应实验,此时自动实验助手将达到最大效率。"
        ]
    }
];


// 生成游戏介绍 HTML(折叠结构,默认收起)
function buildAboutHTML(){
    let showStage3 = game.researchStage >= 3;
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
        for(let p = 0; p < s.paras.length; p++)
            html += '<p>' + s.paras[p] + '</p>';
        if(showStage3 && s.stage3Paras){
            for(let p = 0; p < s.stage3Paras.length; p++)
                html += '<p>' + s.stage3Paras[p] + '</p>';
        }
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
