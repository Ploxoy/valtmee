const feeds = [
  { name: "NOS", url: "https://feeds.nos.nl/nosnieuwsalgemeen" },
  { name: "NU.nl", url: "https://www.nu.nl/rss/Algemeen" },
  { name: "RTL Nieuws", url: "https://www.rtlnieuws.nl/rss.xml" },
];

const stopwords = new Set([
  "aan",
  "af",
  "afgelopen",
  "al",
  "als",
  "andere",
  "amerikaanse",
  "agent",
  "bij",
  "binnen",
  "blijft",
  "daar",
  "dan",
  "dat",
  "de",
  "deze",
  "die",
  "dit",
  "door",
  "een",
  "eerst",
  "en",
  "er",
  "gaat",
  "gaan",
  "geen",
  "gemeente",
  "gezondheidstoestand",
  "gisteren",
  "heeft",
  "hebben",
  "het",
  "hij",
  "hoe",
  "hun",
  "in",
  "is",
  "jaar",
  "kan",
  "komen",
  "kunnen",
  "maar",
  "meer",
  "met",
  "moet",
  "mohammadi",
  "mogelijk",
  "meerdere",
  "na",
  "naar",
  "niet",
  "nieuwe",
  "nederlands",
  "nederlanders",
  "nog",
  "nu",
  "of",
  "om",
  "ook",
  "op",
  "operahuis",
  "onder",
  "omgekomen",
  "over",
  "rond",
  "te",
  "tegen",
  "tijdens",
  "toen",
  "tot",
  "tussen",
  "uit",
  "van",
  "veel",
  "voor",
  "volgens",
  "waar",
  "was",
  "wat",
  "week",
  "wel",
  "werd",
  "worden",
  "wordt",
  "zou",
  "zich",
  "zijn",
  "zondag",
  "zorgelijk",
]);

const weakTopicWords = new Set([
  "algemeen",
  "bericht",
  "liveblog",
  "mensen",
  "minuten",
  "nederland",
  "nieuws",
  "vandaag",
  "video",
  "weer",
  "gewond",
  "politie",
  "zeker",
  "correspondents",
]);

const weakPhraseStarts = new Set([
  "drie",
  "gezondheidstoestand",
  "nieuwe",
  "nederlands",
  "amerikaanse",
]);

const contextWords = new Set([
  "agent",
  "asiel",
  "brand",
  "cruiseschip",
  "debat",
  "doden",
  "hantavirus",
  "miami",
  "noodopvang",
  "ongeluk",
  "operahuis",
  "protest",
  "verkiezingen",
  "verkeersongeval",
  "vuurwerk",
]);

const ophefBoostWords = new Set([
  "agent",
  "asiel",
  "debat",
  "noodopvang",
  "politie",
  "protest",
  "staking",
  "verkiezingen",
  "vuurwerk",
  "zorg",
]);

const forcedLabels = [
  {
    includes: ["mohammadi"],
    label: "Mohammadi",
  },
  {
    includes: ["asiel", "den haag"],
    label: "asieldebat Den Haag",
  },
  {
    includes: ["ijsselstein", "noodopvang"],
    label: "noodopvang IJsselstein",
  },
  {
    includes: ["ijsselstein", "vuurwerk"],
    label: "vuurwerk IJsselstein",
  },
];

function decodeEntities(value) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripHtml(value) {
  return value.replace(/<[^>]*>/g, " ");
}

function extractTag(item, tag) {
  const match = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? stripHtml(decodeEntities(match[1])).trim() : "";
}

function extractItems(xml) {
  return [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((match) => match[0]);
}

function normalizeTopic(value) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function displayTopic(value) {
  return value.replace(/\s+/g, " ").trim();
}

function compactLabel(value) {
  return displayTopic(value).split(/\s+/).slice(0, 3).join(" ");
}

function tokenize(text) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .match(/[a-z][a-z-]{2,}/g) ?? [];
}

function isUsefulWord(word) {
  return (
    word.length >= 5 &&
    !stopwords.has(word) &&
    !weakTopicWords.has(word) &&
    !/^\d+$/.test(word)
  );
}

function extractCapitalizedPhrases(title) {
  const matches = title.match(
    /\b(?:[A-ZÀ-ÖØ-Þ][\wÀ-ÖØ-öø-ÿ.-]{2,}|[A-Z]{2,})(?:\s+(?:[A-ZÀ-ÖØ-Þ][\wÀ-ÖØ-öø-ÿ.-]{2,}|[A-Z]{2,})){0,3}/g
  );

  return (matches ?? [])
    .map(displayTopic)
    .filter((phrase) => {
      const normalized = normalizeTopic(phrase);
      const firstWord = normalized.split(" ")[0];

      if (weakPhraseStarts.has(firstWord)) {
        return false;
      }

      if (!phrase.includes(" ")) {
        return title.indexOf(phrase) > 0 && isUsefulWord(normalized);
      }

      return true;
    });
}

function extractAcronyms(title) {
  return [...title.matchAll(/\b[A-Z]{2,6}\b/g)].map((match) => match[0]);
}

function titleParts(title) {
  return title
    .split(/[,:'"()|–—-]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function strongestContextWords(title) {
  const words = tokenize(title).filter(isUsefulWord);
  const priority = words.filter((word) => contextWords.has(word));
  const rest = words.filter((word) => !contextWords.has(word));

  return [...priority, ...rest].slice(0, 3);
}

function chooseEntity(title) {
  const phrases = extractCapitalizedPhrases(title)
    .filter((phrase) => !weakPhraseStarts.has(normalizeTopic(phrase).split(" ")[0]))
    .sort((a, b) => b.length - a.length);

  const acronyms = extractAcronyms(title);

  return phrases[0] ?? acronyms[0] ?? "";
}

function eventLabelFromArticle(article) {
  const title = article.title;
  const normalizedTitle = normalizeTopic(title);
  const parts = titleParts(title);
  const entity = chooseEntity(title);
  const contexts = strongestContextWords(title);

  if (!title || contexts.length === 0) {
    return null;
  }

  for (const forced of forcedLabels) {
    if (forced.includes.every((part) => normalizedTitle.includes(part))) {
      return forced.label;
    }
  }

  if (contexts.includes("hantavirus") && contexts.includes("cruiseschip")) {
    return "hantavirus cruiseschip";
  }

  if (contexts.includes("miami")) {
    return "GP Miami";
  }

  if (contexts.includes("brand") && entity) {
    return compactLabel(`brand ${entity}`);
  }

  if (contexts.includes("noodopvang") && entity) {
    return compactLabel(`noodopvang ${entity}`);
  }

  if (contexts.includes("protest") && entity) {
    return compactLabel(`protest ${entity}`);
  }

  if (contexts.includes("verkeersongeval") && entity) {
    return compactLabel(`verkeersongeval ${entity}`);
  }

  if (entity && contexts.length > 0) {
    return compactLabel(`${contexts[0]} ${entity}`);
  }

  const cleanPart = parts
    .map((part) => tokenize(part).filter(isUsefulWord))
    .find((words) => words.length >= 2);

  if (cleanPart) {
    return cleanPart.slice(0, 3).join(" ");
  }

  return contexts.slice(0, 2).join(" ");
}

function addCandidate(candidates, rawTopic, article, weight, kind) {
  const label = compactLabel(rawTopic);
  const topic = normalizeTopic(label);

  if (!topic || weakTopicWords.has(topic)) {
    return;
  }

  const existing = candidates.get(topic) ?? {
    topic,
    label,
    score: 0,
    hits: 0,
    articleIds: new Set(),
    sources: new Set(),
    kinds: new Set(),
    examples: [],
  };

  if (!existing.articleIds.has(article.id)) {
    existing.hits += 1;
    existing.articleIds.add(article.id);
  }

  existing.score += weight;
  existing.sources.add(article.source);
  existing.kinds.add(kind);

  if (existing.examples.length < 2) {
    existing.examples.push(article.title);
  }

  candidates.set(topic, existing);
}

function articleFromItem(item, source, index) {
  return {
    id: `${source}:${index}`,
    source,
    title: extractTag(item, "title"),
    description: extractTag(item, "description"),
  };
}

function scoreTopics(articles) {
  const candidates = new Map();

  for (const article of articles) {
    const label = eventLabelFromArticle(article);

    if (label) {
      addCandidate(candidates, label, article, label.includes(" ") ? 9 : 5, "event");
    }
  }

  return [...candidates.values()]
    .map((candidate) => ({
      ...candidate,
      score:
        candidate.score +
        Math.max(0, candidate.sources.size - 1) * 4 +
        Math.min(candidate.hits, 4) +
        topicBoost(candidate.topic),
      sources: [...candidate.sources].sort(),
      kinds: [...candidate.kinds].sort(),
    }))
    .filter((candidate) => candidate.score >= 9)
    .sort((a, b) => b.score - a.score || b.sources.length - a.sources.length)
    .slice(0, 20);
}

function topicBoost(topic) {
  const words = topic.split(/\s+/);
  const ophefBoost = words.some((word) => ophefBoostWords.has(word)) ? 8 : 0;
  const ijsselsteinBoost = topic.includes("ijsselstein") ? 6 : 0;

  return ophefBoost + ijsselsteinBoost;
}

function finalTopics(topics, limit = 5) {
  const strong = mergeRelatedTopics(topics).filter((topic) => {
    const wordCount = topic.topic.split(/\s+/).length;

    if (wordCount > 3) return false;
    if (topic.sources.length > 1) return true;
    if (topic.score >= 17) return true;
    return topic.topic.split(/\s+/).some((word) => ophefBoostWords.has(word));
  });

  return strong.slice(0, limit);
}

function mergeRelatedTopics(topics) {
  const merged = [];
  let ijsselsteinTopic = null;

  for (const topic of topics) {
    if (topic.topic.includes("ijsselstein")) {
      if (!ijsselsteinTopic) {
        ijsselsteinTopic = {
          ...topic,
          topic: "ijsselstein noodopvang",
          label: "IJsselstein noodopvang",
          score: topic.score,
          hits: topic.hits,
          sources: new Set(topic.sources),
          examples: [...topic.examples],
        };
      } else {
        ijsselsteinTopic.score += topic.score;
        ijsselsteinTopic.hits += topic.hits;
        topic.sources.forEach((source) => ijsselsteinTopic.sources.add(source));
        ijsselsteinTopic.examples.push(...topic.examples);
      }

      continue;
    }

    merged.push(topic);
  }

  if (ijsselsteinTopic) {
    merged.push({
      ...ijsselsteinTopic,
      sources: [...ijsselsteinTopic.sources].sort(),
      examples: [...new Set(ijsselsteinTopic.examples)].slice(0, 2),
    });
  }

  return merged.sort((a, b) => b.score - a.score || b.sources.length - a.sources.length);
}

async function fetchFeed(feed) {
  const res = await fetch(feed.url, {
    headers: {
      "user-agent": "valtmee-ophef-poc/0.2",
    },
  });

  if (!res.ok) {
    throw new Error(`${feed.name} failed: ${res.status}`);
  }

  const xml = await res.text();
  const items = extractItems(xml);

  return { ...feed, items };
}

async function main() {
  const results = await Promise.allSettled(feeds.map(fetchFeed));
  const articles = [];

  for (const result of results) {
    if (result.status === "rejected") {
      console.error(result.reason);
      continue;
    }

    console.log(`${result.value.name}: ${result.value.items.length} items`);
    articles.push(
      ...result.value.items.map((item, index) =>
        articleFromItem(item, result.value.name, index)
      )
    );
  }

  const topTopics = scoreTopics(articles);
  const displayTopics = finalTopics(topTopics);

  console.log("");
  console.log("ophef vandaag:");
  console.log(displayTopics.map((topic) => topic.label).join(" · "));
  console.log("");
  console.table(
    topTopics.map((topic) => ({
      topic: topic.label,
      score: topic.score,
      hits: topic.hits,
      sources: topic.sources.join(", "),
      kinds: topic.kinds.join(", "),
    }))
  );

  console.log("");
  console.log("examples:");
  for (const topic of displayTopics) {
    console.log(`- ${topic.label}: ${topic.examples[0]}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
