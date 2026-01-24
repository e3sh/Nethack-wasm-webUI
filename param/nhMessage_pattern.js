/**
 * 正規表現を用いたパターン翻訳辞書
 * $1, $2 などのプレースホルダは trancelate.js 内で再帰的に翻訳されます。
 */
function nhMessage_pattern() {
    return [
        {
            pattern: /^It is written in the Book of (.*):$/,
            replace: "$1の書に記されている："
        },
        {
            pattern: /^Your (god|goddess) (.*) seeks to possess the Amulet, and with it$/,
            replace: "あなたの$1 $2はイェンダーの魔除けを手に入れることを望んでいます。"
        },
        {
            pattern: /^to gain deserved ascendance over the other gods\.$/,
            replace: "そしてそれにより、他の神々に対して相応の優位を得ることを望んでいます。"
        },
        {
            pattern: /^You, a newly trained (.*), have been heralded$/,
            replace: "新しく訓練された$1であるあなたは、"
        },
        {
            pattern: /^from birth as the instrument of (.*)\.  You are destined$/,
            replace: "生まれながらにして$1の代行者として告げられました。あなたは、"
        },
        {
            pattern: /^to recover the Amulet for your deity, or die in the$/,
            replace: "自らの神のために魔除けを奪還するか、さもなくばその過程で死ぬ運命にあります。"
        },
        {
            pattern: /^attempt\.  Your hour of destiny has come\.  For the sake$/,
            replace: "運命の時が来ました。我らすべてのために、"
        },
        {
            pattern: /^of us all:  Go bravely with (.*)!$/,
            replace: "$1と共に勇敢に進みなさい！"
        },
        {
            pattern: /^\[(.*) has chosen you to recover the Amulet of Yendor for (Her|Him)\.\]$/,
            replace: "［$1は$2のためにイェンダーの魔除けを奪還する者として、あなたを選びました。］"
        },
        {
            pattern: /^You read: "(.*)"\.$/,
            replace: "あなたは「$1」と読んだ。"
        },
        {
            pattern: /^A board beneath you squeaks (.*) loudly\.$/,
            replace: "足元の床板が$1と大きな音を立てて鳴った。"
        },
        {
            pattern: /^You avoid stepping into the (.*)\.$/,
            replace: "あなたは$1に足を踏み入れないようにした。"
        },
        {
            pattern: /^(.*):\[(.*)\]$/,
            replace: "$1：[$2]"
        },
        {
            pattern: /^What do you want to (.*)\? \[(.*)\] $/,
            replace: "何を$1しますか？ [$2] "
        },
        {
            pattern: /^You see here (.*)\.$/,
            replace: "ここに$1がある。"
        },
        {
            pattern: /^You kill (.*)!$/,
            replace: "あなたは$1を殺した！"
        },
        {
            pattern: /^You reveal (.*) secret doors!$/,
            replace: "あなたは $1 つの隠し扉を見つけた！"
        },
        {
            pattern: /^Unknown command '(.*)'\.$/,
            replace: "未知のコマンドです：'$1'"
        },
        {
            pattern: /^This (.*) tastes okay\.$/,
            replace: "この$1はまあまあの味がする。"
        },
        {
            pattern: /^You finish eating (.*)\.$/,
            replace: "あなたは$1を食べ終えた。"
        },
        {
            pattern: /^This (.*) is delicious!$/,
            replace: "この$1は美味しい！"
        },
        {
            pattern: /^You learn the \"(.*)\" spell\.$/,
            replace: "あなたは「$1」の呪文を習得した。"
        },
        {
            pattern: /^(.*) bites (.*)\.$/,
            replace: "$1が$2に噛み付いた。"
        },
        {
            pattern: /^(.*) is killed!$/,
            replace: "$1は殺された！"
        },
        {
            pattern: /^You swap places with (?:your)?\s*(.*)\.$/,
            replace: "あなたは$1と場所を入れ替わった。"
        },
        {
            pattern: /^(.*) eats (.*)\.$/,
            replace: "$1は$2を食べた。"
        },
        {
            pattern: /^(.*) blocks your path\.$/,
            replace: "$1が道を塞いでいる。"
        },
        {
            pattern: /^You stop.  (?:Your|The)?\s*(.*) is in the way!$/,
            replace: "止まった。$1が邪魔だ！"
        },
        {
            pattern: /^You miss (.*).$/,
            replace: "あなたの攻撃は$1に当たらなかった。"
        },
        {
            pattern: /^(.*) shoots out at you!$/,
            replace: "$1があなたに向かって放たれた！"
        },
        {
            pattern: /^(.*) misses you\.$/,
            replace: "$1はあなたに当たらなかった。"
        },
        {
            pattern: /^(.*) picks up (.*)\.$/,
            replace: "$1は$2を拾い上げた。"
        },
        {
            pattern: /^(.*) drops (.*)\.$/,
            replace: "$1は$2を落とした。"
        },
        {
            pattern: /^You destroy (.*)!$/,
            replace: "あなたは$1を破壊した！"
        },
        {
            pattern: /^(.*) misses (?:the|a|an)?\s*(.*)\.$/,
            replace: "$1の攻撃は$2に当たらなかった。"
        },
        {
            pattern: /^(.*) misses!$/,
            replace: "$1の攻撃は外れた！"
        },
        {
            pattern: /^(.*) misses it\.$/,
            replace: "$1の攻撃は当たらなかった。"
        },
        {
            pattern: /^(.*) bites!$/,
            replace: "$1が噛み付いた！"
        },
        {
            pattern: /^You hit (.*)\.$/,
            replace: "あなたは$1に命中させた。"
        },
        {
            pattern: /^(.*) strikes at your displaced image and misses you!$/,
            replace: "$1はあなたの分身を攻撃したが、外れた！"
        },
        {
            pattern: /^You hear (.*) squeak in the distance\.$/,
            replace: "遠くで$1の鳴き声が聞こえた。"
        },
        {
            pattern: /^(.*) suddenly falls asleep!$/,
            replace: "$1は突然眠りに落ちた！"
        },
        {
            pattern: /^(.*) wields a broad (.*)!$/,
            replace: "$1は大きな$2を構えた！"
        },
        {
            pattern: /^The broad (.*) welds itself to the (.*)'s hand!$/,
            replace: "大きな$1が$2の手に張り付いた！"
        },
        {
            pattern: /^(.*) hits!$/,
            replace: "$1が命中した！"
        },
        {
            pattern: /^(.*) swings (?:her|him|his|its)\s*(.*)\.$/,
            replace: "$1は$2を振り回した。"
        },
        {
            pattern: /^(.*) throws (.*)!$/,
            replace: "$1は$2を投げた！"
        },
        {
            pattern: /^You are almost hit by (.*)\.$/,
            replace: "$1が当たりそうになった！"
        },
        {
            pattern: /^You are hit by (.*)\$/,
            replace: "$1が命中した。"
        },
        {
            pattern: /^(.*) wields (.*)!$/,
            replace: "$1は$2を構えた！"
        },
        {
            pattern: /^(.*) shoots (.*)!$/,
            replace: "$1は$2を放った！"
        },
        {
            pattern: /^(.*) zaps (.*)!$/,
            replace: "$1は$2をザップした！"
        },
        {
            pattern: /^You attack (.*)\.$/,
            replace: "あなたは$1を攻撃した。"
        },
        {
            pattern: /^(.*) touches (.*)\.$/,
            replace: "$1は$2に触れた。"
        },
        {
            pattern: /^It misses (.*)\.$/,
            replace: "それは$1に当たらなかった。"
        },
        {
            pattern: /^It bites (.*)\.$/,
            replace: "それは$1に噛み付いた。"
        },
        {
            pattern: /^(.*) just!$/,
            replace: "$1 ちょうど！"
        },
        {
            pattern: /^(.*) hits it\.!$/,
            replace: "$1は命中した。"
        },
        // フレーズパターン（再帰翻訳用）
        {
            pattern: /^(.*) corpse$/,
            replace: "$1の屍"
        },
        {
            pattern: /^(.*) statue$/,
            replace: "$1の像"
        },
        {
            pattern: /^(.*) egg$/,
            replace: "$1の卵"
        },
        {
            pattern: /^(.*) scroll$/,
            replace: "$1の巻物"
        },
        {
            pattern: /^(.*) potion$/,
            replace: "$1のポーション"
        },
        {
            pattern: /^(.*) wand$/,
            replace: "$1の杖"
        },
        {
            pattern: /^(.*) ring$/,
            replace: "$1の指輪"
        },
        {
            pattern: /^(.*) spellbook$/,
            replace: "$1の魔導書"
        },
        {
            pattern: /^potion of (.*)$/,
            replace: "$1のポーション"
        },
        {
            pattern: /^scroll of (.*)$/,
            replace: "$1の巻物"
        },
        {
            pattern: /^wand of (.*)$/,
            replace: "$1の杖"
        },
        {
            pattern: /^ring of (.*)$/,
            replace: "$1の指輪"
        },
        {
            pattern: /^spellbook of (.*)$/,
            replace: "$1の魔導書"
        },
        {
            pattern: /^(.*) (human|elf|dwarf|gnome|orc)$/,
            replace: "$1の$2"
        },
    ];
}
