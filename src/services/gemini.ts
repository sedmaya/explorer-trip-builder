import { TripInputs, TripPlan } from "../types";

/**
 * Calls the full-stack server endpoints to generate the comprehensive trip plan.
 * Keeps API keys and model coordination entirely secure on the server side.
 */
export async function generateTripPlan(inputs: TripInputs): Promise<TripPlan> {
  console.log("Requesting trip plan from server-side optimizer...", inputs);
  
  const response = await fetch("/api/generate-trip-plan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(inputs),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error || `Failed to generate itinerary. (Server status ${response.status})`;
    throw new Error(message);
  }

  const plan: TripPlan = await response.json();
  return plan;
}
