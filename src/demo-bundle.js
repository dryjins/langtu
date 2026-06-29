export const DEMO_BUNDLE = {
  version: 1,
  title: 'Artificial GosRU demo bundle',
  verses: [
    {
      id: 'demo.1.1',
      reference: 'Demo 1:1',
      russianText: 'Учебный текст помогает читать по-русски.',
      englishText: 'A study text helps with reading in Russian.',
      notes: 'Artificial sample text. It is not Bible text.'
    },
    {
      id: 'demo.1.2',
      reference: 'Demo 1:2',
      russianText: 'Свет показывает путь к смыслу.',
      englishText: 'Light shows a path toward meaning.',
      notes: 'Artificial sample text for private bundle testing.'
    },
    {
      id: 'demo.1.3',
      reference: 'Demo 1:3',
      russianText: 'Ученик повторяет слово и выражение.',
      englishText: 'The learner repeats a word and an expression.',
      notes: 'Artificial sample text for MVP behavior.'
    },
    {
      id: 'demo.1.4',
      reference: 'Demo 1:4',
      russianText: 'Студент обсуждает сложные фразы, чтобы развить навык.',
      englishText: 'The student discusses complex phrases to develop skill.',
      notes: 'Artificial sample text for higher-level vocabulary.'
    },
    {
      id: 'demo.1.5',
      reference: 'Demo 1:5',
      russianText: 'Переводчик объясняет оттенки смысла в тексте.',
      englishText: 'The translator explains nuance in the text.',
      notes: 'Artificial sample text for upper-level expression.'
    },
    {
      id: 'demo.2.1',
      reference: 'Demo 2:1',
      russianText: 'Книга помогает развивать разговорный навык.',
      englishText: 'A book helps develop conversational skill.',
      notes: 'Artificial sample text to support A1 vocabulary.'
    },
    {
      id: 'demo.2.2',
      reference: 'Demo 2:2',
      russianText: 'Чтение развивает понятие и аргументированное мышление.',
      englishText: 'Reading develops the concept and argument-based thinking.',
      notes: 'Artificial sample text to support A2 and B1 vocabulary.'
    },
    {
      id: 'demo.2.3',
      reference: 'Demo 2:3',
      russianText: 'Исследователь изучает оттенки дискуссии и структуру тезисов.',
      englishText: 'A researcher studies discussion nuance and thesis structure.',
      notes: 'Artificial sample text to support B2 vocabulary.'
    },
    {
      id: 'demo.2.4',
      reference: 'Demo 2:4',
      russianText: 'Аналитик формулирует позицию через точные примеры и выводы.',
      englishText: 'An analyst states a position through exact examples and conclusions.',
      notes: 'Artificial sample text to support C1 vocabulary.'
    },
    {
      id: 'demo.2.5',
      reference: 'Demo 2:5',
      russianText: 'Научный дискурс связывает аргументы в сложную синтаксическую сеть.',
      englishText: 'Scientific discourse links arguments in a complex syntactic network.',
      notes: 'Artificial sample text to support C2 vocabulary.'
    }
  ],
  vocabulary: [
    {
      id: 'v.text',
      level: 'A0',
      lemma: 'текст',
      forms: ['текст'],
      meaning: 'text',
      linkedVerseIds: ['demo.1.1']
    },
    {
      id: 'v.read',
      level: 'A0',
      lemma: 'читать',
      forms: ['читать'],
      meaning: 'to read',
      linkedVerseIds: ['demo.1.1']
    },
    {
      id: 'v.light',
      level: 'A1',
      lemma: 'свет',
      forms: ['свет'],
      meaning: 'light',
      linkedVerseIds: ['demo.1.2']
    },
    {
      id: 'v.meaning',
      level: 'A1',
      lemma: 'смысл',
      forms: ['смыслу'],
      meaning: 'meaning',
      linkedVerseIds: ['demo.1.2']
    },
    {
      id: 'v.book',
      level: 'A1',
      lemma: 'книга',
      forms: ['книга', 'книге', 'книгу', 'книгой'],
      meaning: 'book',
      linkedVerseIds: ['demo.2.1']
    },
    {
      id: 'v.speech',
      level: 'A1',
      lemma: 'разговор',
      forms: ['разговор', 'разговора', 'разговоре'],
      meaning: 'conversation',
      linkedVerseIds: ['demo.2.1']
    },
    {
      id: 'v.expression',
      level: 'A2',
      lemma: 'выражение',
      forms: ['выражение'],
      meaning: 'expression',
      linkedVerseIds: ['demo.1.3']
    },
    {
      id: 'v.sent',
      level: 'A2',
      lemma: 'предложение',
      forms: ['предложение', 'предложения', 'предложению'],
      meaning: 'sentence',
      linkedVerseIds: ['demo.2.2']
    },
    {
      id: 'v.repeat',
      level: 'A2',
      lemma: 'повторять',
      forms: ['повторять', 'повторяет', 'повторение'],
      meaning: 'to repeat',
      linkedVerseIds: ['demo.1.3']
    },
    {
      id: 'v.b1-understand',
      level: 'B1',
      lemma: 'понимать',
      forms: ['понимать'],
      meaning: 'to understand',
      linkedVerseIds: ['demo.1.4']
    },
    {
      id: 'v.b1-topic',
      level: 'B1',
      lemma: 'тема',
      forms: ['тема', 'темы', 'тему', 'теме'],
      meaning: 'topic',
      linkedVerseIds: ['demo.2.2']
    },
    {
      id: 'v.b1-thesis',
      level: 'B1',
      lemma: 'тезис',
      forms: ['тезис', 'тезиса'],
      meaning: 'thesis',
      linkedVerseIds: ['demo.2.2']
    },
    {
      id: 'v.b2-discuss',
      level: 'B2',
      lemma: 'обсуждать',
      forms: ['обсуждать'],
      meaning: 'to discuss',
      linkedVerseIds: ['demo.1.4']
    },
    {
      id: 'v.b2-research',
      level: 'B2',
      lemma: 'исследование',
      forms: ['исследование', 'исследования'],
      meaning: 'research',
      linkedVerseIds: ['demo.2.3']
    },
    {
      id: 'v.b2-evidence',
      level: 'B2',
      lemma: 'доказательство',
      forms: ['доказательство', 'доказательства'],
      meaning: 'evidence',
      linkedVerseIds: ['demo.2.3']
    },
    {
      id: 'v.c1-interpret',
      level: 'C1',
      lemma: 'интерпретировать',
      forms: ['интерпретировать'],
      meaning: 'to interpret',
      linkedVerseIds: ['demo.1.5']
    },
    {
      id: 'v.c1-position',
      level: 'C1',
      lemma: 'позиция',
      forms: ['позиция', 'позиции', 'позицией'],
      meaning: 'position',
      linkedVerseIds: ['demo.2.4']
    },
    {
      id: 'v.c1-rigour',
      level: 'C1',
      lemma: 'доказательность',
      forms: ['доказательность'],
      meaning: 'rigour',
      linkedVerseIds: ['demo.2.4']
    },
    {
      id: 'v.c2-syntax',
      level: 'C2',
      lemma: 'синтаксис',
      forms: ['синтаксиса'],
      meaning: 'syntax',
      linkedVerseIds: ['demo.1.5']
    },
    {
      id: 'v.c2-discourse',
      level: 'C2',
      lemma: 'дискурс',
      forms: ['дискурс', 'дискурса'],
      meaning: 'discourse',
      linkedVerseIds: ['demo.2.5']
    },
    {
      id: 'v.c2-rhetoric',
      level: 'C2',
      lemma: 'риторика',
      forms: ['риторика', 'риторику', 'риторики'],
      meaning: 'rhetoric',
      linkedVerseIds: ['demo.2.5']
    }
  ],
  grammar: [
    {
      id: 'g.basic-verb',
      level: 'A0',
      name: 'Infinitive verb recognition',
      explanation: 'Recognize an infinitive such as читать as a dictionary verb form.',
      linkedVerseIds: ['demo.1.1']
    },
    {
      id: 'g.dative-direction',
      level: 'A1',
      name: 'Dative direction phrase',
      explanation: 'Recognize к plus dative as movement or orientation toward something.',
      linkedVerseIds: ['demo.1.2']
    },
    {
      id: 'g.b1-clause-order',
      level: 'B1',
      name: 'Clause word order',
      explanation: 'Recognize main clauses with adverbial modifiers before the verb.',
      linkedVerseIds: ['demo.1.4']
    },
    {
      id: 'g.b2-subordinate',
      level: 'B2',
      name: 'Subordinate clause markers',
      explanation: 'Identify conjunctions that introduce subordinate clauses.',
      linkedVerseIds: ['demo.1.4']
    },
    {
      id: 'g.c1-ideophone',
      level: 'C1',
      name: 'Complex nominalization',
      explanation: 'Spot derivational shifts from verbs to nouns in running text.',
      linkedVerseIds: ['demo.1.5']
    },
    {
      id: 'g.c2-argument',
      level: 'C2',
      name: 'Rhetorical structure',
      explanation: 'Track premise, claim, and conclusion in a paragraph.',
      linkedVerseIds: ['demo.1.5']
    }
  ],
  expressions: [
    {
      id: 'e.read-russian',
      level: 'A0',
      phrase: 'читать по-русски',
      meaning: 'to read in Russian',
      linkedVerseIds: ['demo.1.1']
    },
    {
      id: 'e.path-to-meaning',
      level: 'A1',
      phrase: 'путь к смыслу',
      meaning: 'a path toward meaning',
      linkedVerseIds: ['demo.1.2']
    },
    {
      id: 'e.practice-dialogue',
      level: 'A2',
      phrase: 'практиковать разговор',
      meaning: 'to practice conversation',
      linkedVerseIds: ['demo.1.3']
    },
    {
      id: 'e.practice-dialogue-b1',
      level: 'B1',
      phrase: 'свободно обсуждать идеи',
      meaning: 'to discuss ideas fluently',
      linkedVerseIds: ['demo.1.4']
    },
    {
      id: 'e.subtle-detail',
      level: 'B2',
      phrase: 'считать с оттенками смысла',
      meaning: 'to account for nuances',
      linkedVerseIds: ['demo.1.4']
    },
    {
      id: 'e.style-register',
      level: 'C1',
      phrase: 'учитывать регистр высказывания',
      meaning: 'to account for register',
      linkedVerseIds: ['demo.1.5']
    },
    {
      id: 'e.dense-reading',
      level: 'C2',
      phrase: 'понимать нюансы аргументации',
      meaning: 'to grasp argument nuances',
      linkedVerseIds: ['demo.1.5']
    }
  ]
};
