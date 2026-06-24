# Explorer. Trip Builder - Business Requirements Document

## 1. Executive Summary
**Explorer. Trip Builder** is an intelligent travel orchestration platform. Unlike traditional travel sites that focus on booking, Explorer focuses on **logistical feasibility**. It uses AI to solve the "Traveling Salesperson Problem" for tourists, ensuring that a list of desired destinations can actually be visited within a specific timeframe while respecting physical limits and hard-coded constraints.

## 2. Application Structure
The application is built as a Single Page Application (SPA) with a clear two-phase architecture:
1.  **The Configuration Phase (Input):** A structured data-entry environment where users define the "What, When, and How" of their trip.
2.  **The Visualization Phase (Output):** A multi-dimensional dashboard that translates AI-processed data into actionable travel plans.

---

## 3. Input Side: Functional Requirements

The input side is designed to capture every variable that impacts travel logistics.

### 3.1. Trip Preferences (The "Vibe")
*   **Purpose:** Calibrates the AI's selection of suggested spots and the intensity of daily schedules.
*   **Key Inputs:** Experience Type (Hiking vs. Sightseeing), Hiking Difficulty, Infrastructure Importance, and Trip Pace (Relaxed vs. Fast).

### 3.2. Temporal Constraints (The "When")
*   **Purpose:** Defines the absolute start and end of the journey.
*   **Key Inputs:** Start/End Dates and Times.
*   **Business Logic:** These dates determine the number of itinerary days generated. Times on the first/last day limit the activities possible during those windows.

### 3.3. Geographical Route (The "Where")
*   **Purpose:** Establishes the anchor points of the trip.
*   **Key Inputs:** Start/End locations and Trip Type (One-Way vs. Round-Trip).

### 3.4. Air Travel Integration
*   **Purpose:** Synchronizes ground logistics with flight schedules.
*   **Functionality:** Users input flight segments (Airports/Times). The AI uses this to calculate "Airport Buffer Time" and ensures the user is at the airport when required, effectively locking those time blocks.

### 3.5. Destination Management (The "Must-Sees")
*   **Purpose:** The primary list of goals for the trip.
*   **Functionality:** Supports bulk pasting or manual entry.
*   **Hard Constraints:** Users can assign a specific date to any location. The AI **must** honor this date, even if it results in an inefficient route, highlighting the logistical cost in the optimization section.

### 3.6. Logistical Limits (The "How")
*   **Purpose:** Sets the boundaries of human endurance and vehicle capability.
*   **Key Inputs:** Daily Travel Limit (max hours moving), Daily Operating Window (e.g., 9:00 AM to 9:00 PM), and Transport Overrides (e.g., "I want to hike between Point A and Point B instead of driving").

---

## 4. Output Side: Meaning and Interpretation

The output side is the "Source of Truth" for the traveler.

### 4.1. Narrative & Preparation
*   **Summary:** A high-level explanation of the route's logic.
*   **Preparation Guide:** A critical safety and readiness section. It translates destination data into advice on gear (Must-Haves), pitfalls (What to Avoid), and environmental factors (Weather Dynamics).

### 4.2. Smart Optimizations (The AI Consultant)
*   **Meaning:** This section appears if the AI detects that the user's requested plan is unrealistic (e.g., too much driving, not enough time for visits).
*   **Functionality:** Provides actionable buttons to "Remove" low-priority stops, "Replace" inefficient ones, or "Adjust" parameters to make the trip work.

### 4.3. Timeline View (The Daily Guide)
*   **Meaning:** A visual walkthrough of each day.
*   **Metrics:** 
    *   **Travel Time:** Total time spent in transit.
    *   **Exploration Time:** Total time spent experiencing attractions.
    *   **Action Required:** High-visibility alerts for permit deadlines or lottery entries.

### 4.4. Table View (The Logistical Grid)
*   **Meaning:** A structured data view for users who need to see exact coordinates, fees, and hours in a sortable format.
*   **Functionality:** Supports density adjustments (Compact/Spacious) for different screen sizes or printing needs.

### 4.5. Map View (The Spatial Context)
*   **Meaning:** A geographical validation of the trip. It allows users to see the "shape" of their journey and verify that the AI has chosen a logical path through the landscape.

---

## 5. Non-Functional Requirements
*   **Responsiveness:** The application must be usable on mobile devices (for on-the-road reference) and desktops (for planning).
*   **Data Integrity:** All external links (Official Sites) must be verified and clickable.
*   **Performance:** AI generation should provide progress feedback to the user to manage expectations during complex route calculations.
