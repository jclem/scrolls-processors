import type { ProcessorInput, halt } from "./processors";

export async function describeImage(
  input: ProcessorInput,
): Promise<void | typeof halt> {
  if (input.type !== "url" || !input.contentType.startsWith("image/")) {
    return;
  }

  const { item, openai } = input;

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
            image_url: { url: item.data, detail: "high" },
          },
        ],
      },
    ],
  });

  const description = output.choices.at(0)?.message.content ?? "";

  item.metadata.description = description;
}
