import type { GkLang } from "@/lib/gk/types";

// Interface labels for the GK/GS section in English and Hindi. Only the app's own UI text is translated here;
// questions, notes and news are always shown in the language their source published them in.

const STRINGS = {
  sectionEyebrow: { en: "GK/GS", hi: "सामान्य ज्ञान / सामान्य अध्ययन" },
  overview: { en: "Overview", hi: "अवलोकन" },
  india: { en: "Indian GK/GS", hi: "भारत GK/GS" },
  bihar: { en: "Bihar GK/GS", hi: "बिहार GK/GS" },
  currentAffairs: { en: "Current Affairs", hi: "समसामयिकी" },
  language: { en: "Language", hi: "भाषा" },
  sections: { en: "GK/GS sections", hi: "GK/GS खंड" },

  hubTitle: { en: "GK/GS & Current Affairs", hi: "सामान्य ज्ञान एवं समसामयिकी" },
  hubIntro: {
    en: "Practice questions, study notes and the latest official news, fetched live from public sources. Nothing here is saved: quiz answers and scores stay in this tab only.",
    hi: "अभ्यास प्रश्न, अध्ययन सामग्री और ताज़ा सरकारी समाचार, सार्वजनिक स्रोतों से सीधे लाए गए। यहाँ कुछ भी सहेजा नहीं जाता: क्विज़ के उत्तर और स्कोर केवल इसी टैब में रहते हैं।",
  },
  hubIndia: {
    en: "General knowledge quiz (Open Trivia Database) and study notes on history, geography, polity, economy, science, environment and culture.",
    hi: "सामान्य ज्ञान क्विज़ (Open Trivia Database) तथा इतिहास, भूगोल, राजव्यवस्था, अर्थव्यवस्था, विज्ञान, पर्यावरण और संस्कृति पर अध्ययन सामग्री।",
  },
  hubBihar: {
    en: "Study notes on Bihar's history, rivers, culture, economy, polity and personalities. No verified Bihar MCQ source is available, so there is no Bihar quiz.",
    hi: "बिहार के इतिहास, नदियों, संस्कृति, अर्थव्यवस्था, राजव्यवस्था और व्यक्तित्वों पर अध्ययन सामग्री। बिहार के सत्यापित MCQ का कोई स्रोत उपलब्ध नहीं है, इसलिए बिहार क्विज़ नहीं है।",
  },
  hubNews: {
    en: "Latest press releases from the Press Information Bureau: national (PIB Delhi) and Bihar (PIB Patna).",
    hi: "पत्र सूचना कार्यालय (PIB) की ताज़ा विज्ञप्तियाँ: राष्ट्रीय (PIB दिल्ली) और बिहार (PIB पटना)।",
  },
  open: { en: "Open", hi: "खोलें" },
  sourcesTitle: { en: "Where the content comes from", hi: "सामग्री के स्रोत" },

  quizTab: { en: "Quiz", hi: "क्विज़" },
  notesTab: { en: "Study notes", hi: "अध्ययन सामग्री" },
  category: { en: "Category", hi: "श्रेणी" },
  questionsCount: { en: "Questions", hi: "प्रश्न" },
  startQuiz: { en: "Start quiz", hi: "क्विज़ शुरू करें" },
  loadingQuestions: { en: "Loading questions…", hi: "प्रश्न लाए जा रहे हैं…" },
  quizSourceNote: {
    en: "Questions come from the Open Trivia Database: world general-knowledge trivia, not India-specific competitive-exam questions. Its answer key is used as published; it provides no explanations.",
    hi: "प्रश्न Open Trivia Database से हैं: यह विश्व सामान्य ज्ञान की ट्रिविया है, भारत की प्रतियोगी परीक्षाओं के प्रश्न नहीं। उत्तर कुंजी स्रोत के अनुसार है; स्रोत व्याख्या नहीं देता।",
  },
  englishOnlyTitle: { en: "", hi: "ये प्रश्न केवल अंग्रेज़ी में उपलब्ध हैं" },
  englishOnlyBody: {
    en: "",
    hi: "Open Trivia Database हिन्दी में प्रश्न नहीं देता, और हम बिना सत्यापन के अनुवाद नहीं दिखाते। आप चाहें तो अंग्रेज़ी प्रश्नों से अभ्यास कर सकते हैं।",
  },
  showEnglish: { en: "Show English questions", hi: "अंग्रेज़ी प्रश्न दिखाएँ" },
  questionOf: { en: "Question {n} of {total}", hi: "प्रश्न {n} / {total}" },
  answerOptions: { en: "Answer options", hi: "उत्तर विकल्प" },
  checkAnswer: { en: "Check answer", hi: "उत्तर जाँचें" },
  selectFirst: { en: "Select an option to check your answer.", hi: "उत्तर जाँचने के लिए एक विकल्प चुनें।" },
  correct: { en: "Correct", hi: "सही" },
  incorrect: { en: "Incorrect", hi: "गलत" },
  correctAnswerIs: { en: "Correct answer: {answer}", hi: "सही उत्तर: {answer}" },
  noExplanation: { en: "The source does not provide an explanation for this question.", hi: "स्रोत इस प्रश्न की व्याख्या नहीं देता।" },
  previous: { en: "Previous", hi: "पिछला" },
  next: { en: "Next", hi: "अगला" },
  finish: { en: "Finish quiz", hi: "क्विज़ समाप्त करें" },
  progressLabel: { en: "Questions checked", hi: "जाँचे गए प्रश्न" },
  palette: { en: "Jump to question", hi: "प्रश्न पर जाएँ" },
  resultTitle: { en: "Quiz result", hi: "क्विज़ परिणाम" },
  score: { en: "Score", hi: "स्कोर" },
  percentage: { en: "Percentage", hi: "प्रतिशत" },
  answeredCorrect: { en: "Correct", hi: "सही" },
  answeredWrong: { en: "Wrong", hi: "गलत" },
  skipped: { en: "Not checked", hi: "अनुत्तरित" },
  retry: { en: "Retry these questions", hi: "इन्हीं प्रश्नों को दोबारा करें" },
  newQuiz: { en: "New quiz", hi: "नई क्विज़" },
  review: { en: "Review answers", hi: "उत्तरों की समीक्षा" },
  yourAnswer: { en: "Your answer: {answer}", hi: "आपका उत्तर: {answer}" },
  notAnswered: { en: "Not answered", hi: "उत्तर नहीं दिया" },
  noQuestions: { en: "No questions are available for this category right now.", hi: "इस श्रेणी के लिए अभी कोई प्रश्न उपलब्ध नहीं है।" },
  difficulty: { en: "Difficulty", hi: "कठिनाई" },

  notesIntro: {
    en: "Introductions of Wikipedia articles, fetched live. Wikipedia is community-edited, not an official source: check exam facts and figures against official publications.",
    hi: "विकिपीडिया लेखों के परिचय, सीधे लाए गए। विकिपीडिया समुदाय द्वारा संपादित है, आधिकारिक स्रोत नहीं: परीक्षा के तथ्य और आँकड़े आधिकारिक प्रकाशनों से मिलाएँ।",
  },
  notesLangNote: {
    en: "",
    hi: "हिन्दी और अंग्रेज़ी विकिपीडिया लेख अलग-अलग लिखे जाते हैं, अनुवाद नहीं हैं, इसलिए उनके तथ्य कभी-कभी भिन्न हो सकते हैं।",
  },
  noHindiArticle: {
    en: "",
    hi: "इस विषय पर कोई समीक्षित हिन्दी विकिपीडिया लेख उपलब्ध नहीं है।",
  },
  readEnglishArticle: { en: "Read the English article", hi: "अंग्रेज़ी लेख पढ़ें" },
  articleUnavailable: { en: "Wikipedia did not return this article.", hi: "विकिपीडिया ने यह लेख नहीं लौटाया।" },
  readMore: { en: "Show more", hi: "और दिखाएँ" },
  readLess: { en: "Show less", hi: "कम दिखाएँ" },
  readOnWikipedia: { en: "Read full article on Wikipedia", hi: "पूरा लेख विकिपीडिया पर पढ़ें" },
  biharNoQuizTitle: { en: "Why there is no Bihar quiz", hi: "बिहार क्विज़ क्यों नहीं है" },
  biharNoQuizBody: {
    en: "We could not find a public source that publishes Bihar GK/GS multiple-choice questions with a verified answer key, and we do not make questions up. This section shows study notes instead.",
    hi: "हमें ऐसा कोई सार्वजनिक स्रोत नहीं मिला जो सत्यापित उत्तर कुंजी के साथ बिहार GK/GS के बहुविकल्पीय प्रश्न प्रकाशित करता हो, और हम प्रश्न स्वयं नहीं बनाते। इसलिए यहाँ अध्ययन सामग्री दी गई है।",
  },
  schemesTitle: { en: "Government schemes and official data", hi: "सरकारी योजनाएँ और आधिकारिक आँकड़े" },
  schemesBody: {
    en: "Wikipedia has no reliable articles on most Bihar government schemes, and the Bihar government portals offer no feed or API we can read. For schemes, budgets and Economic Survey figures, use the official portal. Central-government news about Bihar appears under Current Affairs (PIB Patna).",
    hi: "बिहार सरकार की अधिकांश योजनाओं पर विकिपीडिया में विश्वसनीय लेख नहीं हैं, और बिहार सरकार के पोर्टल कोई फ़ीड या API नहीं देते। योजनाओं, बजट और आर्थिक सर्वेक्षण के आँकड़ों के लिए आधिकारिक पोर्टल देखें। बिहार से जुड़ी केंद्र सरकार की खबरें समसामयिकी (PIB पटना) में हैं।",
  },
  officialPortal: { en: "Bihar government portal", hi: "बिहार सरकार पोर्टल" },

  newsIntro: {
    en: "Official press releases, newest first. These are news to read, not quiz questions. Check the date on each item.",
    hi: "आधिकारिक प्रेस विज्ञप्तियाँ, नवीनतम पहले। ये पढ़ने के लिए समाचार हैं, क्विज़ प्रश्न नहीं। हर समाचार की तिथि देखें।",
  },
  regionIndia: { en: "India (PIB Delhi)", hi: "भारत (PIB दिल्ली)" },
  regionBihar: { en: "Bihar (PIB Patna)", hi: "बिहार (PIB पटना)" },
  region: { en: "Region", hi: "क्षेत्र" },
  published: { en: "Published {date}", hi: "प्रकाशित {date}" },
  dateUnavailable: { en: "Publication date not available from the source", hi: "स्रोत से प्रकाशन तिथि उपलब्ध नहीं" },
  olderItem: { en: "{days} days old", hi: "{days} दिन पुराना" },
  readOnPib: { en: "Read on PIB", hi: "PIB पर पढ़ें" },
  feedQuiet: {
    en: "The newest release in this feed is from {date}. The source has not published anything more recent.",
    hi: "इस फ़ीड की सबसे नई विज्ञप्ति {date} की है। स्रोत ने इसके बाद कुछ प्रकाशित नहीं किया है।",
  },
  noNews: {
    en: "This feed returned no releases right now.",
    hi: "इस फ़ीड ने अभी कोई विज्ञप्ति नहीं लौटाई।",
  },
  noNewsBiharHi: {
    en: "",
    hi: "PIB पटना की हिन्दी फ़ीड में अभी कोई विज्ञप्ति नहीं है। अंग्रेज़ी विज्ञप्तियाँ उपलब्ध हो सकती हैं।",
  },
  showEnglishNews: { en: "Show English releases", hi: "अंग्रेज़ी विज्ञप्तियाँ दिखाएँ" },
  showingEnglish: {
    en: "",
    hi: "नीचे की विज्ञप्तियाँ अंग्रेज़ी में हैं (मूल भाषा)।",
  },
  backToHindi: { en: "Back to Hindi", hi: "वापस हिन्दी पर" },

  loading: { en: "Loading…", hi: "लोड हो रहा है…" },
  retryLoad: { en: "Try again", hi: "फिर से कोशिश करें" },
  staleNotice: {
    en: "The source is not responding right now. Showing the copy fetched on {date}.",
    hi: "स्रोत अभी जवाब नहीं दे रहा। {date} को लाई गई प्रति दिखाई जा रही है।",
  },
  fetchedAt: { en: "Fetched {date}", hi: "{date} को लाया गया" },
  sourceLine: { en: "Source: {name} · {license}", hi: "स्रोत: {name} · {license}" },
  networkError: { en: "Network error. Check your connection and try again.", hi: "नेटवर्क त्रुटि। अपना कनेक्शन जाँचें और फिर कोशिश करें।" },
  rateLimited: { en: "The source is busy. Wait a few seconds and try again.", hi: "स्रोत व्यस्त है। कुछ सेकंड रुककर फिर कोशिश करें।" },
  englishLabel: { en: "English", hi: "English (अंग्रेज़ी)" },
} as const satisfies Record<string, Record<GkLang, string>>;

export type StringKey = keyof typeof STRINGS;

/** Looks up a label and fills {placeholders}. Hindi-only strings (empty in English) are never shown in English mode. */
export function t(lang: GkLang, key: StringKey, vars?: Record<string, string | number>): string {
  let s: string = STRINGS[key][lang] || STRINGS[key].en;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

export function formatDate(iso: string, lang: GkLang, withTime = true) {
  return new Intl.DateTimeFormat(lang === "hi" ? "hi-IN" : "en-IN", {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" } : {}),
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}
