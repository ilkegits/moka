/* ShiCards: the units and lessons of HSK 2 and up (HSK 1's are in index.html).
   SHI_COURSE[level]: a unit line "## English|中文", then one line per lesson, "Title:word word word".
   Numbers never move once a level is out: level L's units are L*100+1 and on, its lessons L*1000+1 and on, in the
   order written here. So never add, drop or reorder the units or lessons of a level people already play; changing
   the words inside a lesson is fine.
   The meaning and reading a lesson shows are the word list's (dict/hsk.tsv), or the hand-written ones in dict/gloss.tsv.
   SHI_COMIC_LV: the levels that have a comics file, comics/hsk<level>.js.
   When this file changes, raise the number in index.html's <script src="course.js?v=…">. */
window.SHI_COMIC_LV = [2];
window.SHI_COURSE = {
  2: `
## Eating out|饭馆
Tea and coffee:咖啡 奶茶 绿茶 红茶 饭馆 酒店
A table for two:位 条 鱼 肉 等 一会儿
Colours:颜色 红色 白色 黑色 绿色
At the mall:商场 裤子 手表 包 万 送
Good, better, best:比 最 高 长 不错 坏 错
Don't!:别 让 就 啊 得 着

## Which way?|旁边
Left and right:左 右 左边 右边 旁边 往
Front and back:面 前面 后面 上面 下面 里面 外面
Doors and roads:门 门口 楼 洗手间 路 路上
Near and far:远 近 离 从 地 间
Walk and run:走 走路 跑 站 动 快 慢
How often:时 有时 经常 每 周 次

## Out and about|旅游
In and out:进 出 进来 进去 出来 出去
Up and down:上来 上去 下来 下去 起来
There and back:回来 回去 过来 过去 过
Bus and metro:车站 地铁 公交车 打车 票 门票
At the airport:机场 机票 出门 出国 外国
On a trip:旅游 游 已经 快要 开始 完

## Body and sport|运动
Body:身体 头 手 眼睛 个子 洗
Feeling ill:疼 药 药店 累 舒服 床
Ball games:球 足球 篮球 踢 打 运动
Hobbies:爱好 跑步 游泳 跳舞 画 上网 网上
Fun together:有意思 没意思 一起 跟 快乐 笑
Blue sky:晴 阴 鸟 飞 花

## School days|考试
Exams:考 考试 题 词 懂 意思
In class:教 教室 班 高中 开学
School bag:书包 本子 笔 打开 拿
Don't forget:忘 记得 准备 告诉 事情 希望
Why? Because:为什么 因为 所以 虽然 但是 但

## Family and New Year|过年
Grandparents:爷爷 奶奶 丈夫 妻子 自己
Children:男孩儿 女孩儿 小孩儿 小时候 从小
Names:姓 姓名 名 介绍 生日 过年
Lend a hand:帮 帮忙 不好意思 可能 正
Like this:这样 那样 这么 那么 还是
`,
};
