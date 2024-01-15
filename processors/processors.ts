import type OpenAI from "openai";
import { z } from "zod";

export const Item = z.object({
  id: z.string(),
  type: z.string(),
  data: z.string(),
  metadata: z.record(z.unknown()),
  inserted_at: z.string(),
  updated_at: z.string(),
});

export type Item = z.infer<typeof Item>;

export type BaseProcessorInput = {
  item: Item;
  openai: OpenAI;
};

export type TextProcessorInput = BaseProcessorInput & {
  type: "text";
  content: string;
};

export type URLProcessorInput = BaseProcessorInput & {
  type: "url";
  url: string;
  response: Response;
  contentType: string;
};

export type ProcessorInput = TextProcessorInput | URLProcessorInput;

export const halt = Symbol("halt");
