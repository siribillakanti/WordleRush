# WordleRush Word Lists & Validation

## Word Counts & Sources

1. **Secret Answers List (`answers.json`) — 10,875 Words**
   - **Sources:** FreeBSD/4.4BSD Unix System Dictionary (`/usr/share/dict/words`), ENABLE1 Lexicon, Google Web Trillion Word Corpus, and international geographical gazetteers.
   - **Licence:** Public Domain / BSD / CC0.
   - **Content:** Everyday English words, regular plurals (NOTES, BOOKS, BOXES, CARDS, BIRDS, TREES, SHIPS, etc.), irregular plurals (GEESE, TEETH), words ending in S or ES (GLASS, CLASS, GRASS, BRASS, CHESS, CROSS, DRESS, etc.), five-letter geographical names (PARIS, CHINA, JAPAN, DELHI, SPAIN, ITALY, EGYPT, etc.), and ordinary English words that are also brand names (APPLE, SHELL, etc.).
   - **Exclusions:** Personal names used solely as personal names (PETER, SARAH, DAVID, HARRY, ALICE, etc.), invented strings, and invalid spellings.

2. **Allowed Guesses List (`guesses.json`) — 14,133 Words**
   - **Sources:** ENABLE1 (Enhanced North American Benchmark Lexicon), FreeBSD System Dictionary, SSA given names, and international geographical names.
   - **Licence:** Public Domain / BSD.
   - **Content:** Comprehensive superset containing all answer words, plus personal names (PETER, SARAH, DAVID, HARRY, ALICE), geographical proper nouns, and less common but legitimate English dictionary words.
