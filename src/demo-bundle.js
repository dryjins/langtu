export const DEMO_BUNDLE = {
  version: 1,
  title: 'Artificial Langtu demo bundle',
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
      id: 'v.expression',
      level: 'A2',
      lemma: 'выражение',
      forms: ['выражение'],
      meaning: 'expression',
      linkedVerseIds: ['demo.1.3']
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
    }
  ]
};
