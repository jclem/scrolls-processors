import { z } from "zod";
import type { ProcessorInput, halt } from "./processors";

const locationMetadata = z.object({
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }),
});

export async function renderLocation(
  input: ProcessorInput,
): Promise<void | typeof halt> {
  const parsed = locationMetadata.safeParse(input.item.metadata);

  if (!parsed.success) {
    return;
  }

  input.item.interface.push({
    type: "map",
    content: {
      latitude: parsed.data.location.latitude,
      longitude: parsed.data.location.longitude,
    },
  });
}
