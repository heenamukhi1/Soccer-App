import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";

const SYSTEM_PROMPT =
  'You are an elite soccer coach. Analyze the player profile, coach match notes, optional player self-assessment, free times, and available equipment. Use all provided perspectives to create a complete plan. Return ONLY a JSON object with five keys: "rating" (a number 1-10), "strengths" (exactly 3 objects with "name" and "detail"), "weaknesses" (exactly 3 objects with "name" and "detail"), "drills" (exactly 3 actionable soccer drill strings), and "schedule" (an array of training and break items placed only inside the player free-time windows). Each schedule item must contain "day", "startTime" in 24-hour HH:MM format, "name", "durationMinutes", and "type" of either "drill" or "break". Use 5-minute breaks between drills, longer rest periods when appropriate, and only equipment the player has. Repeat useful drills at most 1 or 2 times during the week, not more. Do not invent observations or schedule items outside the provided free times.';

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
  schedule: AnalysisScheduleItem[];
};

type AnalysisInsight = {
  name: string;
  detail: string;
};

type AnalysisScheduleItem = {
  day: string;
  startTime: string;
  name: string;
  durationMinutes: number;
  type: "drill" | "break";
};

function isInputText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= MAX_INPUT_LENGTH
  );
}

function isOptionalInputText(value: unknown): value is string {
  return typeof value === "string" && value.length <= MAX_INPUT_LENGTH;
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

function isSchedule(value: unknown): value is AnalysisScheduleItem[] {
  return Array.isArray(value) &&
    value.length <= 60 &&
    value.every((item) =>
      typeof item === "object" &&
      item !== null &&
      "day" in item &&
      typeof item.day === "string" &&
      item.day.trim().length > 0 &&
      "startTime" in item &&
      typeof item.startTime === "string" &&
      /^([01]\d|2[0-3]):[0-5]\d$/.test(item.startTime) &&
      "name" in item &&
      typeof item.name === "string" &&
      item.name.trim().length > 0 &&
      "durationMinutes" in item &&
      typeof item.durationMinutes === "number" &&
      Number.isFinite(item.durationMinutes) &&
      item.durationMinutes >= 1 &&
      "type" in item &&
      (item.type === "drill" || item.type === "break"),
    );
}

function timeToMinutes(value: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function minutesToTime(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

type AvailabilityWindow = {
  day: string;
  startTime: string;
  endTime: string;
};

function buildFallbackSchedule(
  drills: string[],
  availability: AvailabilityWindow[],
) {
  const schedule: AnalysisScheduleItem[] = [];
  const drillCountByName = new Map<string, number>();
  let availabilityIndex = 0;

  for (const window of availability) {
    const start = timeToMinutes(window.startTime);
    const end = timeToMinutes(window.endTime);
    if (start === null || end === null || end - start < 25) continue;

    let cursor = start;
    let sessionsInWindow = 0;

    while (cursor + 20 <= end && sessionsInWindow < 2) {
      let drill = drills[availabilityIndex % drills.length];
      let attempts = 0;
      while ((drillCountByName.get(drill) ?? 0) >= 2 && attempts < drills.length) {
        availabilityIndex += 1;
        drill = drills[availabilityIndex % drills.length];
        attempts += 1;
      }
      const repeatedCount = drillCountByName.get(drill) ?? 0;
      if (repeatedCount >= 2) break;

      schedule.push({
        day: window.day,
        startTime: minutesToTime(cursor),
        name: drill,
        durationMinutes: 20,
        type: "drill",
      });
      drillCountByName.set(drill, repeatedCount + 1);
      cursor += 20;
      sessionsInWindow += 1;
      availabilityIndex += 1;

      if (cursor + 5 <= end && sessionsInWindow < 2) {
        schedule.push({
          day: window.day,
          startTime: minutesToTime(cursor),
          name: "Rest break",
          durationMinutes: 5,
          type: "break",
        });
        cursor += 5;
      }
    }
  }

  return schedule;
}

function normalizeSchedule(
  value: unknown,
  availability: AvailabilityWindow[],
) {
  if (!isSchedule(value) || value.length === 0) return null;

  const validItems = value.filter((item) => {
    const start = timeToMinutes(item.startTime);
    if (start === null) return false;
    const end = start + item.durationMinutes;

    return availability.some((window) => {
      const windowStart = timeToMinutes(window.startTime);
      const windowEnd = timeToMinutes(window.endTime);
      return (
        window.day === item.day &&
        windowStart !== null &&
        windowEnd !== null &&
        start >= windowStart &&
        end <= windowEnd
      );
    });
  });

  return validItems.length > 0 ? validItems.slice(0, 60) : null;
}

function isAnalysisResult(value: unknown): value is AnalysisResult {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const result = value as Record<string, unknown>;

  return (
    typeof result.rating === "number" &&
    Number.isFinite(result.rating) &&
    result.rating >= 1 &&
    result.rating <= 10 &&
    isThreeInsights(result.strengths) &&
    isThreeInsights(result.weaknesses) &&
    isThreeStrings(result.drills) &&
    isSchedule(result.schedule)
  );
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const startedAt = Date.now();
  console.info("[api/analyze] Request received", { requestId });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
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

  if (
    !isInputText(input.playerProfile) ||
    !isInputText(input.matchNotes) ||
    (input.playerAssessment !== undefined && !isOptionalInputText(input.playerAssessment))
  ) {
    console.warn("[api/analyze] Request rejected", { requestId, reason: "invalid_input" });
    return respond(
      {
        error: `Player profile and match notes must each contain 1–${MAX_INPUT_LENGTH} characters. The optional player assessment may contain up to ${MAX_INPUT_LENGTH} characters.`,
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
  const playerAssessment =
    typeof input.playerAssessment === "string" ? input.playerAssessment.trim() : "";
  const trainingAvailability =
    Array.isArray(input.trainingAvailability)
      ? input.trainingAvailability
          .filter((item): item is Record<string, unknown> =>
            typeof item === "object" && item !== null,
          )
          .map((item) => ({
            day: typeof item.day === "string" ? item.day : "",
            startTime: typeof item.startTime === "string" ? item.startTime : "",
            endTime: typeof item.endTime === "string" ? item.endTime : "",
          }))
          .filter((item) => item.day && item.startTime && item.endTime)
      : [];
  const trainingEquipment =
    Array.isArray(input.trainingEquipment)
      ? input.trainingEquipment.filter(
          (item): item is string => typeof item === "string" && item.trim().length > 0,
        )
      : [];
  const contents = [
    `Player Profile:\n${playerProfile}`,
    `Coach Match Notes:\n${matchNotes}`,
    playerAssessment ? `Player Self-Assessment:\n${playerAssessment}` : null,
    trainingAvailability.length
      ? `Available Free Times:\n${trainingAvailability.map((item) => `${item.day}: ${item.startTime}-${item.endTime}`).join("\n")}`
      : "Available Free Times: None provided; do not invent times outside the player's schedule.",
    `Available Equipment:\n${trainingEquipment.length ? trainingEquipment.join(", ") : "No equipment listed; use bodyweight drills only."}`,
  ].filter(Boolean).join("\n\n");

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

    if (typeof result === "object" && result !== null) {
      const resultRecord = result as Record<string, unknown>;
      if (isThreeStrings(resultRecord.drills)) {
        const geminiSchedule = normalizeSchedule(
          resultRecord.schedule,
          trainingAvailability,
        );
        resultRecord.schedule =
          geminiSchedule ??
          buildFallbackSchedule(resultRecord.drills, trainingAvailability);
      }
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