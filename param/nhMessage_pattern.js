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
            pattern: /^What do you want to (.*)\? \[(.*)\]$/,
            replace: "何を$1しますか？ [$2]"
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
            pattern: /^You stop.  (?:Your|The)?\s*(.*) doesn't want to swap places\.$/,
            replace: "止まった。$1が場所を交換したがらない。"
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
            pattern: /^You hit (.*)!$/,
            replace: "あなたは$1に命中させた！"
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
            pattern: /^(.*) touches (.*)!$/,
            replace: "$1は$2に触れた！"
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
            pattern: /^It hits (.*)\.$/,
            replace: "それは$1に当たった。"
        },
        {
            pattern: /^(.*) just$/,
            replace: "$1 ちょうど"
        },
        {
            pattern: /^(.*) hits it\.!$/,
            replace: "$1は命中した。"
        },
        {
            pattern: /^(.*) hits (.*)\.$/,
            replace: "$1は$2に当たった。"
        },


        // フレーズパターン（再帰翻訳用）
        {
            pattern: /^pair of (.*)$/,
            replace: "一組の$1"
        },

        {
            pattern: /^(.*) (human|elf|dwarf|gnome|orc)$/,
            replace: "$1の$2"
        },


        //
        {
            pattern: /^You are frozen by (.*)'s gaze!$/,
            replace: "$1の視線で凍りついた！"
        },
        {
            pattern: /^You have a little trouble lifting (.*)\.$/,
            replace: "$1を持ち上げるのに少し苦労した。"
        },
        {
            pattern: /^You have trouble lifting (.*)\.$/,
            replace: "$1を持ち上げるのに苦労した。"
        },
        {
            pattern: /^You have much trouble lifting (.*)\.$/,
            replace: "$1を持ち上げるのに非常に苦労している。"
        },
        {
            pattern: /^You have much trouble lifting (.*)\. Continue*$/,
            replace: "$1を持ち上げるのに非常に苦労している。続けますか？"
        },
        {
            pattern: /^You drop (.*)\.$/,
            replace: "あなたは$1を落とした。"
        },
        {
            pattern: /^You decipher the label on your (.*)\.$/,
            replace: "あなたは$1のラベルを解読した。"
        },
        {
            pattern: /^Your (.*) glows blue for a moment\.$/,
            replace: "あなたの$1が一瞬青く光った。"
        },
        {
            pattern: /^A gush of water hits (.*)!$/,
            replace: "勢いよく噴き出した水が$1に当たった！"
        },
        {
            pattern: /^You escape (.*)\.$/,
            replace: "あなたは$1から逃れた。"
        },
        {
            pattern: /^There is a staircase up to level (.*) here\.$/,
            replace: "ここにレベル$1へ上がる階段がある。"
        },
        {
            pattern: /^Welcome to experience level (.*)\.$/,
            replace: "経験レベル$1へようこそ。"
        },
        {
            pattern: /(.*) rots away\.$/,
            replace: "$1は腐り果てた。"
        },
        {
            pattern: /(.*) glows silver for a while\.$/,
            replace: "$1はしばらくの間銀色に光った。"
        },
        {
            pattern: /(.*) turns to dust and falls to the floor!$/,
            replace: "$1は塵となって床に落ちた！"
        },
        {
            pattern: /(.*) suddenly appears close by!$/,
            replace: "突然すぐそばに$1が現れた！"
        },
        {
            pattern: /(.*) lands on (.*)\.$/,
            replace: "$1が$2に着地した。"
        },
        {
            pattern: /There is (.*) here\.$/,
            replace: "ここに$1がある。"
        },
        {
            pattern: /(.*) isn't a suitable secondary weapon\.$/,
            replace: "$1は予備の武器として適していません。"
        },
        {
            pattern: /You were wearing (.*)\.$/,
            replace: "あなたは$1を身に着けていた。"
        },
        {
            pattern: /(.*) thrusts (?:her|him|his|its) (.*)\.$/,
            replace: "$1が$2を突き出した。"
        },
        {
            pattern: /(.*) vanishes and reappears next to you\.$/,
            replace: "$1は消え、あなたの隣に再び現れた。"
        },
        {
            pattern: /(.*) shifts location\.$/,
            replace: "$1が場所を移動した。"
        },
        {
            pattern: /(.*) opens a door\.$/,
            replace: "$1がドアを開けた。"
        },
        {
            pattern: /(.*) bites again!$/,
            replace: "$1が再び噛み付いた！"
        },
        {
            pattern: /Wait!  There's (.*) hiding under (.*)!$/,
            replace: "待て！ $2 の下に $1 が隠れている！"
        },
        {
            pattern: /(.*) passes between the iron bars.\.$/,
            replace: "$1は鉄格子を通り抜けた。"
        },
        {
            pattern: /You hear (.*) incant (.*)\.$/,
            replace: "$1が$2を唱えるのが聞こえた。"
        },
        {
            pattern: /(.*) looks better.\.$/,
            replace: "$1の具合が良くなったようだ。"
        },
        {
            pattern: /(.*) vanishes!$/,
            replace: "$1は消えた！"
        },
        {
            pattern: /(.*) drinks (.*)!$/,
            replace: "$1は$2を飲んだ！"
        },
        {
            pattern: /(.*) wakes up\.$/,
            replace: "$1は目が覚めた。"
        },
        {
            pattern: /(.*) screams!$/,
            replace: "$1は叫んだ！"
        },
        {
            pattern: /You enter (.*) hall!$/,
            replace: "あなたは$1の広間に入った！"
        },
        {
            pattern: /(.*) suddenly appears!$/,
            replace: "突然$1が現れた！"
        },
        {
            pattern: /You cannot escape from (.*)!$/,
            replace: "$1からは逃げられない！"
        },
        {
            pattern: /The air crackles around (.*)\.$/,
            replace: "$1の周囲の空気がパチパチと鳴っている。"
        },
        {
            pattern: /body rises from the dead as (.*)\.\.\.$/,
            replace: "死体が$1として蘇る..."
        },
        {
            pattern: /(.*) claws itself out of the ground!$/,
            replace: "$1が地面から這い出てきた！"
        },
        {
            pattern: /(.*) is destroyed!$/,
            replace: "$1を破壊した！"
        },
        {
            pattern: /You know \"(.*)\" quite well already\.$/,
            replace: "あなたは「$1」をすでに習得している。"
        },
        {
            pattern: /You know \"(.*)\" quite well already\.$/,
            replace: "あなたは「$1)」をすでに習得している。"
        },
        {
            pattern: /knowledge of \"(.*)\" is keener\.$/,
            replace: "「$1」の知識はより鋭くなった。"
        },
        {
            pattern: /Suddenly, (.*) falls through a trap door\.$/,
            replace: "突然、$1が落とし戸から落ちた。"
        },
        {
            pattern: /You are hit by (.*)\.$/,
            replace: "$1があなたに当たった。"
        },
        {
            pattern: /(.*) changes into a (.*)\.$/,
            replace: "$1は$2に姿を変えた。"
        },
        {
            pattern: /(.*) summons help!$/,
            replace: "$1が助けを呼んだ！"
        },
        {
            pattern: /(.*) suddenly appears next to you!$/,
            replace: "突然、あなたの隣に$1が現れた！"
        },
        {
            pattern: /(.*) blocks the way!$/,
            replace: "$1が道を塞いでいる！"
        },
        {
            pattern: /(.*) appears next to you!$/,
            replace: "$1があなたの隣に現れた！"
        },
        {
            pattern: /You kick (.*)\.$/,
            replace: "あなたは$1を蹴った。"
        },
        {
            pattern: /(.*) is furious!$/,
            replace: "$1は激怒している！"
        },
        {
            pattern: /(.*) jumps, nimbly evading your kick\.$/,
            replace: "$1はジャンプし、あなたの蹴りを軽やかにかわした。"
        },
        {
            pattern: /(.*) takes all your possessions\.$/,
            replace: "$1はあなたの所持品をすべて奪った。"
        },
        {
            pattern: /an empty unlocked (.*)$/,
            replace: "空でロック解除済みの$1"
        },
        {
            pattern: /^You have a little trouble removing (.*)\.$/,
            replace: "$1の取り外しに少し手間取っています。"
        },
        {
            pattern: /^You do not owe (.*) anything\.$/,
            replace: "あなたは$1に何も借りていない。"
        },
        {
            pattern: /^My, this is a yummy (.*)!$/,
            replace: "あらまあ、これはおいしい$1ね！"
        },
        {
            pattern: /^(.*) called (.*)$/,
            replace: "$1と呼ばれる$2"
        },
        {
            pattern: /^(.*) bounces!$/,
            replace: "$1が跳ねかえった！"
        },
        {
            pattern: /^the peaceful (.*)$/,
            replace: "平和的な$1"
        },
        {
            pattern: /^You see (.*) slither under (.*)\.$/,
            replace: "$1が$2の下にすべり込むのが見える。"
        },
        {
            pattern: /^There is a branch staircase down to (.*) here\.$/,
            replace: "ここから分岐する階段を降りると、$1の場所へたどり着きます。"
        },
        {
            pattern: /^(.*) appears confused\.$/,
            replace: "$1は困惑しているようだ。"
        },
        {
            pattern: /^You (.*) glows blue for a moment\.$/,
            replace: "あなたの$1が、一瞬青く輝く"
        },
        {
            pattern: /^You add the \"(.*)\" spell to your repertoire, as (.*)\.$/,
            replace: "あなたは「$1」の呪文を習得した。-$2-"
        },
        {
            pattern: /^Wiped out all (.*)\.$/,
            replace: "$1を全滅させた。"
        },
        {
            pattern: /^You have found (.*)!$/,
            replace: "あなたは$1を見つけた！"
        },
        {
            pattern: /^You are now wearing (.*)\.$/,
            replace: "あなたは$1を身に着けています。"
        },
        {
            pattern: /^You cannot wear armor over (.*)\.$/,
            replace: "$1の上に防具を着用することはできません。"
        },
        {
            pattern: /^Your (.*) crumbles and turns to dust!$/,
            replace: "$1が粉々に砕け、塵となりました！"
        },
        {
            pattern: /^(.*) turns to flee\.$/,
            replace: "$1が逃げ出した。"
        },
        {
            pattern: /^(.*) pretends to be friendly to (.*)\.$/,
            replace: "$1が$2に親しみを示した。"
        },
        {
            pattern: /^(.*) smiles at (.*) engagingly\.$/,
            replace: "$1は$2に愛嬌たっぷりに微笑む。"
        },
        {
            pattern: /^(.*) steals a saddle from (.*)!$/,
            replace: "$1は$2から鞍を盗んだ！"
        },
        {
            pattern: /^(.*) suddenly disappears!!$/,
            replace: "$1は突然姿を消した！"
        },
        {
            pattern: /^(.*) pretends to be friendly\.$/,
            replace: "$1は友好的なふりをする。"
        },
        {
            pattern: /^(.*) charms you.  You gladly start removing your (.*). \.$/,
            replace: "$1があなたを魅了する。あなたは喜んで$2を外し始める。"
        },
        {
            pattern: /^(.*) steals (.*)!$/,
            replace: "$1は$2を盗んだ！"
        },
        {
            pattern: /^She stole (.*)\.$/,
            replace: "彼女は$1を盗んだ！"
        },
        {
            pattern: /^(.*) disarms your (.*)\.$/,
            replace: "$1はあなたの$2を解除します。"
        },
        {
            pattern: /^You finish taking off your (.*)\.$/,
            replace: "$1を外し終えた。"
        },
        {
            pattern: /^(.*) stole (.*)\.$/,
            replace: "$1は$2を盗んだ！"
        },
        {
            pattern: /^(.*) tries to rob you, but there is nothing to steal!$/,
            replace: "$1は盗もうとしたが、盗める物がなかった。"
        },
        {
            pattern: /^(.*) tries to rob you, but isn't interested in gold\.$/,
            replace: "$1はあなたを略奪しようとするが、金には興味がない。"
        },
        {
            pattern: /^(.*) containing (.*) items$/,
            replace: "$1（中身：$2個のアイテム）"
        },
        {
            pattern: /^You begin bashing monsters with your (.*)\.$/,
            replace: "あなたは$1でモンスターを叩き始める。"
        },
        {
            pattern: /^(.*) on the head\.$/,
            replace: "$1が頭に当たった。"
        },
        {
            pattern: /^(.*) - (.*)\.$/,
            replace: "$1 - $2"
        },
        {
            pattern: /^A board beneath (.*) squeaks (.*) loudly\.$/,
            replace: "$1の足元の床板が$2と大きな音を立てて鳴った。"
        },
        {
            pattern: /^You hear (.*) squeak nearby\.$/,
            replace: "あなたは近くで$1のきしみ音を聞いた。"
        },
        {
            pattern: /^You knock (.*) backward with a forceful strike!$/,
            replace: "あなたは強力な一撃で$1を後方に叩き落とした！"
        },
        {
            pattern: /^(.*) wobbles from your powerful strike!$/,
            replace: "$1はあなたの強力な一撃で揺れた！"
        },
        {
            pattern: /^(.*) is caught in (.*)'s explosion!$/,
            replace: "$1は$2の爆発に巻き込まれた！"
        },
        {
            pattern: /^You are caught in (.*)'s explosion!$/,
            replace: "あなたは$1の爆発に巻き込まれた！"
        },
        {
            pattern: /^the poor (.*)$/,
            replace: "かわいそうな$1"
        },
        {
            pattern: /^Unlock it with your (.*)\?$/,
            replace: "$1で解錠しますか？"
        },
        {
            pattern: /^You are hit by (.*)!$/,
            replace: "あなたは$1に攻撃された！"
        },
        {
            pattern: /^You succeed in unlocking (.*)\.$/,
            replace: "$1の解錠に成功した。"
        },
        {
            pattern: /^Swapping: (.*)$/,
            replace: "$1を入れ替えた。"
        },
        {
            pattern: /^Collecting: (.*)$/,
            replace: "$1を集めた。"
        },
        {
            pattern: /^Moving: (.*)$/,
            replace: "$1を移動させた。"
        },



        //{
        //    pattern: /^Your (.*)$/,
        //    replace: "あなたの$1"
        //},
    ];
}
