// 开局剧情
const storyLines=[


"这里是知识纪元，一个以知识为主题的位面。",


"这里的人们相信，知识就是最强大的力量。",


"最开始，你每秒会自动获得1点知识。",


"想提升知识获取速度，需要学习理论。",


"理论会产生理论力量。",


"所有理论力量的乘积，会提升知识获取速度。",


"由于你的能力，你可以同时学习多个理论。",


"继续推进，更多知识等待发现。"


];


// 获得想法时的剧情
const ideaStoryLines=[


"当知识积累到一定程度，你脑海中浮现出一个全新的想法。",


"这个想法如此深邃，以至于你愿意放弃当前的一切去追寻它。",


"重置知识，将获得 1 个想法。",


"想法会产生元-力量，速度随想法数量指数增长。",


"元-力量会提升所有理论力量的生产速度。",


"旧的知识会消散，但想法将永远留存。"


];


// 第一次解锁研究时的剧情
const researchStoryLines=[


"当你的想法积累到 12 个，你窥见了更深层的真理。",


"你决定开启一项真正的研究。",


"研究重置会同时消耗你的知识、理论、想法与元-力量。",


"但作为回报，你将推进研究阶段，并获得行动点。",


"行动点基于你当前的知识计算，最低也会获得 5 点。",


"研究阶段达到 1 后，知识与理论力量将获得永久加成。",


"继续前进，研究的道路没有尽头。"


];


// 第一次研究重置后的剧情(介绍助手与实验)
const firstResetHelperStoryLines=[


"你完成了第一次研究重置，行动点在你的手中汇聚。",


"行动点可以用于招募助手，或开展实验。",


"助手会自动替你工作：理论研究员负责解锁与升级理论，想法整理员负责获取想法。",


"实验则需要你亲手操作：测量、提交，验证自然的规律，根据提交结果的准确性提供强大的效果。",


"研究阶段越高，可用的助手与实验也越多。",


"从手动到自动，你的研究王国正在成型。"


];


// 达到研究阶段3 的剧情(介绍重复实验与自动实验助手)
const stage3AutoStoryLines=[


"研究阶段 3 —— 自动化研究，为你打开了新的可能。",


"现在，你可以重复完成已经完成的实验。",


"每一次重复完成，都会增加实验的完成次数，并叠加对应的效果。",


"同时，你也可以去优化实验的完成方法，尝试减少完成实验需要的操作数。",


"更重要的是，自动实验助手解锁了。",


"它们会替你持续不断地完成实验。",


"（注意：实验完成次数需要是整数，因此在获取助手后短时间内实验完成数没有增加是正常的）",


"在实验达到最优化之前，自动助手的效率与实验的最少操作次数成反比。",


"让自动化接管一切，把精力留给更深的真理。"


];


// 达到知识边界(1.79e308/s)的剧情(介绍知识边界)
const knowledgeLimitStoryLines=[


"1.79e308 —— 你的知识获取速度触及了知识的边界。",


"在增量宇宙中，这个数字常被称为'无限'。",


"超越它的知识生产，将受到软上限的约束。",


"你已超越人类知识的边界。",


"也许，边界之外还藏着新的真理……",


"知识边界之后的道路，仍在等待探索。"


];


// 当前正在播放的剧情(开局或想法)
let currentStoryLines = storyLines;

let storyIndex=0;


function startStory(){


currentStoryLines = storyLines;

storyIndex = 0;

document
.getElementById("storyText")
.innerText=
currentStoryLines[0];

updateStoryNextBtn();

}


// 通用:播放一段剧情(隐藏游戏界面,显示剧情屏)
function playStoryLines(lines){

currentStoryLines = lines;

storyIndex = 0;

document
.getElementById("storyText")
.innerText=
currentStoryLines[0];

document
.getElementById("gameScreen")
.style.display="none";

document
.getElementById("storyScreen")
.style.display="flex";

updateStoryNextBtn();

}


// 播放"获得想法"剧情
function showIdeaStory(){


currentStoryLines = ideaStoryLines;

storyIndex = 0;

document
.getElementById("storyText")
.innerText=
currentStoryLines[0];

document
.getElementById("gameScreen")
.style.display="none";

document
.getElementById("storyScreen")
.style.display="flex";

updateStoryNextBtn();

}


// 播放"研究解锁"剧情
function showResearchStory(){


currentStoryLines = researchStoryLines;

storyIndex = 0;

document
.getElementById("storyText")
.innerText=
currentStoryLines[0];

document
.getElementById("gameScreen")
.style.display="none";

document
.getElementById("storyScreen")
.style.display="flex";

updateStoryNextBtn();

}


// 播放"第一次研究重置"剧情(介绍助手与实验)
function showFirstResetHelperStory(){

playStoryLines(firstResetHelperStoryLines);

}


// 播放"研究阶段3"剧情(介绍重复实验与自动实验助手)
function showStage3AutoStory(){

playStoryLines(stage3AutoStoryLines);

}


// 播放"知识边界"剧情(介绍知识边界)
function showKnowledgeLimitStory(){

playStoryLines(knowledgeLimitStoryLines);

}


function updateStoryNextBtn(){


let btn=
document
.getElementById("storyNextBtn");

if(!btn) return;

if(storyIndex>=currentStoryLines.length-1){
btn.innerText="开始游戏";
}else{
btn.innerText="点击继续";
}

}


function nextStory(){


storyIndex++;


if(storyIndex>=currentStoryLines.length){


finishStory();


return;


}


document
.getElementById("storyText")
.innerText=
currentStoryLines[storyIndex];

updateStoryNextBtn();

}




function finishStory(){


game.storyFinished=true;


document
.getElementById("storyScreen")
.style.display="none";


document
.getElementById("gameScreen")
.style.display="block";


renderTheories();
renderIdeaPage();
renderResearchPage();
saveGame();


}



// 整屏点击也可推进剧情
document
.getElementById("storyScreen")
.onclick=
nextStory;
