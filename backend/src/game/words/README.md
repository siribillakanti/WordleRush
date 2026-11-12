# WordleRush Word Lists & Validation

## Word Counts & Sources

1. **Secret Answers List (`answers.json`) — 10,826 Words**
   - **Sources:** FreeBSD/4.4BSD Unix System Dictionary (`/usr/share/dict/words`), ENABLE1 Lexicon, and Google Web Trillion Word Corpus.
   - **Licence:** Public Domain / BSD / CC0.
   - **Content:** Everyday English words, regular plurals (NOTES, BOOKS, BOXES, CARDS, BIRDS, TREES, SHIPS, etc.), irregular plurals (GEESE, TEETH), words ending in S or ES (GLASS, CLASS, GRASS, BRASS, CHESS, CROSS, DRESS, etc.), and ordinary English words that are also brand names (APPLE, HOLLY, etc.).
   - **Exclusions:** People's names (PETER, SARAH, DAVID, HARRY, ALICE, etc.), geographical locations (PARIS, CHINA, JAPAN, DELHI, TOKYO, SPAIN, ITALY, EGYPT, etc.), commercial brand names (PEPSI, XEROX, ROLEX, GUCCI, etc.), invented strings, and invalid spellings.

2. **Allowed Guesses List (`guesses.json`) — 14,151 Words**
   - **Sources:** ENABLE1 (Enhanced North American Benchmark Lexicon), FreeBSD System Dictionary, SSA given names, and international geographical names.
   - **Licence:** Public Domain / BSD.
   - **Content:** Comprehensive superset containing all answer words, plus personal names (PETER, SARAH, DAVID, HARRY, ALICE), geographical proper nouns (PARIS, TOKYO, DELHI, JAPAN, SPAIN), brand names, and less common but legitimate English dictionary words.
