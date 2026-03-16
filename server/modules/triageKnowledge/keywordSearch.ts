import { keywordSearch as keywordSearchRepo } from "./repo";

const STOP_WORDS = new Set([
  "的",
  "了",
  "和",
  "是",
  "我",
  "有",
  "吗",
  "请",
  "help",
  "please",
  "with",
  "have",
  "pain",
]);

export function tokenizeQuery(text: string) {
  const chineseTerms = text.match(/[\u4e00-\u9fff]{2,6}/g) ?? [];
  const latinTerms = (text.toLowerCase().match(/[a-z]{3,}/g) ?? []).filter(
    term => !STOP_WORDS.has(term)
  );

  return Array.from(new Set([...chineseTerms, ...latinTerms])).slice(0, 8);
}

export async function keywordSearch(query: string) {
  const terms = tokenizeQuery(query);
  const hits = await keywordSearchRepo(terms);
  return {
    terms,
    hits,
  };
}
