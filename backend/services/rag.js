import "dotenv/config";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { embedQuery } from "./embeddings.js";
import { getStore } from "./vectorstore.js";

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
if (apiKey && !process.env.GOOGLE_API_KEY) {
  process.env.GOOGLE_API_KEY = apiKey;
}

let chatModel;

function getChatModel() {
  if (chatModel) return chatModel;
  chatModel = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash",
    apiKey,
    temperature: 0.3,
    streaming: true,
  });
  return chatModel;
}

const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You are a social media video analyst. You compare two videos (A and B) and answer questions based ONLY on the provided context.

Context:
{context}

Rules:
- Answer concisely and directly.
- Always cite sources at the end using [Video X — Chunk Y].
- If the context doesn't contain the answer, say so.
- Use the metadata (views, likes, comments, engagement rate) when relevant.`,
  ],
  new MessagesPlaceholder("history"),
  ["human", "{question}"],
]);

const parser = new StringOutputParser();

export async function* streamAnswer(question, history = []) {
  const store = await getStore();
  const queryEmbedding = await embedQuery(question);
  const relevantChunks = await store.query(queryEmbedding, 5);

  const context = relevantChunks
    .map((c) => `[Video ${c.video_id} — Chunk ${c.index}]: ${c.text}`)
    .join("\n\n");

  const chain = RunnableSequence.from([prompt, getChatModel(), parser]);

  const messages = history.map((msg) =>
    msg.role === "user" ? new HumanMessage(msg.content) : new AIMessage(msg.content)
  );

  const stream = await chain.stream({
    context: context || "No relevant context found.",
    question,
    history: messages,
  });

  for await (const chunk of stream) {
    yield { type: "text", content: chunk };
  }

  if (relevantChunks.length > 0) {
    yield {
      type: "sources",
      content: relevantChunks.map((c) => ({
        video_id: c.video_id,
        chunk_index: c.index,
        text: c.text,
        score: c.score,
      })),
    };
  }
}
