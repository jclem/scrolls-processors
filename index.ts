import { assert } from "@jclem/assert";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import OpenAI from "openai";
import type { JSONSchema } from "openai/lib/jsonschema.mjs";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

const Item = z.object({
  id: z.string(),
  type: z.string(),
  data: z.string(),
  metadata: z.record(z.unknown()),
  inserted_at: z.string(),
  updated_at: z.string(),
});

type Item = z.infer<typeof Item>;

const path = assert(Bun.argv.at(2));
const file = Bun.file(path);
const item = Item.parse(JSON.parse(await file.text()));
const openai = new OpenAI({ apiKey: assert(Bun.env.OPENAI_API_KEY) });

const SummarizeArticleInputs = z.object({
  keyPoints: z.array(
    z.object({
      point: z.string(),
      summary: z.string(),
    }),
  ),
});

type SummarizeArticleInputs = z.infer<typeof SummarizeArticleInputs>;

if (!item.data.startsWith("https://")) {
  process.exit(0);
}

if (item.type !== "draft") {
  process.exit(0);
}

const url = item.data;
const resp = await fetch(url);
const contentType = resp.headers.get("content-type") ?? "";

if (contentType.startsWith("image/")) {
  await toImage(item);
} else {
  await toBookmark(item);
}

Bun.write(file, JSON.stringify(item));

async function toImage(item: Item) {
  item.type = "image";

  const output = await openai.chat.completions.create({
    model: "gpt-4-vision-preview",
    stream: false,
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Describe this image in one sentence.",
          },
          {
            type: "image_url",
            image_url: { url: url, detail: "high" },
          },
        ],
      },
    ],
  });

  const description = output.choices.at(0)?.message.content ?? ""

  item.metadata.description = description;
}

async function toBookmark(item: Item) {
  item.type = "bookmark";

  const html = await getPageHTML(url);
  const dom = new JSDOM(html);
  const article = new Readability(dom.window.document).parse();

  if (!article) {
    throw new Error(`Could not parse article: ${url}`);
  }

  const title = article.title;
  item.metadata.title = title;

  const summarizeArticle = createSummarizeArticle(item);

  const runner = openai.beta.chat.completions.runTools({
    model: "gpt-4-1106-preview",
    tool_choice: { type: "function", function: { name: "summarizeArticle" } },
    tools: [
      {
        type: "function",
        function: {
          function: summarizeArticle,
          parse: (args) => SummarizeArticleInputs.parse(JSON.parse(args)),
          description:
            "Provide a summary of an article by highlighting key points and summaries of those key points.",
          parameters: zodToJsonSchema(SummarizeArticleInputs) as JSONSchema,
        },
      },
    ],
    messages: [
      {
        role: "system",
        content: `Summarize an article by highlighting no more than 5
      primary points, and one summary or conclusion for each point. A point
name should be general and ideally no more than three words. Each
summary should be specific, and drawn from and supported by content of
the article. The summary should be no more than 10 words. In
summaries, you can omit things like mention of "the writer", "the
article", "the page", etc.—it will be clear to the user that the
summary refers to the article or page, and the thoughts of its author.

Here are some examples:

For a blog post about how someone takes notes:

\`\`\`json
{
  "keyPoints": [
    {
      "point": "Daily Log",
      "summary": "Uses hashtags to organize daily logs"
    },
    {
      "point": "Contexts and Pages",
      "summary": "Uses 'contexts' to reference things and people"
    },
    {
      "point": "Building a Habit",
      "summary": "Found Bear easiest for daily logging and note-taking"
    }
  ]
}
\`\`\`

For a news article about a person searching for an apartment:

\`\`\`json
{
  "keyPoints": [
    {
      "point": "Options",
      "summary": "Chelsea 1-bed, Midtown West 1-bed, Clinton 2-bed"
    },
    {
      "point": "Budget",
      "summary": "$900,000"
    },
    {
      "point": "Decision",
      "summary": "Chelsea 1-bedroom co-op"
    }
  ]
}
\`\`\`

For a product review:

\`\`\`json
{
  "keyPoints": [
    {
      "point": "Good",
      "summary": "All-in-one solution for PS5 Remote Play, good screen and hardware, lengthy battery life, full DualSense integration"
    },
    {
      "point": "Bad",
      "summary": "Other methods are cheaper and multi-functional, proprietary and pricey wireless audio solutions, reliance on Wi-Fi performance, lack of auto-brightness"
    },
    {
      "point": "Price",
      "summary": "$199.99"
    }
  ]
}
\`\`\`\n\n${article.content}`,
      },
    ],
  });

  await runner.done();
}

async function getPageHTML(url: string) {
  const resp = await fetch(url, { headers: { accept: "text/html" } });
  return resp.text();
}

function createSummarizeArticle(item: Item) {
  return function summarizeArticle(input: SummarizeArticleInputs) {
    item.metadata.summary = input.keyPoints
      .map((kp) => `- **${kp.point}**: ${kp.summary}`)
      .join("\n");
  };
}
