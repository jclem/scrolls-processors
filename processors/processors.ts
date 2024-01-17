import type OpenAI from "openai";
import { z } from "zod";

export const Item = z.object({
  id: z.string(),
  type: z.string(),
  data: z.string(),
  metadata: z.record(z.unknown()),
  hide_data: z.boolean(),
  interface: z.array(
    z.discriminatedUnion("type", [
      z.object({
        type: z.literal("markdown"),
        content: z.object({ markdown: z.string() }),
      }),

      z.object({
        type: z.literal("image"),
        content: z.object({ url: z.string(), alt: z.string() }),
      }),

      z.object({
        type: z.literal("map"),
        content: z.object({ latitude: z.number(), longitude: z.number() }),
      }),
    ]),
  ),
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
