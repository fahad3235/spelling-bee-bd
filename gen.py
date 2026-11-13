# -*- coding: utf-8 -*-
r"""Spelling Bee BD — regenerates js/data.js and js/i18n.js from UTF-8 sources.

Run: python3 gen.py
Output files are pure ASCII (Bengali stored as \uXXXX escapes) so the
GitHub push API (ASCII-safe argv) never corrupts Bengali text.
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))

# (english, level, bangla meaning, english example, bangla example)
WORDS = [
    # Easy (20)
    ("friend", "easy", "বন্ধু", "Rahim is my best friend.", "রহিম আমার সবচেয়ে ভালো বন্ধু।"),
    ("because", "easy", "কারণ", "I stayed home because it rained.", "বৃষ্টি হয়েছিল বলে আমি বাড়িতে ছিলাম।"),
    ("tomorrow", "easy", "আগামীকাল", "We will meet tomorrow.", "আমরা আগামীকাল দেখা করব।"),
    ("receive", "easy", "পাওয়া", "I received a letter today.", "আমি আজ একটি চিঠি পেয়েছি।"),
    ("believe", "easy", "বিশ্বাস করা", "I believe you.", "আমি তোমাকে বিশ্বাস করি।"),
    ("surprise", "easy", "চমক", "The gift was a surprise.", "উপহারটি ছিল একটি চমক।"),
    ("remember", "easy", "মনে রাখা", "Remember to bring your book.", "তোমার বই আনতে মনে রেখো।"),
    ("different", "easy", "ভিন্ন", "This book is different.", "এই বইটি ভিন্ন।"),
    ("important", "easy", "গুরুত্বপূর্ণ", "This lesson is important.", "এই পাঠটি গুরুত্বপূর্ণ।"),
    ("children", "easy", "শিশুরা", "The children are playing.", "শিশুরা খেলছে।"),
    ("morning", "easy", "সকাল", "I wake up in the morning.", "আমি সকালে ঘুম থেকে উঠি।"),
    ("holiday", "easy", "ছুটির দিন", "Friday is a holiday.", "শুক্রবার ছুটির দিন।"),
    ("garden", "easy", "বাগান", "There are flowers in the garden.", "বাগানে ফুল আছে।"),
    ("family", "easy", "পরিবার", "My family lives in Dhaka.", "আমার পরিবার ঢাকায় থাকে।"),
    ("country", "easy", "দেশ", "Bangladesh is my country.", "বাংলাদেশ আমার দেশ।"),
    ("together", "easy", "একসাথে", "We work together.", "আমরা একসাথে কাজ করি।"),
    ("question", "easy", "প্রশ্ন", "Please ask your question.", "দয়া করে তোমার প্রশ্নটি করো।"),
    ("language", "easy", "ভাষা", "Bangla is our language.", "বাংলা আমাদের ভাষা।"),
    ("wonderful", "easy", "চমৎকার", "It was a wonderful day.", "দিনটি ছিল চমৎকার।"),
    ("listen", "easy", "শোনা", "Listen to the teacher.", "শিক্ষকের কথা শোনো।"),
    # Medium (20)
    ("necessary", "medium", "প্রয়োজনীয়", "Water is necessary for life.", "পানি জীবনের জন্য প্রয়োজনীয়।"),
    ("separate", "medium", "আলাদা", "Please keep them separate.", "দয়া করে এগুলো আলাদা রাখো।"),
    ("definitely", "medium", "অবশ্যই", "I will definitely come.", "আমি অবশ্যই আসব।"),
    ("environment", "medium", "পরিবেশ", "We must protect the environment.", "আমাদের পরিবেশ রক্ষা করতে হবে।"),
    ("government", "medium", "সরকার", "The government built a new school.", "সরকার একটি নতুন স্কুল বানিয়েছে।"),
    ("experience", "medium", "অভিজ্ঞতা", "She has much experience.", "তার অনেক অভিজ্ঞতা আছে।"),
    ("knowledge", "medium", "জ্ঞান", "Reading gives us knowledge.", "পড়া আমাদের জ্ঞান দেয়।"),
    ("library", "medium", "গ্রন্থাগার", "I borrowed a book from the library.", "আমি গ্রন্থাগার থেকে একটি বই ধার নিয়েছি।"),
    ("occasion", "medium", "উপলক্ষ", "Eid is a happy occasion.", "ঈদ একটি আনন্দের উপলক্ষ।"),
    ("restaurant", "medium", "রেস্তোরাঁ", "We ate at a restaurant.", "আমরা একটি রেস্তোরাঁয় খেয়েছি।"),
    ("successful", "medium", "সফল", "He is a successful teacher.", "তিনি একজন সফল শিক্ষক।"),
    ("beginning", "medium", "শুরু", "The beginning was difficult.", "শুরুটা কঠিন ছিল।"),
    ("calendar", "medium", "ক্যালেন্ডার", "Look at the calendar.", "ক্যালেন্ডারে দেখো।"),
    ("embarrass", "medium", "বিব্রত করা", "Do not embarrass him.", "তাকে বিব্রত কোরো না।"),
    ("recommend", "medium", "সুপারিশ করা", "I recommend this book.", "আমি এই বইটি সুপারিশ করি।"),
    ("similar", "medium", "একই রকম", "The two shirts are similar.", "দুটি শার্ট একই রকম।"),
    ("accessible", "medium", "সহজলভ্য", "The library is accessible to all.", "গ্রন্থাগারটি সবার জন্য সহজলভ্য।"),
    ("february", "medium", "ফেব্রুয়ারি", "February is the second month.", "ফেব্রুয়ারি বছরের দ্বিতীয় মাস।"),
    ("wednesday", "medium", "বুধবার", "Today is Wednesday.", "আজ বুধবার।"),
    ("business", "medium", "ব্যবসা", "He runs a small business.", "তিনি একটি ছোট ব্যবসা চালান।"),
    # Hard (20)
    ("accommodate", "hard", "জায়গা দেওয়া", "The hall can accommodate 200 people.", "হলটিতে ২০০ জনের জায়গা হবে।"),
    ("occurrence", "hard", "ঘটনা", "It was a rare occurrence.", "এটি একটি বিরল ঘটনা ছিল।"),
    ("conscience", "hard", "বিবেক", "Listen to your conscience.", "তোমার বিবেকের কথা শোনো।"),
    ("rhythm", "hard", "ছন্দ", "The song has a nice rhythm.", "গানটির ছন্দ সুন্দর।"),
    ("pneumonia", "hard", "নিউমোনিয়া", "He is ill with pneumonia.", "তিনি নিউমোনিয়ায় অসুস্থ।"),
    ("questionnaire", "hard", "প্রশ্নমালা", "Please fill in the questionnaire.", "দয়া করে প্রশ্নমালাটি পূরণ করুন।"),
    ("sincerely", "hard", "আন্তরিকভাবে", "Yours sincerely, Rahim.", "আন্তরিক শুভেচ্ছাসহ, রহিম।"),
    ("vacuum", "hard", "শূন্যস্থান", "There is a vacuum in the bottle.", "বোতলের ভেতরে শূন্যস্থান আছে।"),
    ("cemetery", "hard", "কবরস্থান", "The old cemetery is quiet.", "পুরোনো কবরস্থানটি নীরব।"),
    ("fluorescent", "hard", "প্রতিপ্রভ", "The fluorescent light is bright.", "প্রতিপ্রভ আলোটি উজ্জ্বল।"),
    ("guarantee", "hard", "নিশ্চয়তা", "The shop gives a one-year guarantee.", "দোকানটি এক বছরের নিশ্চয়তা দেয়।"),
    ("liaison", "hard", "যোগাযোগ", "He works as a liaison officer.", "তিনি যোগাযোগ কর্মকর্তা হিসেবে কাজ করেন।"),
    ("millennium", "hard", "সহস্রাব্দ", "We entered a new millennium in 2001.", "আমরা ২০০১ সালে নতুন সহস্রাব্দে প্রবেশ করেছি।"),
    ("noticeable", "hard", "লক্ষণীয়", "There was a noticeable change.", "একটি লক্ষণীয় পরিবর্তন হয়েছিল।"),
    ("parliament", "hard", "সংসদ", "Parliament passed the new law.", "সংসদ নতুন আইনটি পাস করেছে।"),
    ("privilege", "hard", "বিশেষ সুবিধা", "Education is a right, not a privilege.", "শিক্ষা একটি অধিকার, বিশেষ সুবিধা নয়।"),
    ("entrepreneur", "hard", "উদ্যোক্তা", "She is a young entrepreneur.", "তিনি একজন তরুণ উদ্যোক্তা।"),
    ("bureaucracy", "hard", "আমলাতন্ত্র", "The file moved slowly through the bureaucracy.", "ফাইলটি আমলাতন্ত্রের ভেতর দিয়ে ধীরে এগিয়েছিল।"),
    ("knowledgeable", "hard", "জ্ঞানী", "Our teacher is very knowledgeable.", "আমাদের শিক্ষক খুব জ্ঞানী।"),
    ("miscellaneous", "hard", "বিবিধ", "The box holds miscellaneous items.", "বাক্সটিতে বিবিধ জিনিস আছে।"),
]

# UI strings: key -> (English, Bangla)
STRINGS = {
    "appTitle": ("Spelling Bee BD", "স্পেলিং বি বিডি"),
    "tagline": ("Listen, spell, win — English spelling practice for Bangladeshi learners.",
                "শুনুন, বানান লিখুন, জিতুন — বাংলাদেশি শিক্ষার্থীদের জন্য ইংরেজি বানান চর্চা।"),
    "tabPlay": ("Play", "খেলুন"),
    "tabPractice": ("Practice", "চর্চা"),
    "tabWords": ("Word List", "শব্দতালিকা"),
    "tabScores": ("Scores", "স্কোর"),
    "langBtn": ("বাংলা", "English"),
    "levelLabel": ("Level", "স্তর"),
    "levelEasy": ("Easy", "সহজ"),
    "levelMedium": ("Medium", "মাঝারি"),
    "levelHard": ("Hard", "কঠিন"),
    "levelMixed": ("Mixed", "মিশ্র"),
    "startRound": ("Start Round", "রাউন্ড শুরু করুন"),
    "roundOf": ("Round of 10 words", "১০টি শব্দের রাউন্ড"),
    "livesLabel": ("Lives", "জীবন"),
    "scoreLabel": ("Score", "স্কোর"),
    "streakLabel": ("Streak", "ধারাবাহিক"),
    "wordLabel": ("Word", "শব্দ"),
    "listenBtn": ("🔊 Listen", "🔊 শুনুন"),
    "flashBtn": ("👁 Flash Word", "👁 শব্দ দেখুন"),
    "flashNote": ("Word flashes for 2 seconds — memorise it, then spell it!",
                  "শব্দটি ২ সেকেন্ড দেখাবে — মনে রাখুন, তারপর বানান লিখুন!"),
    "audioNote": ("No voice available on this device — use Flash Word instead.",
                  "এই ডিভাইসে ভয়েস পাওয়া যায়নি — শব্দ দেখুন ব্যবহার করুন।"),
    "hintBtn": ("💡 Hint (meaning, −50% points)", "💡 ইঙ্গিত (অর্থ, −৫০% পয়েন্ট)"),
    "hintUsed": ("Hint: ", "ইঙ্গিত: "),
    "typePlaceholder": ("Type the spelling here…", "এখানে বানানটি লিখুন…"),
    "submitBtn": ("Check Spelling", "বানান যাচাই করুন"),
    "skipBtn": ("Skip (−1 life)", "বাদ দিন (−১ জীবন)"),
    "timerLabel": ("Time left", "সময় বাকি"),
    "correctMsg": ("✓ Correct!", "✓ সঠিক!"),
    "wrongMsg": ("✗ Wrong — the correct spelling is: ", "✗ ভুল — সঠিক বানান: "),
    "timeoutMsg": ("⏰ Time up! The correct spelling is: ", "⏰ সময় শেষ! সঠিক বানান: "),
    "skippedMsg": ("Skipped — the correct spelling is: ", "বাদ দেওয়া হয়েছে — সঠিক বানান: "),
    "nextBtn": ("Next Word →", "পরের শব্দ →"),
    "seeResultsBtn": ("See Results", "ফলাফল দেখুন"),
    "roundOver": ("Round Over", "রাউন্ড শেষ"),
    "noLives": ("Out of lives!", "জীবন শেষ!"),
    "finalScore": ("Final Score", "চূড়ান্ত স্কোর"),
    "accuracyLabel": ("Accuracy", "সঠিকতার হার"),
    "bestStreakLabel": ("Best Streak", "সেরা ধারাবাহিকতা"),
    "missedLabel": ("Words to revise", "আবার চর্চা করার শব্দ"),
    "noneMissed": ("Perfect round — nothing missed!", "নিখুঁত রাউন্ড — কিছুই ভুল হয়নি!"),
    "playAgainBtn": ("Play Again", "আবার খেলুন"),
    "newBest": ("🎉 New best score!", "🎉 নতুন সেরা স্কোর!"),
    "practiceTitle": ("Practice Mode — no lives, no timer, just learning",
                     "চর্চা মোড — জীবন নেই, সময়সীমা নেই, শুধু শেখা"),
    "practiceStart": ("Start Practising", "চর্চা শুরু করুন"),
    "practiceWord": ("Spell this word:", "এই শব্দটির বানান লিখুন:"),
    "practiceDone": ("Practised", "চর্চা হয়েছে"),
    "practiceCorrect": ("words correct", "টি শব্দ সঠিক"),
    "practiceNext": ("Next Word →", "পরের শব্দ →"),
    "practiceAgain": ("Practise Again", "আবার চর্চা করুন"),
    "wordsTitle": ("All Words", "সব শব্দ"),
    "searchPlaceholder": ("Search English or Bangla…", "ইংরেজি বা বাংলা খুঁজুন…"),
    "filterAll": ("All", "সব"),
    "filterBookmarked": ("★ Bookmarked", "★ সংরক্ষিত"),
    "emptyWords": ("No words match your search.", "আপনার খোঁজের সঙ্গে কোনো শব্দ মিলছে না।"),
    "bookmarkHint": ("Tap ★ to bookmark a word for revision.", "পুনরালোচনার জন্য ★ চেপে শব্দ সংরক্ষণ করুন।"),
    "scoresTitle": ("Your Scores", "আপনার স্কোর"),
    "bestScore": ("Best Score", "সেরা স্কোর"),
    "roundsPlayed": ("Rounds Played", "খেলা রাউন্ড"),
    "totalAccuracy": ("Overall Accuracy", "সামগ্রিক সঠিকতা"),
    "historyTitle": ("Round History", "রাউন্ডের ইতিহাস"),
    "noHistory": ("No rounds played yet — start your first round!", "এখনো কোনো রাউন্ড খেলা হয়নি — প্রথম রাউন্ড শুরু করুন!"),
    "exportBtn": ("Export Data (JSON)", "তথ্য রপ্তানি (JSON)"),
    "importBtn": ("Import Data", "তথ্য আমদানি"),
    "eraseBtn": ("Erase All Data", "সব তথ্য মুছে ফেলুন"),
    "eraseConfirm": ("Type DELETE to erase everything", "সব মুছতে DELETE লিখুন"),
    "eraseDone": ("All data erased.", "সব তথ্য মুছে ফেলা হয়েছে।"),
    "eraseCancel": ("Erase cancelled.", "মোছা বাতিল করা হয়েছে।"),
    "importOk": ("Data imported.", "তথ্য আমদানি হয়েছে।"),
    "importBad": ("Invalid backup file.", "অবৈধ ব্যাকআপ ফাইল।"),
    "exportedAt": ("Exported", "রপ্তানি"),
    "meaningLabel": ("Meaning", "অর্থ"),
    "exampleLabel": ("Example", "উদাহরণ"),
    "pointsLabel": ("points", "পয়েন্ট"),
    "levelPoints": ("Easy 10 · Medium 15 · Hard 20 points, +1 per streak (max +5), hint halves points",
                    "সহজ ১০ · মাঝারি ১৫ · কঠিন ২০ পয়েন্ট, ধারাবাহিকতায় +১ (সর্বোচ্চ +৫), ইঙ্গিতে পয়েন্ট অর্ধেক"),
    "howTitle": ("How to Play", "কীভাবে খেলবেন"),
    "how1": ("1. Pick a level and start a round of 10 words. You have 3 lives and 45 seconds per word.",
             "১. একটি স্তর বেছে ১০টি শব্দের রাউন্ড শুরু করুন। প্রতি শব্দে ৩টি জীবন ও ৪৫ সেকেন্ড সময়।"),
    "how2": ("2. Press Listen to hear the word (or Flash Word to see it for 2 seconds), then type its spelling.",
             "২. শব্দটি শুনতে Listen চাপুন (বা ২ সেকেন্ড দেখতে Flash Word), তারপর বানানটি লিখুন।"),
    "how3": ("3. A wrong answer, a skip, or running out of time costs 1 life. Hints halve the points for that word.",
             "৩. ভুল উত্তর, বাদ দেওয়া বা সময় শেষ হলে ১টি জীবন যাবে। ইঙ্গিত নিলে ওই শব্দের পয়েন্ট অর্ধেক হবে।"),
    "how4": ("4. Consecutive correct answers build a streak bonus. Beat your best score!",
             "৪. পরপর সঠিক উত্তরে ধারাবাহিক বোনাস বাড়ে। নিজের সেরা স্কোর ছাড়িয়ে যান!"),
    "footer": ("Fully offline · No account · Your scores stay on your device · Words are common English words with short Bangla glosses for learners — not exam answers.",
               "সম্পূর্ণ অফলাইন · কোনো অ্যাকাউন্ট নয় · আপনার স্কোর আপনার ডিভাইসেই থাকে · শব্দগুলো শিক্ষার্থীদের জন্য সংক্ষিপ্ত বাংলা অর্থসহ সাধারণ ইংরেজি শব্দ — পরীক্ষার উত্তর নয়।"),
    "roundWordCount": ("Word", "শব্দ"),
    "ofLabel": ("of", "এর মধ্যে"),
    "timeUp": ("Time's up!", "সময় শেষ!"),
    "listenAgain": ("Listen again", "আবার শুনুন"),
}

def esc(obj):
    return json.dumps(obj, ensure_ascii=True, indent=2)

def main():
    words = []
    for i, (en, level, bn, ex, exBn) in enumerate(WORDS, start=1):
        words.append({"id": i, "en": en, "level": level, "bn": bn, "ex": ex, "exBn": exBn})
    data_js = (
        "/* Spelling Bee BD - word list (60 words, 20 per level).\n"
        "   Generated by gen.py; Bengali stored as \\uXXXX escapes (pure ASCII). */\n"
        "const WORDS = " + esc(words) + ";\n"
        "if (typeof window !== 'undefined') window.BEE_DATA = { WORDS };\n"
        "if (typeof module !== 'undefined') module.exports = { WORDS };\n"
    )
    with open(os.path.join(HERE, "js", "data.js"), "w", encoding="ascii") as f:
        f.write(data_js)

    strings = {k: {"en": v[0], "bn": v[1]} for k, v in STRINGS.items()}
    i18n_js = (
        "/* Spelling Bee BD - UI strings (English / Bangla).\n"
        "   Generated by gen.py; Bengali stored as \\uXXXX escapes (pure ASCII). */\n"
        "const STRINGS = " + esc(strings) + ";\n"
        "if (typeof window !== 'undefined') window.BEE_I18N = { STRINGS };\n"
        "if (typeof module !== 'undefined') module.exports = { STRINGS };\n"
    )
    with open(os.path.join(HERE, "js", "i18n.js"), "w", encoding="ascii") as f:
        f.write(i18n_js)

    counts = {}
    for _, level, *_ in WORDS:
        counts[level] = counts.get(level, 0) + 1
    print("words:", len(words), counts, "| strings:", len(strings))

if __name__ == "__main__":
    main()
