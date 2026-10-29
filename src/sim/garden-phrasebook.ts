/** Event-time wording belongs to HF. These phrases never select or settle an action. */
export const GARDEN_WORDINGS = {
  'suggestion.resolved': [
    'I {verdict}.{reason}',
    'After considering your request, I {verdict}.{reason}',
    'For now, I {verdict}.{reason}',
    'I {verdict} after thinking about it.{reason}',
  ],
  'verdict.assented': [
    'agree with your advice',
    'accept your advice',
    'have decided to follow your advice',
    'think your advice is worth following',
  ],
  'verdict.complied': [
    'will do as you ask, though I disagree',
    'will follow your request reluctantly',
    'will go along with your request despite my doubts',
    'will do it, although I remain unsure',
  ],
  'verdict.deferred': [
    'will first attend to “{alternative}”',
    'will deal with “{alternative}” before considering this again',
    'have put “{alternative}” ahead of your request',
    'will consider this after dealing with “{alternative}”',
  ],
  'verdict.modified': [
    'would rather choose “{alternative}”',
    'have chosen “{alternative}” instead',
    'prefer the alternative “{alternative}”',
    'want to pursue “{alternative}” instead',
  ],
  'verdict.refused': [
    'refuse your request',
    'do not agree to your request',
    'have decided against following your advice',
    'will not follow your advice',
  ],
  'verdict.commanded': [
    'will follow the order',
    'will do what I was ordered to do',
    'am acting under an order',
    'will proceed under the order',
  ],
  'verdict.cannot': [
    'cannot carry out your request',
    'am unable to do what you ask',
    'cannot do this now',
    'am not able to follow this request',
  ],
  'reason.need:rest': [
    'I need to rest.',
    'I need a break before doing more.',
    'I need some time to recover.',
    'I need to stop and recover first.',
  ],
  'reason.distrust': [
    'I do not trust this advice.',
    'I have doubts about your advice.',
    'I am unsure whether to trust your request.',
    'I do not have enough trust in this advice.',
  ],
  'reason.norm': [
    'This conflicts with what I believe is right.',
    'My understanding of right and wrong matters here.',
    'I am considering what I believe is permitted.',
    'I am weighing this against my own principles.',
  ],
} as const;
