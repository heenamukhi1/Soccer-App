import { GoogleGenAI } from "@google/genai";
import { auth } from "@/auth";

const SYSTEM_PROMPT =
  'You are an elite soccer coach. Analyze the player profile and match notes. Return ONLY a JSON object with four keys: "rating" (a number 1-10), "strengths" (an array of exactly 3 objects, each with "name" as a concise skill title and "detail" as a specific, evidence-based explanation tied to the provided match notes), "weaknesses" (an array of exactly 3 objects, each with "name" as a concise development-area title and "detail" as a specific explanation of what happened, why it matters, and what to improve), and "drills" (an array of exactly 3 actionable soccer drill strings). Do not invent observations that are not supported by the profile or notes. Make each explanation concrete and useful, not generic.';

const MAX_INPUT_LENGTH = 10_000;
const MODEL = "gemini-3.8-flash";

function getRequestId(request: Request) {
  const providedId = request.headers.get("x-request-id");

  return providedId && /^[A-Za-z0-9_-]{1,64}$/.test(providedId)
    ? providedId
    : crypto.randomUUID();
}

function respond(body: unknown, requestId: string, status = 200) {
  return Response.json(body, {
    status,
    headers: { "X-Request-ID": requestId },
  });
}

type AnalysisResult = {
  rating: number;
  strengths: AnalysisInsight[];
  weaknesses: AnalysisInsight[];
  drills: string[];
};

type AnalysisInsight = {
  name: string;
  detail: string;
};

function isInputText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= MAX_INPUT_LENGTH
  );
}

function isThreeStrings(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every(
      (item) => typeof item === "string" && item.trim().length > 0,
    )
  );
}

function isThreeInsights(value: unknown): value is AnalysisInsight[] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        "name" in item &&
        typeof item.name === "string" &&
        item.name.trim().length > 0 &&
        "detail" in item &&
        typeof item.detail === "string" &&
        item.detail.trim().length > 0,
    )
  );
}

function isAnalysisResult(value: unknown): value is AnalysisResult {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const result = value as Record<string, unknown>;

  return (
    Object.keys(result).length === 4 &&
    typeof result.rating === "number" &&
    Number.isFinite(result.rating) &&
    result.rating >= 1 &&
    result.rating <= 10 &&
    isThreeInsights(result.strengths) &&
    isThreeInsights(result.weaknesses) &&
    isThreeStrings(result.drills)
  );
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const startedAt = Date.now();
  console.info("[api/analyze] Request received", { requestId });

  const session = await auth();

  if (!session?.user) {
    console.warn("[api/analyze] Request rejected", {
      requestId,
      reason: "unauthenticated",
    });
    return respond({ error: "Sign in to analyze a session." }, requestId, 401);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    console.warn("[api/analyze] Request rejected", { requestId, reason: "invalid_json" });
    return respond({ error: "Request body must be valid JSON." }, requestId, 400);
  }

  if (typeof body !== "object" || body === null) {
    console.warn("[api/analyze] Request rejected", { requestId, reason: "invalid_body" });
    return respond({ error: "A player profile and match notes are required." }, requestId, 400);
  }

  const input = body as Record<string, unknown>;

  if (!isInputText(input.playerProfile) || !isInputText(input.matchNotes)) {
    console.warn("[api/analyze] Request rejected", { requestId, reason: "invalid_input" });
    return respond(
      {
        error: `Player profile and match notes must each contain 1–${MAX_INPUT_LENGTH} characters.`,
      },
      requestId,
      400,
    );
  }

  const apiKey = process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    console.error("[api/analyze] Gemini API key is missing", { requestId });
    return respond(
      { error: "Gemini is not configured. Add GOOGLE_API_KEY to .env.local." },
      requestId,
      503,
    );
  }

  const playerProfile = input.playerProfile.trim();
  const matchNotes = input.matchNotes.trim();
  const contents = `Player Profile:\n${playerProfile}\n\nMatch Notes:\n${matchNotes}`;

  console.info("[api/analyze] Gemini request", {
    requestId,
    model: MODEL,
    systemInstruction: SYSTEM_PROMPT,
    contents,
    responseMimeType: "application/json",
  });

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { retryOptions: { attempts: 1 } },
    });
    const response = await ai.models.generateContent({
      model: MODEL,
      contents,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
      },
    });

    const text = response.text;
    console.info(
      `[api/analyze] Gemini response JSON (${requestId}):\n${text ?? "<empty response>"}`,
    );

    if (!text) {
      console.warn("[api/analyze] Gemini returned an empty response", { requestId, model: MODEL });
      return respond(
        { error: "Gemini returned an empty analysis. Please try again." },
        requestId,
        502,
      );
    }

    let result: unknown;

    try {
      result = JSON.parse(text);
    } catch {
      console.warn("[ç] Gemini returned invalid JSON", { requestId, model: MODEL });
      return respond(
        { error: "Gemini returned an invalid analysis. Please try again." },
        requestId,
        502,
      );
    }

    if (!isAnalysisResult(result)) {
      console.warn("[api/analyze] Gemini response failed schema validation", { requestId, model: MODEL });
      return respond(
        { error: "Gemini returned an unexpected analysis format. Please try again." },
        requestId,
        502,
      );
    }

    console.info("[api/analyze] Analysis completed", {
      requestId,
      model: MODEL,
      status: 200,
      durationMs: Date.now() - startedAt,
      rating: result.rating,
      strengthCount: result.strengths.length,
      weaknessCount: result.weaknesses.length,
      drillCount: result.drills.length,
    });

    return respond(result, requestId);
  } catch (error) {
    const details =
      typeof error === "object" && error !== null
        ? (error as { status?: unknown; code?: unknown })
        : undefined;
    const errorCode =
      typeof details?.code === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(details.code)
        ? details.code
        : undefined;
    const providerStatus =
      typeof details?.status === "number" ? details.status : undefined;

    console.error("[api/analyze] Gemini request failed", {
      requestId,
      model: MODEL,
      durationMs: Date.now() - startedAt,
      errorName: error instanceof Error ? error.name : "UnknownError",
      providerStatus,
      providerCode: errorCode,
    });

    const message =
      providerStatus === 503
        ? "Gemini is temporarily unavailable (Google API 503). Please retry shortly."
        : providerStatus === 429
          ? "Gemini rate limit reached (Google API 429). Please retry later."
          : providerStatus !== undefined
            ? `Gemini request failed (Google API ${providerStatus}). See the server log for details.`
            : "Gemini analysis is temporarily unavailable. Please try again.";

    return respond(
      { error: message },
      requestId,
      502,
    );
  }
}