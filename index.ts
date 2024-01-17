import { assert } from "@jclem/assert";
import OpenAI from "openai";
import { describeImage } from "./processors/describe-image";
import { summarizeSlackConversation } from "./processors/process-slack";
import { Item, halt, type ProcessorInput } from "./processors/processors";
import { renderLocation } from "./processors/render-location";
import { summarizeWebpage } from "./processors/summarize-webpage";

const processors = [
  summarizeSlackConversation,
  summarizeWebpage,
  describeImage,
  renderLocation,
];

const path = assert(Bun.argv.at(2));
const file = Bun.file(path);
const item = Item.parse(JSON.parse(await file.text()));
const openai = new OpenAI({ apiKey: assert(Bun.env.OPENAI_API_KEY) });

if (item.type !== "draft") {
  process.exit(0);
}

let input: ProcessorInput;

if (item.data.startsWith("https://")) {
  const response = await fetch(item.data);
  const contentType = response.headers.get("content-type") ?? "";

  input = {
    item,
    openai,
    type: "url",
    url: item.data,
    response,
    contentType,
  };
} else {
  input = {
    item,
    openai,
    type: "text",
    content: item.data,
  };
}

for (const processor of processors) {
  const out = await processor(input);

  if (out === halt) {
    break;
  }
}

Bun.write(file, JSON.stringify(item));
