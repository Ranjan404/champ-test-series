import type { NotesSection } from "./types";

// Study-note topics for the India and Bihar sections. Each entry names an English Wikipedia article and, where one
// exists, the Hindi Wikipedia article that Wikipedia itself links to it (checked against the interlanguage links on
// 2026-10-18). `hi: null` means there is no Hindi article, or its introduction was reviewed on that date and found
// unsuitable for study (reason noted inline). The UI then says no reviewed Hindi article is available instead of
// showing English text as Hindi. These are article titles only: all text is fetched live from Wikipedia.

export interface NoteTopic {
  en: string;
  hi: string | null;
}

export interface NoteGroup {
  id: string;
  en: string;
  hi: string;
  topics: NoteTopic[];
}

export const NOTE_GROUPS: Record<NotesSection, NoteGroup[]> = {
  india: [
    {
      id: "history",
      en: "History & Freedom Struggle",
      hi: "इतिहास एवं स्वतंत्रता संग्राम",
      topics: [
        { en: "Indus Valley Civilisation", hi: "सिंधु घाटी सभ्यता" },
        { en: "Maurya Empire", hi: "मौर्य राजवंश" },
        { en: "Mughal Empire", hi: null }, // hi intro: unsourced, garbled claims
        { en: "Indian independence movement", hi: "भारतीय स्वतन्त्रता आन्दोलन" },
      ],
    },
    {
      id: "geography",
      en: "Geography",
      hi: "भूगोल",
      topics: [
        { en: "Geography of India", hi: "भारत का भूगोल" },
        { en: "Climate of India", hi: "भारत की जलवायु" },
        { en: "List of major rivers of India", hi: "भारत की नदी प्रणालियाँ" },
      ],
    },
    {
      id: "polity",
      en: "Constitution & Polity",
      hi: "संविधान एवं राजव्यवस्था",
      topics: [
        { en: "Constitution of India", hi: "भारत का संविधान" },
        { en: "Fundamental Rights, Directive Principles, and Fundamental Duties of India", hi: "भारत के मूल अधिकार, निदेशक तत्त्व और मूल कर्तव्य" },
        { en: "Parliament of India", hi: "भारतीय संसद" },
      ],
    },
    {
      id: "economy",
      en: "Economy",
      hi: "अर्थव्यवस्था",
      topics: [
        { en: "Economy of India", hi: "भारतीय अर्थव्यवस्था" },
        { en: "Five-Year Plans of India", hi: null }, // hi intro: garbled opening
      ],
    },
    {
      id: "science",
      en: "Science & Technology",
      hi: "विज्ञान एवं प्रौद्योगिकी",
      topics: [
        { en: "Science and technology in India", hi: "भारत में विज्ञान और प्रौद्योगिकी" },
        { en: "ISRO", hi: "भारतीय अंतरिक्ष अनुसंधान संगठन" },
      ],
    },
    {
      id: "environment",
      en: "Environment",
      hi: "पर्यावरण",
      topics: [
        { en: "Environment of India", hi: null }, // no Hindi article
        { en: "Wildlife of India", hi: null }, // hi article covers a different, older topic
      ],
    },
    {
      id: "culture",
      en: "Art & Culture",
      hi: "कला एवं संस्कृति",
      topics: [{ en: "Culture of India", hi: null }], // hi intro: opinion piece
    },
    {
      id: "institutions",
      en: "National Institutions",
      hi: "राष्ट्रीय संस्थाएँ",
      topics: [
        { en: "Supreme Court of India", hi: "भारत का उच्चतम न्यायालय" },
        { en: "Election Commission of India", hi: "भारत निर्वाचन आयोग" },
        { en: "Reserve Bank of India", hi: "भारतीय रिज़र्व बैंक" },
        { en: "NITI Aayog", hi: "नीति आयोग" },
      ],
    },
  ],
  bihar: [
    {
      id: "history",
      en: "Bihar History",
      hi: "बिहार का इतिहास",
      topics: [
        { en: "History of Bihar", hi: null }, // hi intro: opinion, not encyclopaedic
        { en: "Magadha", hi: "मगध महाजनपद" },
        { en: "Pataliputra", hi: "पाटलिपुत्र" },
        { en: "Vaishali (ancient city)", hi: "वैशाली" },
        { en: "Champaran Satyagraha", hi: "चम्पारण सत्याग्रह" },
      ],
    },
    {
      id: "geography",
      en: "Geography, Rivers & Places",
      hi: "भूगोल, नदियाँ एवं प्रमुख स्थल",
      topics: [
        { en: "Geography of Bihar", hi: "बिहार का भूगोल" },
        { en: "Kosi River", hi: "कोसी नदी" },
        { en: "Gandaki River", hi: "गण्डकी नदी" },
        { en: "Sone River", hi: "सोन नदी" },
        { en: "Valmiki National Park", hi: "वाल्मीकि राष्ट्रीय उद्यान" },
        { en: "Patna", hi: "पटना" },
      ],
    },
    {
      id: "culture",
      en: "Culture, Festivals & Heritage",
      hi: "संस्कृति, पर्व एवं धरोहर",
      topics: [
        { en: "Bihari culture", hi: null }, // hi intro: unsourced generalisations
        { en: "Chhath", hi: "छठ पूजा" },
        { en: "Madhubani art", hi: "मधुबनी चित्रकला" },
        { en: "Sonepur Cattle Fair", hi: "सोनपुर मेला" },
        { en: "Nalanda mahavihara", hi: "नालन्दा महाविहार" },
        { en: "Vikramashila", hi: "विक्रमशिला" },
        { en: "Mahabodhi Temple", hi: "महाबोधि विहार" },
        { en: "Rajgir", hi: "राजगीर" },
      ],
    },
    {
      id: "languages",
      en: "Languages",
      hi: "भाषाएँ",
      topics: [
        { en: "Bhojpuri language", hi: "भोजपुरी भाषा" },
        { en: "Maithili language", hi: "मैथिली भाषा" },
        { en: "Magahi language", hi: "मगही भाषा" },
      ],
    },
    {
      id: "economy",
      en: "Economy & Agriculture",
      hi: "अर्थव्यवस्था एवं कृषि",
      topics: [
        { en: "Economy of Bihar", hi: "बिहार की अर्थव्यवस्था" },
        { en: "Agriculture of Bihar", hi: null }, // no Hindi article
      ],
    },
    {
      id: "polity",
      en: "Polity & Administration",
      hi: "राजव्यवस्था एवं प्रशासन",
      topics: [
        { en: "Government of Bihar", hi: "बिहार सरकार" },
        { en: "Bihar Legislative Assembly", hi: "बिहार विधान सभा" },
        { en: "Bihar Legislative Council", hi: "बिहार विधान परिषद" },
        { en: "List of districts of Bihar", hi: "बिहार के जिले" },
        { en: "Bihar Day", hi: "बिहार दिवस" },
      ],
    },
    {
      id: "personalities",
      en: "Personalities",
      hi: "प्रमुख व्यक्तित्व",
      topics: [
        { en: "Rajendra Prasad", hi: "राजेन्द्र प्रसाद" },
        { en: "Jayaprakash Narayan", hi: "जयप्रकाश नारायण" },
        { en: "Kunwar Singh", hi: "कुँवर सिंह" },
        { en: "Karpoori Thakur", hi: null }, // hi intro: wrong birth year
        { en: "Ramdhari Singh Dinkar", hi: "रामधारी सिंह 'दिनकर'" },
        { en: "Bismillah Khan", hi: "बिस्मिल्ला ख़ाँ" },
        { en: "Aryabhata", hi: null }, // hi intro: presents a disputed birthplace claim as settled
        { en: "Sher Shah Suri", hi: "शेर शाह सूरी" },
      ],
    },
  ],
};
