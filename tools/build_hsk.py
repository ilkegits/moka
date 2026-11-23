"""Build dict/hsk.tsv, the HSK word lists ShiCards offers for picking the words you know and builds its lessons from.

Sources (not stored in the repo, download them first):
  1. The official word list of the HSK 3.0 syllabus 《HSK 考试大纲》 (released 2025-11 by 中外语言交流合作中心, in force from
     2026-07): 11000 entries, 300 / 200 / 500 / 1000 / 1600 / 1800 / 5600 for levels 1-6 and 7-9. Mirrored from the official
     query system (chinesetest.cn/syllabus) by github.com/ofou/hsk:
       https://raw.githubusercontent.com/ofou/hsk/main/%E8%AF%8D%E6%B1%87.csv   (词汇.csv: No., 级别, 词语, 拼音, 词性)
  2. complete-hsk-vocabulary (MIT, Yanis Zafiropulos), for how common each word is and for the meanings the list had before:
       https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/main/complete.min.json
  3. dict/zh-en.tsv (in the repo: CC-CEDICT, CC BY-SA 4.0, ranked by jieba word frequency; tools/build_dict.py).

Usage:  python tools/build_hsk.py <词汇.csv> <complete.min.json> [previous=dict/hsk.tsv] [out=dict/hsk.tsv]

What it does:
  - Every word of the official list, once, at the lowest level it is listed at (点1 一级 and 点2 二级 make one 点 at level 1).
  - Its reading is the CC-CEDICT entry that matches the official pinyin of that lowest listing (吗 is "ma", the question
    particle, not "má", "what?"). Tone changes of 一 and 不 (yí / bú) and neutral tones written either way count as the
    same reading. When complete-hsk-vocabulary already gives a reading that matches as well as any, its line is kept as it
    was; otherwise the matching CC-CEDICT entry is used. A word CC-CEDICT does not have is written in HAND below.
  - Order: by level, most common first (complete-hsk-vocabulary's rank; a word it lacks gets the rank of the words that
    are about as common in jieba's counts).
  - previous: the hsk.tsv before this build. A word whose reading or meaning changed keeps its old pinyin and meanings in
    two more columns, so the app can correct cards made from the old line; an older correction is carried forward.
Output: one line per word:  level <TAB> simplified <TAB> pinyin <TAB> meanings [<TAB> old pinyin <TAB> old meanings]
"""
import bisect, csv, io, json, os, re, sys, unicodedata

src, dk_src = sys.argv[1], sys.argv[2]
prev = sys.argv[3] if len(sys.argv) > 3 else 'dict/hsk.tsv'
out = sys.argv[4] if len(sys.argv) > 4 else 'dict/hsk.tsv'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAX_CHARS = 90
BANDS = {'一级': 1, '二级': 2, '三级': 3, '四级': 4, '五级': 5, '六级': 6, '七-九级': 7}
# words CC-CEDICT does not have: pinyin, meanings
# readings and meanings written by hand: words CC-CEDICT lacks, and words whose official reading it lacks
HAND = {
    '精彩纷呈': ('jīng cǎi fēn chéng', 'full of brilliant moments; one splendid thing after another'),
    '嗯': ('ǹg', 'mm-hm; uh-huh (agreeing); hm? (asking)'),
    '血': ('xiě', 'blood'),
    '下载': ('xià zài', 'to download'),
    '温差': ('wēn chà', 'difference in temperature'),
    '一晃': ('yī huàng', '(of time) in a flash; in the blink of an eye'),
    # CC-CEDICT gives the official reading only as "variant of ..." here (dict/zh-en.tsv keeps one line per reading)
    '只': ('zhī', '(measure word for animals and birds, and for one of a pair)'),
    '着': ('zhe', '(after a verb: in the middle of doing; -ing)'),
    '背': ('bēi', "to carry on one's back; to bear"),
    '晃': ('huǎng', 'to dazzle; to flash past'),
    '驮': ('tuó', "to carry on one's back (of an animal)"),
    '咽': ('yàn', 'to swallow'),
    '窗': ('chuāng', 'window'),
    '占比': ('zhàn bǐ', 'proportion; share (of a total)'),
    '备': ('bèi', 'to prepare; to get ready; to have; fully'),
    '耕': ('gēng', 'to plough; to till; to cultivate'),
    '磨炼': ('mó liàn', 'to temper oneself; to steel oneself (through hardship)'),
    '湿地': ('shī dì', 'wetland'),
    '一并': ('yī bìng', 'along with the others; together; all at once'),
    '纪录': ('jì lù', 'record (e.g. in sports); to record; minutes'),
    # HSK 7-9 words whose first CC-CEDICT sense is a literal or a rare one (一针见血 "lit. to draw blood on the first prick")
    '呈': ('chéng', 'to show; to take on (a form or colour); to present'),
    '直辖市': ('zhí xiá shì', 'municipality directly under the central government'),
    '自治区': ('zì zhì qū', 'autonomous region'),
    '走向': ('zǒu xiàng', 'direction; trend; to move towards'),
    '证券': ('zhèng quàn', 'securities; stocks and bonds'),
    '储量': ('chǔ liàng', 'reserves (of oil, minerals etc)'),
    '赛季': ('sài jì', 'season (in sports)'),
    '抵': ('dǐ', 'to arrive at; to resist; to make up for'),
    '龙头': ('lóng tóu', 'tap; faucet; leading company; dragon head'),
    '流派': ('liú pài', 'school (of thought or art); sect'),
    '四方': ('sì fāng', 'all sides; all directions; square'),
    '荤': ('hūn', 'meat dishes; non-vegetarian food'),
    '青睐': ('qīng lài', 'to favour; to look kindly on'),
    '背影': ('bèi yǐng', "view of someone's back; figure seen from behind"),
    '供养': ('gōng yǎng', 'to support (parents, elders); to make offerings'),
    '民事': ('mín shì', 'civil (law); civil affairs'),
    '函': ('hán', 'letter; correspondence'),
    '五官': ('wǔ guān', 'facial features; the five sense organs'),
    '回合': ('huí hé', 'round (of a contest); bout'),
    '风筝': ('fēng zheng', 'kite'),
    '替补': ('tì bǔ', 'substitute (player); to replace'),
    '争相': ('zhēng xiāng', 'to scramble to (do something); to vie with each other'),
    '库存': ('kù cún', 'stock; inventory'),
    '新春': ('xīn chūn', 'Spring Festival; early spring'),
    '束手无策': ('shù shǒu wú cè', 'to be at a loss; helpless'),
    '失事': ('shī shì', 'to have an accident (crash, shipwreck etc)'),
    '曲艺': ('qǔ yì', 'folk performing arts (storytelling, comic dialogue, ballads)'),
    '眺望': ('tiào wàng', 'to gaze into the distance; to look out over'),
    '园区': ('yuán qū', 'industrial park; business park'),
    '属相': ('shǔ xiàng', "Chinese zodiac sign (the animal of one's birth year)"),
    '风景线': ('fēng jǐng xiàn', 'scenic sight; attraction'),
    '区间': ('qū jiān', 'range; interval; section'),
    '运筹帷幄': ('yùn chóu wéi wò', 'to plan strategy from behind the lines'),
    '功利': ('gōng lì', 'material gain; utilitarian'),
    '汗马功劳': ('hàn mǎ gōng láo', 'great contributions; hard-won achievements'),
    '一针见血': ('yī zhēn jiàn xiě', 'to hit the nail on the head'),
    '锦上添花': ('jǐn shàng tiān huā', 'to make something good even better'),
    '得心应手': ('dé xīn yìng shǒu', "to do something with ease; to be in one's element"),
    '对症下药': ('duì zhèng xià yào', 'to prescribe the right cure; to take the right measures'),
    '口头禅': ('kǒu tóu chán', 'pet phrase; catchphrase'),
    '凤毛麟角': ('fèng máo lín jiǎo', 'extremely rare; very few'),
    '纸上谈兵': ('zhǐ shàng tán bīng', 'to be all talk and no action; armchair strategy'),
    '颠倒黑白': ('diān dǎo hēi bái', 'to turn black into white; to distort the truth'),
    '对牛弹琴': ('duì niú tán qín', 'to talk to someone who cannot understand (play the lute to a cow)'),
    '礼尚往来': ('lǐ shàng wǎng lái', 'courtesy calls for courtesy in return; give and take'),
    '风吹雨打': ('fēng chuī yǔ dǎ', 'battered by wind and rain; hardships'),
    '掩耳盗铃': ('yǎn ěr dào líng', "to fool oneself; to bury one's head in the sand"),
    '小菜一碟': ('xiǎo cài yī dié', 'a piece of cake; very easy'),
    '环比': ('huán bǐ', 'compared with the previous period (month on month)'),
    '汉服': ('Hàn fú', 'Hanfu (traditional Han Chinese clothing)'),
    '烘焙': ('hōng bèi', 'to bake; baking'),
    '受益匪浅': ('shòu yì fěi qiǎn', 'to benefit greatly'),
    '丸子': ('wán zi', 'meatball; ball (of food)'),
    '两下子': ('liǎng xià zi', 'real skill; to have a knack'),
    '卸载': ('xiè zài', 'to uninstall (an app); to unload'),
    '不肖': ('bù xiào', "unworthy (of one's parents or teachers)"),
    '综艺': ('zōng yì', 'variety show; variety (entertainment)'),
    '按钮': ('àn niǔ', 'button; push button'),
    '插曲': ('chā qǔ', 'episode; interlude; song in a film'),
    '突兀': ('tū wù', 'abrupt; sudden; towering'),
    '职称': ('zhí chēng', 'professional title'),
    '夯实': ('hāng shí', 'to tamp; to consolidate (a foundation)'),
    '博弈': ('bó yì', 'game; contest of strategy; gambling'),
    '概': ('gài', 'general; approximate; without exception'),
    '不予': ('bù yǔ', 'to refuse to; to withhold'),
    # words new on the list whose first CC-CEDICT sense is not the one meant here (款 is not "section; paragraph")
    '这个': ('zhè ge', 'this; this one'),
    '哪个': ('nǎ ge', 'which; which one'),
    '没事': ('méi shì', "it's nothing; never mind; to be free"),
    '拼音': ('pīn yīn', 'pinyin (romanized spelling of Chinese)'),
    '语文': ('yǔ wén', 'Chinese (school subject); language and literature'),
    '生肖': ('shēng xiào', 'Chinese zodiac animal; zodiac sign'),
    '油条': ('yóu tiáo', 'fried dough stick (youtiao)'),
    '轻重': ('qīng zhòng', 'weight; importance; how serious'),
    '久远': ('jiǔ yuǎn', 'ages ago; far back in time; long-lasting'),
    '款': ('kuǎn', '(measure word for styles and models); sum of money; funds'),
    '历年': ('lì nián', 'over the years; (in) past years'),
    '易于': ('yì yú', 'easy to; liable to'),
    '链接': ('liàn jiē', 'link (on a web page); to link'),
    '点击': ('diǎn jī', 'to click (on); click; views (of a web page)'),
    '好不': ('hǎo bù', 'how very ...; so very ...'),
    '分期': ('fēn qī', 'in instalments; in stages'),
    '材质': ('cái zhì', 'material (of a product); quality of material'),
    '现货': ('xiàn huò', 'goods in stock; spot goods'),
    '场次': ('chǎng cì', 'number of showings; screening; session'),
    '免税': ('miǎn shuì', 'tax-free; duty-free'),
    '民宿': ('mín sù', 'homestay; guesthouse; B&B'),
    '洗漱': ('xǐ shù', 'to wash up (face and teeth)'),
    '热度': ('rè dù', 'popularity; buzz; heat'),
    '放飞': ('fàng fēi', 'to let fly; to release (a bird, kite or dream)'),
    '乌龟': ('wū guī', 'tortoise; turtle'),
    '大幅': ('dà fú', 'substantially; by a wide margin; large-format'),
    '水流': ('shuǐ liú', 'current; flow of water; stream'),
    '怀': ('huái', 'bosom; arms; to cherish; to keep in mind'),
    '主播': ('zhǔ bō', 'anchor; host; live streamer'),
    '存储': ('cún chǔ', 'to store; storage (computing)'),
    '外甥': ('wài shēng', "nephew (sister's son)"),
    '微小': ('wēi xiǎo', 'tiny; minute'),
    '使馆': ('shǐ guǎn', 'embassy; diplomatic mission'),
    '换乘': ('huàn chéng', 'to change (trains, buses); to transfer'),
    '自习': ('zì xí', "to study on one's own; self-study"),
    '转发': ('zhuǎn fā', 'to forward (a message); to repost'),
    '线下': ('xiàn xià', 'offline; in person'),
    '诗词': ('shī cí', 'poems; poetry'),
    '家居': ('jiā jū', 'home furnishings; home'),
    '上进': ('shàng jìn', 'eager to improve; ambitious'),
    '阵雨': ('zhèn yǔ', 'shower (of rain)'),
    # the official reading's CC-CEDICT line is about another sense
    '说法': ('shuō fǎ', "way of speaking; wording; one's version (of events); statement"),
    '标致': ('biāo zhì', 'beautiful (of a woman); pretty'),
    '口音': ('kǒu yīn', 'accent; voice'),
    '分量': ('fèn liàng', 'weight; amount; (fig.) importance'),
    '卡': ('kǎ', 'card; to block; to be stuck'),
}
VALID = re.compile(r"[a-zāáǎàēéěèīíǐìōóǒòūúǔùüǖǘǚǜ]+( [a-zāáǎàēéěèīíǐìōóǒòūúǔùüǖǘǚǜ]+)*")

# ---- pinyin: syllables and tones ----
MARK = {'\u0304': 1, '\u0301': 2, '\u030c': 3, '\u0300': 4}   # the tone marks, as combining characters
def tones(p):
    """'xué sheng' -> ('xuesheng', [(2, 2)]): the letters (decomposed, so ü is two), and each tone with the place of its vowel"""
    d = unicodedata.normalize('NFD', p.lower().replace('u:', 'ü').replace('v', 'ü'))
    letters, marks = [], []
    for c in d:
        if c in MARK: marks.append((len(letters) - 1, MARK[c]))   # the vowel it sits on
        elif c.isalpha() or c == '\u0308': letters.append(c)
    return ''.join(letters), marks

def syllables(p):
    """CC-CEDICT style 'yī xià' -> [('yi', 1), ('xia', 4)] (neutral tone 0)"""
    out = []
    for s in p.split():
        letters, marks = tones(s)
        out.append((letters, marks[0][1] if marks else 0))
    return out

def score(word, cand, official):
    """how well a CC-CEDICT reading matches the official pinyin: 3 the same, 2 the same but for a neutral tone, 1 the same
    letters, 0 not the same. Tone changes of 一 and 不 do not count"""
    best = 0
    for off in official.split('/'):
        off_letters, off_marks = tones(re.sub(r"[\s'’\-·]", '', off))
        syl = syllables(cand)
        if ''.join(s for s, _ in syl) != off_letters:
            continue
        # the official tones, put on the candidate's syllables
        cuts, at = [], 0
        for s, _ in syl:
            cuts.append((at, at + len(s))); at += len(s)
        off_t = [0] * len(syl)
        for pos, t in off_marks:
            for i, (a, b) in enumerate(cuts):
                if a <= pos < b: off_t[i] = t
        chars = [c for c in word]
        s = 3
        for i, (_, t) in enumerate(syl):
            o = off_t[i]
            if t == o: continue
            ch = chars[i] if len(chars) == len(syl) else ''
            if ch and ch in '一不': continue
            if t == 0 or o == 0: s = min(s, 2)
            else: s = min(s, 1)
        best = max(best, s)
    return best

def meanings(ms):
    keep = []
    for m in ms:
        m = re.sub(r'\s+', ' ', m).strip(' ;,')
        if not m or re.match(r'(surname|variant of|old variant|used in)', m, re.I):
            continue
        if keep and len('; '.join(keep + [m])) > MAX_CHARS:
            break
        keep.append(m)
    return '; '.join(keep)
good = lambda m: bool(m) and not re.match(r'(see |variant of)', m)

def cmeaning(ms, p, depth=0):
    """a CC-CEDICT reading's meanings; one that only points to another word ("variant of 下工夫", "see 仿效") takes that word's"""
    m = meanings([x for x in ms if not x.startswith('see ')])
    if m or depth > 1: return m
    for ref in re.findall(r'(?:variant of|see) ([㐀-鿿]+)', '; '.join(ms)):
        cs = sorted(cedict.get(ref, []), key=lambda c: c[0] != p)   # the same reading first
        for cp, cms in cs:
            m = cmeaning(cms, cp, depth + 1)
            if m: return m
    return ''

# ---- words the official list gives more than once ----
# A word listed again, at a higher level or at the same one, with another meaning (点 "o'clock" at HSK 1, "to order" at
# HSK 2) or another reading (只 zhī at HSK 1, zhǐ at HSK 3). Each listing is its own line, so every level holds exactly the
# official number of entries. (word, n): the meaning of its n-th listing, in the official order; every listing after the
# first must have one. A first listing is here only where CC-CEDICT's meanings fit the other listing better (花 at HSK 2 is
# first the verb "to spend", then the noun "flower").
SENSES = {
    ('点', 2): 'to order (food); to light; to nod; to touch on',
    ('花', 1): 'to spend (money or time)', ('花', 2): 'flower; blossom; colourful; fancy',
    ('过', 2): '(after a verb: have done before, as in "have been")',
    ('会', 2): 'meeting; gathering; association',
    ('只', 2): 'only; just; merely',
    ('地', 2): 'ground; earth; land; place',
    ('得', 2): 'to get; to obtain; to gain', ('得', 3): 'must; to have to; to need',
    ('站', 2): 'to stand; to stop',
    ('过去', 1): 'to go over; to pass by', ('过去', 2): 'the past; in the past; former',
    ('还', 2): 'to give back; to return; to pay back',
    ('长', 2): 'to grow; to get bigger; head; chief',
    ('两', 2): 'liang; tael (unit of weight, 50 grams)',
    ('为', 2): 'to be; to act as; to become', ('为', 3): '(formal, passive: by, as in "be loved by all")',
    ('啊', 2): 'ah! oh! (surprise)',
    ('干', 1): 'to do; to work', ('干', 2): 'dry; dried',
    ('生', 1): 'to be born; to give birth; to grow; to get (ill)', ('生', 2): 'raw; unripe; unfamiliar; strange',
    ('着', 2): 'to succeed in (after a verb); to touch; to catch (fire, a cold)',
    ('种', 2): 'to plant; to grow',
    ('空', 2): 'free time; spare; to leave empty',
    ('等', 1): 'to wait (for); until', ('等', 2): 'and so on; etc.; class; grade',
    ('重', 2): 'heavy; weight; important',
    ('倒', 2): 'to fall over; to collapse; to change (trains, buses)',
    ('别', 1): "don't (do something)", ('别', 2): 'to leave; to part; to pin; to fasten',
    ('喂', 1): 'hello (on the phone); hey', ('喂', 2): 'to feed',
    ('处', 2): 'place; office; department',
    ('头', 2): '(noun ending, as in "stone" or "inside")',
    ('好', 2): 'to like; to be fond of; to be keen on',
    ('当', 2): 'to treat as; to regard as; to pawn',
    ('才', 1): 'only then; just (now); only', ('才', 2): 'talent; ability; capable person',
    ('批', 1): '(measure word: batch; group)', ('批', 2): 'to criticize; to approve (a document); to comment on',
    ('数', 2): 'to count; to be reckoned as',
    ('本', 1): '(measure word for books)', ('本', 2): "this; one's own; originally",
    ('省', 1): 'province', ('省', 2): 'to save; to economize; to leave out',
    ('看', 2): 'to look after; to watch over',
    ('称', 1): 'to call; to name; to say', ('称', 2): 'to weigh',
    ('系', 2): 'department (of a university); system; to relate to',
    ('背', 2): 'back (of the body); to recite from memory; to turn away',
    ('行', 1): 'to go; to be all right; OK; capable', ('行', 2): 'line; row; profession; (measure word for rows)',
    ('调', 2): 'to adjust; to mix; to provoke', ('调', 3): 'tune; tone; accent',
    ('量', 2): 'amount; quantity; capacity',
    ('面', 2): 'noodles; flour',
    ('中', 2): 'to hit (the target); to win (a prize); to be hit by',
    ('乘', 2): 'to multiply',
    ('冲', 2): 'facing; towards; (of a smell) strong; vigorous',
    ('划', 2): 'to draw (a line); to mark off; to divide',
    ('副', 1): '(measure word: pair, set, as for glasses or gloves)', ('副', 2): 'deputy; vice-; secondary',
    ('升', 2): 'litre',
    ('卷', 2): 'volume; (exam) paper; scroll',
    ('吐', 2): 'to vomit; to throw up',
    ('地方', 2): 'local; region (not central)',
    ('局', 1): '(measure word for games: match, set, round)', ('局', 2): 'office; bureau; situation',
    ('待', 2): 'to wait for; to treat; to deal with',
    ('所', 1): 'place; (measure word for houses, schools, hospitals)', ('所', 2): 'that which (formal particle); by (in passive sentences)',
    ('扇', 2): '(measure word for doors and windows); fan',
    ('支', 1): '(measure word for long thin things: pens, songs, teams)', ('支', 2): 'to support; to prop up; to pay out',
    ('散', 2): 'to break up; to disperse; to scatter',
    ('料', 1): 'material; stuff; ingredients', ('料', 2): 'to expect; to anticipate',
    ('炸', 2): 'to explode; to blow up; to burst',
    ('结', 2): 'to bear fruit; to form seeds',
    ('结果', 2): 'to bear fruit',
    ('落', 2): 'to leave behind; to forget; to be left out',
    ('该', 2): '(formal) this; that; the said',
    ('转', 2): 'to turn round; to spin; to stroll',
    ('露', 2): '(formal) to reveal; to show', ('露', 3): 'dew',
    ('之', 1): "(literary) of; 's", ('之', 2): '(literary) him; her; it; this',
    ('传', 2): 'biography; commentary',
    ('作为', 1): 'as (in the role of); to regard as', ('作为', 2): 'conduct; achievement; to accomplish something',
    ('则', 2): '(measure word for news items and notices)',
    ('制服', 1): 'uniform', ('制服', 2): 'to subdue; to bring under control',
    ('卡', 1): 'card', ('卡', 2): 'to get stuck; to block; clip',
    ('呛', 2): 'to irritate the nose; to choke (of smoke or a smell)',
    ('命', 1): 'life; fate', ('命', 2): 'to order; to command; to name',
    ('和', 2): 'mild; gentle; peaceful; harmonious',
    ('圈', 2): 'to pen in; to shut in', ('圈', 3): 'pen; pigsty; fold',
    ('地道', 2): 'tunnel',
    ('大意', 2): 'careless',
    ('尽', 2): 'as much as possible; to the greatest extent; at the very (end)',
    ('成年', 2): 'all year round',
    ('打', 2): '(spoken) from; since',
    ('折', 2): '(of something long) to break; to lose money',
    ('担', 2): 'load; burden; (measure word: a carrying-pole load)',
    ('拧', 2): 'to twist; to screw',
    ('挑', 2): 'to raise; to poke; to stir up',
    ('挨', 2): 'to suffer; to endure; to be beaten',
    ('撒', 2): '(of a net) to cast; to let go; to act (spoiled)',
    ('晃', 2): 'to sway; to shake',
    ('横', 2): 'harsh; unreasonable; rude',
    ('涨', 2): 'to swell; to expand',
    ('率', 2): 'to lead; to command',
    ('码', 1): 'yard (unit of length); number; code; (measure word: a matter)', ('码', 2): 'to stack; to pile up',
    ('签', 2): 'bamboo slip; label; tag',
    ('粉丝', 1): 'bean vermicelli', ('粉丝', 2): 'fan (enthusiast); follower',
    ('精神', 2): 'spirit; mind; essence',
    ('缝', 2): 'seam; crack; gap',
    ('自负', 1): 'to take responsibility (oneself)', ('自负', 2): 'conceited',
    ('蒙', 2): 'to cover; to receive (kindness); to suffer',
    ('转机', 1): 'to change planes', ('转机', 2): 'a turn for the better',
    ('闷', 2): 'bored; depressed; gloomy',
    ('麻', 1): 'numb; tingling', ('麻', 2): 'hemp; flax; sesame',
}

def spaced(official_py, cand):
    """the official pinyin of a listing ('dàyi', 'guo'), cut into the syllables of a CC-CEDICT reading of the same letters"""
    off = unicodedata.normalize('NFD', re.sub(r"[\s'’\-·]", '', official_py.split('/')[0].lower()))
    cuts, at = set(), 0
    for syl in cand.split():
        at += len(tones(syl)[0]); cuts.add(at)
    out, n = [], 0
    for c in off:
        if c not in MARK and (c.isalpha() or c == '̈'):
            if n in cuts and n: out.append(' ')
            n += 1
        out.append(c)
    return unicodedata.normalize('NFC', ''.join(out))

# ---- the official list ----
official = {}   # word -> (level, pinyin) of its first listing, which is its lowest level
order, listings = [], []   # listings: (word, n, level, pinyin) of every listing after a word's first
with io.open(src, encoding='utf-8-sig') as f:
    for r in csv.DictReader(f):
        word = re.sub(r'\d+$', '', (r.get('词语') or r.get('Word')).strip())
        band = re.match(r'(一级|二级|三级|四级|五级|六级|七-九级)', (r.get('级别') or r.get('Level')).strip()).group(1)
        lv, py = BANDS[band], (r.get('拼音') or r.get('Pinyin')).strip()
        if word not in official:
            official[word] = (lv, py); order.append(word)
        else:
            assert lv >= official[word][0], f'{word}: a later listing at a lower level'
            listings.append((word, 1 + sum(1 for x in listings if x[0] == word) + 1, lv, py))

# ---- CC-CEDICT readings, and how common each word is (jieba) ----
cedict, jieba = {}, {}
for i, line in enumerate(io.open(os.path.join(ROOT, 'dict', 'zh-en.tsv'), encoding='utf-8')):
    if line.startswith('#'): continue
    s, p, m = line.rstrip('\n').split('\t')
    cedict.setdefault(s, []).append((p, m.split('; ')))
    jieba.setdefault(s, i)

# ---- complete-hsk-vocabulary: its reading, meanings and rank, picked as the old build did ----
dk = {}
for idx, w in enumerate(json.load(io.open(dk_src, encoding='utf-8'))):
    if not any(re.fullmatch(r't[1-7]', l) for l in w.get('l', [])): continue
    forms = [f for f in w.get('f', []) if f.get('m')] or w.get('f', [])
    if not forms: continue
    real = lambda f: [m for m in f.get('m', []) if not re.match(r'(surname|variant of|old variant|used in|see |abbr)', m, re.I)]
    f = max(forms, key=lambda f: len(real(f)))
    key = (min(int(l[1:]) for l in w['l'] if re.fullmatch(r't[1-7]', l)), w.get('q', 10 ** 9))
    if w['s'] not in dk or key < dk[w['s']][3]:   # of two entries for one word, the one the old build listed (lowest level, then rank)
        dk[w['s']] = (re.sub(r'\s+', ' ', f['i']['y']).strip(), meanings(f.get('m', [])), (w.get('q', 10 ** 9), idx), key)

# a rank for words complete-hsk-vocabulary lacks: the middle rank of the 15 words nearest in jieba's order
pairs = sorted((jieba[s], q[0]) for s, (_, _, q, _) in dk.items() if s in jieba and q[0] < 10 ** 9)
def rank_for(s):
    if s not in jieba: return (pairs[-1][1] + 1, 0)
    i = bisect.bisect_left(pairs, (jieba[s], -1))
    near = sorted(q for _, q in pairs[max(0, i - 7):i + 8])
    return (near[len(near) // 2] + 0.5, 0)   # (rank, place in complete-hsk-vocabulary): ties keep its order

# ---- each word's line ----
rows, report, missing = [], [], []
for word in order:
    lv, py = official[word]
    cands = cedict.get(word, [])
    best = max((score(word, p, py) for p, _ in cands), default=-1)
    old = dk.get(word)
    if word in HAND:
        (p, m), q = HAND[word], old[2] if old else rank_for(word)
        if old: report.append(f'{word}: {old[0]} "{old[1][:40]}" -> {p} "{m[:40]}" (official {py}, by hand)')
    elif old and score(word, old[0], py) >= max(best, 1) and good(old[1]) \
            and (old[0].lower() in {c[0] for c in cands} or not cands and VALID.fullmatch(old[0].lower())):
        p, m, q = old[:3]   # its reading is a proper CC-CEDICT one that matches as well as any: the line stays as it was
    elif cands:
        p, ms = max(cands, key=lambda c: (score(word, c[0], py), bool(cmeaning(c[1], c[0]))))   # the first (most common) of the best
        m, q = cmeaning(ms, p), old[2] if old else rank_for(word)
        if not m: missing.append(f'{word} {py} (CC-CEDICT: {p} "{"; ".join(ms)}")'); continue
        if py[:1].isupper(): p = p[:1].upper() + p[1:]   # a name: 欧洲 Ōu zhōu
        if old: report.append(f'{word}: {old[0]} "{old[1][:40]}" -> {p} "{m[:40]}" (official {py})')
    elif word.endswith('儿') and word[:-1] in cedict:   # an erhua word: the plain word's reading with r, and its meanings
        base = word[:-1]
        bp = max(cedict[base], key=lambda c: score(base, c[0], re.sub(r'r$', '', py)))[0]
        p, m, q = bp + ' r', f'erhua variant of {base}', old[2] if old else rank_for(word)
    else:
        missing.append(f'{word} {py}'); continue
    if best >= 0 and score(word, p, py) < 2: report.append(f'CHECK {word}: {p} vs official {py}')
    if (word, 1) in SENSES: m = SENSES[(word, 1)]
    rows.append((lv, q, word, p, m, 1))
if missing: sys.exit('no meaning in CC-CEDICT, write them in HAND: ' + ', '.join(missing))
# the later listings of a word: their own reading and the meaning written in SENSES, ranked with the word's first line
first = {r[2]: r for r in rows}
for word, n, lv, py in listings:
    if (word, n) not in SENSES: missing.append(f'{word} listing {n} ({py}): no meaning in SENSES')
    cands = [c[0] for c in cedict.get(word, [])] + [first[word][3]]
    cand = max(cands, key=lambda c: score(word, c, py))
    if score(word, cand, py) < 1: missing.append(f'{word} listing {n}: {py} matches no reading'); continue
    rows.append((lv, first[word][1], word, spaced(py, cand), SENSES.get((word, n), ''), n))
extra = [k for k in SENSES if k[1] > 1 and not any(w == k[0] and n == k[1] for w, n, _, _ in listings)]
if extra: missing.append(f'SENSES for listings the list does not have: {extra}')
if missing: sys.exit('\n'.join(missing))

# an erhua word whose only meaning is "erhua form of 小偷": the plain word's meanings after it, as the app reads them
built = {r[2]: r[4] for r in rows if r[5] == 1}
for i, (lv, q, s, p, m, n) in enumerate(rows):
    e = re.fullmatch(r'erhua (?:form|variant) of ([^;\s]+)', m)
    if e:
        base = e.group(1)
        bm = built.get(base) or meanings(max(cedict.get(base, [('', [])]), key=lambda c: bool(meanings(c[1])))[1])
        rows[i] = (lv, q, s, p, meanings([f'erhua variant of {base}'] + bm.split('; ')) if bm else m, n)

# ---- old lines, for correcting cards ----
was = {}
if prev and os.path.exists(prev):
    for line in io.open(prev, encoding='utf-8'):
        if line.startswith('#'): continue
        f = line.rstrip('\n').split('\t')
        if len(f) >= 4 and f[1] not in was: was[f[1]] = f[2:6]   # a word's first line

rows.sort(key=lambda r: (r[0], r[1], r[5]))   # a word's listings at one level stay in the official order
with io.open(out, 'w', encoding='utf-8', newline='\n') as o:
    o.write('# HSK 3.0 word lists of the 2025 syllabus 《HSK 考试大纲》 (levels 1-6, 7 = 7-9): words, levels and readings from the official list '
            '(chinesetest.cn, via github.com/ofou/hsk); meanings CC-CEDICT (CC BY-SA 4.0), some via complete-hsk-vocabulary (MIT). Built by tools/build_hsk.py\n')
    for lv, _, s, p, m, n in rows:
        line = f'{lv}\t{s}\t{p}\t{m}'
        w = was.get(s) if n == 1 else None
        if w and (w[0], w[1]) != (p, m) and (w[0] != p or not good(w[1])):
            line += f'\t{w[0]}\t{w[1]}'   # a wrong reading or no real meaning before: remember the old line, cards made from it are corrected
        elif w and len(w) == 4:
            line += f'\t{w[2]}\t{w[3]}'   # corrected before: carry it forward (a meaning narrowed to one listing, 花 "to spend", is no correction)
        o.write(line + '\n')
for r in report: print(r)
print(len(rows), 'lines,', len(first), 'words ->', out, {l: sum(1 for r in rows if r[0] == l) for l in range(1, 8)})
