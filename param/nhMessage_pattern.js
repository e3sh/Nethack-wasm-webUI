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
            replace: "You see here $1."
        },
        {
            pattern: /^You kill the (.*)!$/,
            replace: "You kill the $1!"
        },
        {
            pattern: /^You reveal (.*) secret doors!$/,
            replace: "You reveal $1 secret doors!"
        },
        {
            pattern: /^Unknown command '(.*)'\.$/,
            replace: "Unknown command $1"
        },
        {
            pattern: /^This (.*) tastes okay\.$/,
            replace: "This $1 tastes okay."
        },
        {
            pattern: /^You finish eating the (.*)\.$/,
            replace: "You finish eating the $1."
        },
        {
            pattern: /^This (.*) is delicious!$/,
            replace: "This $1 is delicious!"
        },
        {
            pattern: /^You learn the \"(.*)\" spell\.$/,
            replace: "You learn the $1 spell"
        },
        {
            pattern: /^The (.*) bites the (.*)\.$/,
            replace: "The $1 bites the $2."
        },
        {
            pattern: /^The (.*) is killed!$/,
            replace: "The $1 is killed!"
        },
        {
            pattern: /^You swap places with your (.*)\.$/,
            replace: "You swap places with your $1."
        },
        {
            pattern: /^You swap places with (.*)\.$/,
            replace: "You swap places with $1."
        },
        {
            pattern: /^Your (.*) eats a (.*)\.$/,
            replace: "Your $1 eats a $2."
        },
        {
            pattern: /^A (.*) blocks your path\.$/,
            replace: "A $1 blocks your path"
        },
        {
            pattern: /^You stop.  Your (.*) is in the way!$/,
            replace: "You stop.  Your $1 is in the way!"
        },
        {
            pattern: /^You miss the (.*).$/,
            replace: "You miss the $1."
        },
        {
            pattern: /^A (.*) shoots out at you!$/,
            replace: "A $1 shoots out at you!"
        },
        {
            pattern: /^A (.*) misses you\.$/,
            replace: "A $1 misses you."
        },
        {
            pattern: /^The (.*) picks up (.*)\.$/,
            replace: "The $1 picks up $2\."
        },
        {
            pattern: /^The (.*) drops (.*)\.$/,
            replace: "The $1 drops $2\."
        },
        {
            pattern: /^(.*) picks up (.*)\.$/,
            replace: "$1 picks up $2\."
        },
        {
            pattern: /^(.*) drops (.*)\.$/,
            replace: "$1 drops $2\."
        },
        {
            pattern: /^You destroy the (.*)!$/,
            replace: "You destroy the (.*)!"
        },
        {
            pattern: /^The (.*) misses (.*)\.$/,
            replace: "The $1 misses the $2."
        },
        {
            pattern: /^The (.*) misses the (.*)\.$/,
            replace: "The $1 misses the $2."
        },
        {
            pattern: /^The (.*) misses!$/,
            replace: "The $1 misses!"
        },
        {
            pattern: /^(.*) misses it\.$/,
            replace: "$1 misses it."
        },
        {
            pattern: /^The (.*) bites!$/,
            replace: "The $1 bites!"
        },
        {
            pattern: /^You hit the (.*)\.$/,
            replace: "You hit the $1."
        },
        {
            pattern: /^The (.*) strikes at your displaced image and misses you!$/,
            replace: "The $1 strikes at your displaced image and misses you!"
        },
        {
            pattern: /^You hear (.*) squeak in the distance\.$/,
            replace: "You hear $1 squeak in the distance."
        },
        {
            pattern: /^The (.*) suddenly falls asleep!$/,
            replace: "The $1 suddenly falls asleep!"
        },
        {
            pattern: /^The (.*) wields a broad (.*)!$/,
            replace: "The $1 wields a broad $2!"
        },
        {
            pattern: /^The broad (.*) welds itself to the (.*)'s hand!$/,
            replace: "The broad $1 welds itself to the $2's hand!"
        },
        {
            pattern: /^The (.*) hits!$/,
            replace: "The (.*) hits!"
        },
        {
            pattern: /^The (.*) swings (her|him) (.*)\.$/,
            replace: "The $1 swings $2 $3\."
        },
        {
            pattern: /^The (.*) throws (.*)!$/,
            replace: "The $1 throws $2!"
        },
        {
            pattern: /^You are almost hit by (.*)\.$/,
            replace: "You are almost hit by $1\."
        },
        {
            pattern: /^You are hit by (.*)\$/,
            replace: "You are hit by $1"
        },
        {
            pattern: /^The (.*) wields (.*)!$/,
            replace: "The $1 wields $2!"
        },
        {
            pattern: /^The (.*) shoots (.*)!$/,
            replace: "The $1 shoots $2!"
        },
        {
            pattern: /^The (.*) zaps (.*)!$/,
            replace: "The $1 zaps $2!"
        },
        {
            pattern: /^You attack (.*)\.!$/,
            replace: "You attack $1."
        },
        {
            pattern: /^The (.*) touches the (.*)\.!$/,
            replace: "The $1 touches the $2."
        },
        {
            pattern: /^It misses the (.*)\.!$/,
            replace: "It misses the $1."
        },
        {
            pattern: /^It bites the (.*)\.!$/,
            replace: "It bites the $1."
        },
        {
            pattern: /^(.*) just!$/,
            replace: "$1 just"
        },
        {
            pattern: /^The (.*) hits it\.!$/,
            replace: "The $1 hits it."
        },
    ];
}
