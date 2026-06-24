# Explorer. Trip Builder - Architecture & Logic Constraints

This document serves as the long-term memory for the core architectural decisions and logic constraints of the Trip Builder application. **AI agents working on this codebase must strictly adhere to these principles.**

## 1. Multi-Engine Architecture
The backend (`server.ts`) utilizes an Orchestrated Multi-Engine Architecture rather than a single monolithic AI prompt. This separates data gathering from mathematical constraint enforcement.

1.  **Research Engine (AI)**: Gathers factual metadata (operating hours, GPS coordinates, average duration, fees) for all locations (visits, overnights, flights) upfront.
2.  **Route Optimization Engine (AI)**: Proposes a purely geographic sequence of destinations. It is forbidden from scheduling 'travel' stops (these are interpolated later) and must include all requested locations.
3.  **Time Management Engine (Deterministic Math)**: A strict TypeScript module that enforces timelines, calculates travel distances, and applies pace scaling. **It prevents AI hallucinations in time math.**
4.  **Advisory Engine (AI)**: Reads the final mathematically verified itinerary and generates human-readable summaries, warnings, and optimization suggestions.

## 2. Time & Logistics Engine Rules (Deterministic Math)
All time calculations must be handled deterministically by the Time Management Engine.

*   **Realistic Travel Math**: Travel times are calculated using the Haversine formula based on GPS coordinates. To ensure realistic driving estimates (accounting for traffic and winding roads), the formula applies a **1.3x road multiplier** and assumes a baseline speed of **40 mph**.
*   **Time Formatting**: All time strings (arrivalTime, departureTime, operationHours) MUST be strictly formatted in 12-hour AM/PM format (e.g., `7:15 PM`). 24-hour formats are forbidden to ensure UI consistency.
*   **Meaningful Visits (Exploration Floor)**: Every 'visit' stop MUST have a dedicated exploration duration. The engine enforces a minimum floor of **45 minutes**, which is mathematically scaled by the user's Pace preference (Relaxed: 1.5x, Balanced: 1.0x, Fast: 0.7x).
*   **Timeline Integrity**: Arrival times must always equal the previous Departure Time + Travel Time. Departure times must equal Arrival Time + Exploration Duration. 

## 3. Strict Routing & Scheduling Constraints
The system must prioritize temporal feasibility and user control over pure geographic route density.

*   **User-Controlled Omissions (No Auto-Skipping)**: The system MUST NOT arbitrarily delete requested locations just because they violate daily time limits or operation hours. Instead, the Time Engine must schedule them and attach a highly visible warning (`WARNING: TIME VIOLATION` or `WARNING: CLOSED`). The Advisory Engine will then prompt the user to make the final optimization decision.
*   **Absolute Daily Window Enforcement**: The user's requested active window (e.g., 9:30 AM to 9:30 PM) is a hard wall. The system must maximize this window with exploration but flag any activity that bleeds past the `dailyEndTime`.
*   **Late Start Protection**: If a trip starts late in the day (e.g., after 5:00 PM), the Route Engine must dedicate Day 1 *purely* to travel to the first overnight location. No visit stops should be scheduled.
*   **Start/End Point Finality**: The Trip's Start and End points are strictly for travel origin/destination logic. They must NOT be scheduled as 'visit' stops unless the user explicitly checks the 'Explore Start Point' flag. Furthermore, in a round-trip scenario, any redundant 'Overnight' stays at the origin point on the final day must be programmatically stripped out.
*   **String Sanitization**: Location names must be aggressively cleaned using the `aggressiveClean` utility to strip prefixes like "Travel from:", "Drive to:", or "Explore". This prevents recursive string corruption in the UI rendering.