---
name: bidi-text
description: "How to write clear, readable text that mixes Hebrew and English in the same sentence. Use this skill whenever responding in Hebrew and the response includes English terms — technical terms, product names, CLI commands, file paths, URLs, or any LTR content embedded in RTL Hebrew text. Also use when writing Hebrew commit messages, comments, or documentation that reference English identifiers."
---

# Writing Mixed Hebrew-English Text (BiDi)

When Hebrew (RTL) and English (LTR) appear in the same sentence, the BiDi rendering algorithm often moves English terms to the wrong visual position — they "jump" to the start or end of the line instead of staying where you placed them. The **one rule that fixes this** is wrapping every mixed-language line with Unicode directional isolates.

## The Golden Rule: RLI/PDI Wrapping

Every line of text that contains both Hebrew and English MUST be wrapped with:
- `U+2067` (Right-to-Left Isolate, RLI) at the **start** of the line
- `U+2069` (Pop Directional Isolate, PDI) at the **end** of the line

These are invisible Unicode characters. They force the entire line to render as RTL and keep English terms anchored in their logical position.

**How to apply:** When writing a response that mixes Hebrew and English, place RLI before the first character and PDI after the last character of each paragraph or line. This applies to:
- Prose paragraphs
- Bullet list items
- Table cells with mixed content
- Headings

**Example** (with markers shown for clarity):
```
⁧השרת רץ על Render בהצלחה⁩
^RLI                      ^PDI
```

Without wrapping, "Render" may visually jump to the left edge of the line. With wrapping, it stays between "על" and "בהצלחה" where it belongs.

## Secondary Guidelines

These help with clarity and readability on top of the RLI/PDI wrapping:

### Keep English names intact
Don't transliterate well-known English terms:
```
⁧השרת רץ על Render⁩ ✓
⁧השרת רץ על רנדר⁩ ✗
```

### Backticks for code, paths, and commands
Wrap CLI commands, file paths, and URLs in backticks — this visually isolates the LTR block:
```
⁧הרץ `npm install` בתיקיית הפרויקט⁩ ✓
⁧הקובץ נמצא ב-`server/src/routes/dashboard.ts`⁩ ✓
```

### One English island per clause
If a sentence needs multiple English terms close together, combine them into one chunk:
```
⁧התקן את Node.js/npm/Vite בסביבה המקומית⁩ ✓
⁧התקן את Node.js ואת npm ואז Vite⁩ ✗  (three direction switches)
```

### Hyphenated Hebrew prefixes
Hebrew prepositions (ב, ל, מ, ה) attach to English words with a hyphen:
```
⁧דיפלוי ל-Vercel עבר בהצלחה⁩ ✓
⁧נבנה מ-shared⁩ ✓
⁧ב-GitHub Pages⁩ ✓
```

### Parenthetical English
When an English phrase clarifies a Hebrew term, parentheses create a natural boundary:
```
⁧בדיקת בריאות (health check) עברה בהצלחה⁩ ✓
```

### Numbers and amounts
Numbers are neutral in BiDi. Keep the currency symbol or unit next to the number:
```
⁧נותרו 407 עסקאות⁩ ✓
⁧סה"כ 1,706 ₪⁩ ✓
```

### Punctuation
Hebrew punctuation stays at the logical end of the Hebrew clause:
```
⁧השרת עלה על Render, עכשיו ממשיכים ל-Vercel.⁩ ✓
```

### Lists mixing both languages
In tables where values are English, keep the label in Hebrew:
```
| שדה | ערך |
|-----|-----|
| Build Command | `npm run build` |
| Start Command | `node server/dist/index.js` |
```

## Anti-Patterns to Avoid

- **Don't alternate languages word-by-word.** "ה-server לא respond על ה-request" — pick one language for the sentence and embed only the necessary terms from the other.
- **Don't transliterate well-known English terms.** "גיטהאב" instead of GitHub, "ריאקט" instead of React — these are harder to read, not easier.
- **Don't put Hebrew punctuation inside backticks.** The period belongs to the Hebrew sentence, not the code: ⁧הרץ `npm install`.⁩ not ⁧הרץ `npm install.`⁩
- **Don't use English syntax in Hebrew sentences.** "זה לא going to work" — if you're writing in Hebrew, commit to Hebrew grammar.
- **Don't forget RLI/PDI wrapping.** Without it, even perfectly structured sentences can render with English terms in the wrong position.
