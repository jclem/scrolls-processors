import type { ProcessorInput, halt } from "./processors";

export async function summarizeSlackConversation(
  input: ProcessorInput,
): Promise<void | typeof halt> {
  if (!isSlackPaste(input.item.data)) {
    return;
  }

  const { item, openai } = input;

  item.type = "note";

  const output = await openai.chat.completions.create({
    model: "gpt-4-vision-preview",
    stream: false,
    max_tokens: 1024,
    messages: [
      {
        role: "system",
        content: `
Summarize the Slack conversation the user has pasted. Make sure and capture the
names of the participants, and a brief (one or two sentences) overview of what
is being discussed.

You may use Markdown in your output.`.trim(),
      },
      { role: "user", content: input.item.data },
    ],
  });

  const markdown = output.choices.at(0)?.message.content?.trim() ?? "";

  if (markdown === "") {
    return;
  }

  item.interface.push({
    type: "markdown",
    content: {
      markdown,
    },
  });
}

function isSlackPaste(content: string): boolean {
  // 1. My name.
  // 2. A new line.
  // 3. Maybe a status icon.
  // 4. A time.
  return (
    content.match(
      /^Jonathan Clem\n(?::[^:]+:)?\s+\d{1,2}:\d{2}\s(?:AM|PM)$/m,
    ) !== null
  );
}
