import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const feedbackSchema = z.object({
  type: z.enum(["Bug", "Improvement"]),
  message: z.string().trim().min(5, "Message trop court").max(2000),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
});

export const submitFeedback = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => feedbackSchema.parse(input))
  .handler(async ({ data }) => {
    const NOTION_DATABASE_ID = "399a22c5-4be2-8067-b6f5-f222e272a51d";
    const GATEWAY_URL = "https://connector-gateway.lovable.dev/notion/v1";
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const NOTION_API_KEY = process.env.NOTION_API_KEY;
    if (!LOVABLE_API_KEY || !NOTION_API_KEY) {
      throw new Error("Feedback service not configured");
    }

    const title = data.message.slice(0, 80).replace(/\s+/g, " ").trim();
    const today = new Date().toISOString().slice(0, 10);

    const body = {
      parent: { database_id: NOTION_DATABASE_ID },
      properties: {
        Name: { title: [{ text: { content: title || "(sans titre)" } }] },
        Select: { select: { name: data.type } },
        Description: {
          rich_text: [
            {
              text: {
                content:
                  data.message + (data.email ? `\n\n— ${data.email}` : ""),
              },
            },
          ],
        },
        Date: { date: { start: today } },
      },
    };

    const res = await fetch(`${GATEWAY_URL}/pages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": NOTION_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`Notion feedback failed [${res.status}]: ${errBody}`);
      throw new Error("Envoi impossible pour le moment");
    }

    return { ok: true };
  });
