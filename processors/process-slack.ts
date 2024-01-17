import type { JSONSchema } from "openai/lib/jsonschema.mjs";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";
import { halt, type Item, type ProcessorInput } from "./processors";

const SummarizeSlackConversationInputs = z.object({
  url: z.string().describe("The URL of the Slack conversation"),

  title: z.string().describe("A name for the Slack conversation"),

  keyPoints: z
    .array(
      z
        .object({
          point: z.string().describe("A key point from the Slack conversation"),
          summary: z.string().describe("A summary of the key point"),
        })
        .describe("A key point from the Slack conversation and its summary"),
    )
    .describe("The key points from the Slack conversation"),

  links: z
    .array(
      z
        .object({
          url: z.string().describe("The link URL"),
          title: z.string().describe("The link title"),
        })
        .describe("A link relevant to the conversation"),
    )
    .describe(
      "The links relevant to the conversation (but not the Slack conversation itself)",
    ),
});

type SummarizeSlackConversationInputs = z.infer<
  typeof SummarizeSlackConversationInputs
>;

export async function summarizeSlackConversation(
  input: ProcessorInput,
): Promise<void | typeof halt> {
  if (!isSlackPaste(input.item.data)) {
    return;
  }

  const { item, openai } = input;

  item.type = "note";

  const runner = openai.beta.chat.completions.runTools({
    model: "gpt-4-1106-preview",
    tool_choice: {
      type: "function",
      function: { name: "summarizeSlackConversation" },
    },
    tools: [
      {
        type: "function",
        function: {
          function: getSummarizeSlackConversation(item),
          parse: (args) =>
            SummarizeSlackConversationInputs.parse(JSON.parse(args)),
          description: `
Summarize the Slack conversation the user has pasted by extracting the
conversation URL and then summarizing the top 3 key points of the conversation
(including who made those points where appropriate).

Also include relevant links using the provided inputs. This would be nearly
anything linked to in the conversation.`,
          parameters: zodToJsonSchema(
            SummarizeSlackConversationInputs,
          ) as JSONSchema,
        },
      },
    ],
    messages: [
      {
        role: "system",
        content: `
Summarize the Slack conversation the user has pasted. Capture the URL and key
points. You may use Markdown in your key points content.`.trim(),
      },
      { role: "user", content: input.item.data },
    ],
  });

  await runner.done();

  return halt;
}

function isSlackPaste(content: string): boolean {
  // 1. My name.
  // 2. A new line.
  // 3. Maybe a status icon.
  // 4. A time.
  // 5. Other junk—this is fuzzy to allow for Slack relative times.
  return (
    content.match(/^https:\/\/github\.slack\.com/) !== null &&
    content.match(/^Jonathan Clem\n(?::[^:]+:)?\s+\d/m) !== null
  );
}

function getSummarizeSlackConversation(item: Item) {
  return function summarizeSlackConversation(
    input: SummarizeSlackConversationInputs,
  ) {
    item.hide_data = true;

    item.interface.push({
      type: "markdown",
      content: {
        markdown: `# [${input.title}](${input.url})

<small>from Slack</small>

## Key Points

${input.keyPoints.map((kp) => `- **${kp.point}**: ${kp.summary}`).join("\n")}

${
  input.links.length > 0
    ? `## Relevant Links

${input.links.map((link) => `- [${link.title}](${link.url})`).join("\n")}`
    : ""
}`,
      },
    });
  };
}
