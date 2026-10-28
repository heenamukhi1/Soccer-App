import { GoogleGenAI } from "@google/genai";

const SYSTEM_PROMPT =
  'You are an elite soccer coach. Analyze the player profile and any provided match notes, attached PDF reports, and/or screenshots/images (e.g., match stats, scouting reports, tactical heatmaps, or whiteboard notes). Return ONLY a JSON object with four keys: "rating" (a number 1-10), "strengths" (an array of exactly 3 objects, each with "name" as a concise skill title and "detail" as a specific, evidence-based explanation tied to the provided notes, documents, or images), "weaknesses" (an array of exactly 3 objects, each with "name" as a concise development-area title and "detail" as a specific explanation of what happened, why it matters, and what to improve), and "drills" (an array of exactly 3 actionable soccer drill strings). Do not invent observations that are not supported by the profile, notes, or uploaded documents/images. Make each explanation concrete and useful, not generic.';

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

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    console.warn("[api/analyze] Request rejected", { requestId, reason: "invalid_json" });
    return respond({ error: "Request body must be valid JSON." }, requestId, 400);
  }

  if (typeof body !== "object" || body === null) {
    console.warn("[api/analyze] Request rejected", { requestId, reason: "invalid_body" });
    return respond({ error: "A player profile and feedback notes or attachments (PDF/images) are required." }, requestId, 400);
  }

  const input = body as Record<string, unknown>;

  if (!isInputText(input.playerProfile)) {
    console.warn("[api/analyze] Request rejected", { requestId, reason: "invalid_profile" });
    return respond(
      {
        error: `Player profile must contain 1–${MAX_INPUT_LENGTH} characters.`,
      },
      requestId,
      400,
    );
  }

  const hasNotes = typeof input.matchNotes === "string" && input.matchNotes.trim().length > 0;

  const ALLOWED_MIME_TYPES = new Set([
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/gif",
  ]);

  type UploadedFile = {
    base64: string;
    mimeType: string;
    name?: string;
  };

  const incomingFiles: UploadedFile[] = [];

  // Check array of files
  if (Array.isArray(input.files)) {
    for (const item of input.files) {
      if (
        typeof item === "object" &&
        item !== null &&
        typeof item.base64 === "string" &&
        item.base64.length > 0 &&
        item.base64.length <= 25_000_000 &&
        typeof item.mimeType === "string" &&
        ALLOWED_MIME_TYPES.has(item.mimeType.toLowerCase())
      ) {
        incomingFiles.push({
          base64: item.base64.includes(",") ? item.base64.split(",")[1] : item.base64,
          mimeType: item.mimeType.toLowerCase() === "image/jpg" ? "image/jpeg" : item.mimeType.toLowerCase(),
          name: typeof item.name === "string" ? item.name : undefined,
        });
      }
    }
  }

  // Backwards compatibility for single pdf object
  const pdfInput =
    typeof input.pdf === "object" && input.pdf !== null
      ? (input.pdf as Record<string, unknown>)
      : null;
  if (
    incomingFiles.length === 0 &&
    pdfInput !== null &&
    typeof pdfInput.base64 === "string" &&
    pdfInput.base64.length > 0
  ) {
    const raw = pdfInput.base64 as string;
    incomingFiles.push({
      base64: raw.includes(",") ? raw.split(",")[1] : raw,
      mimeType: "application/pdf",
      name: typeof pdfInput.name === "string" ? pdfInput.name : undefined,
    });
  }

  const hasFiles = incomingFiles.length > 0;

  if (!hasNotes && !hasFiles) {
    console.warn("[api/analyze] Request rejected", { requestId, reason: "missing_feedback_and_files" });
    return respond(
      {
        error: "Please provide coach's feedback notes, an uploaded PDF, or screenshots/images.",
      },
      requestId,
      400,
    );
  }

  if (hasNotes && typeof input.matchNotes === "string" && input.matchNotes.length > MAX_INPUT_LENGTH) {
    console.warn("[api/analyze] Request rejected", { requestId, reason: "notes_too_long" });
    return respond(
      {
        error: `Coach's feedback notes must not exceed ${MAX_INPUT_LENGTH} characters.`,
      },
      requestId,
      400,
    );
  }

  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error("[api/analyze] Gemini API key is missing", { requestId });
    return respond(
      { error: "Gemini is not configured. Add GOOGLE_API_KEY to .env.local." },
      requestId,
      503,
    );
  }

  const playerProfile = (input.playerProfile as string).trim();
  const matchNotes = hasNotes ? (input.matchNotes as string).trim() : "";

  type ContentPart =
    | { inlineData: { mimeType: string; data: string } }
    | { text: string };

  const contents: ContentPart[] = [];

  for (const file of incomingFiles) {
    contents.push({
      inlineData: {
        mimeType: file.mimeType,
        data: file.base64,
      },
    });
  }

  const promptText = `Player Profile:\n${playerProfile}\n\nCoach's Notes & Observations:\n${
    matchNotes || "(No additional written notes provided; evaluate the player using the attached PDF report and/or screenshot images)"
  }`;
  contents.push({ text: promptText });

  console.info("[api/analyze] Gemini request", {
    requestId,
    model: MODEL,
    fileCount: incomingFiles.length,
    fileTypes: incomingFiles.map((f) => f.mimeType),
    fileNames: incomingFiles.map((f) => f.name).filter(Boolean),
    matchNotesLength: matchNotes.length,
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
      errorMessage: error instanceof Error ? error.message : String(error),
      errorCause: (error as { cause?: unknown })?.cause,
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