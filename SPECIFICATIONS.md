# Explorer. Trip Builder - Specifications & Requirements

## 1. Project Overview
**Explorer. Trip Builder** is an AI-powered travel planning application designed to create highly optimized, logistical itineraries. It leverages advanced language models (Gemini) to process user preferences, location data, and complex constraints (like lotteries or specific dates) into a coherent, actionable travel plan.

## 2. Core Features

### 2.1. Intelligent Itinerary Generation
- **Multi-Day Planning:** Supports trips from 1 day to several weeks.
- **Route Optimization:** Automatically calculates travel times and sequences stops for maximum efficiency.
- **Hard Constraints:** Respects user-specified dates for specific attractions (e.g., "Antelope Canyon on Day 3").
- **Action-Required Stops:** Automatically inserts prerequisite steps like permit applications or lottery entries (e.g., Angels Landing lottery 24h before the visit).

### 2.2. Interactive Itinerary Views
- **Timeline View:** A visual, chronological flow of the trip with rich details for each stop.
- **Table View:** A dense, sortable grid for logistical analysis and export.
- **Map Integration:** Interactive Google Maps display showing the route and key markers.

### 2.3. Daily Logistics & Summaries
- **Daily Totals:** Calculates total travel time and total exploration time per day.
- **Arrival/Departure Tracking:** Clearly marks "Arrive" and "Leave" times for each day.
- **Preparation Guide:** Provides context-aware advice on weather, gear, and closures.

### 2.4. Smart Optimizations
- **Feasibility Analysis:** AI detects if a plan is too packed or logistically impossible.
- **Proactive Suggestions:** Offers "Remove", "Replace", or "Add" suggestions to improve the trip quality.
- **One-Click Apply:** Users can apply AI suggestions directly to their plan.

## 3. Technical Requirements

### 3.1. Frontend
- **Framework:** React 18+ with TypeScript.
- **Styling:** Tailwind CSS for a modern, responsive utility-first design.
- **Animations:** Framer Motion (motion/react) for smooth transitions and interactive elements.
- **Icons:** Lucide-React for consistent iconography.

### 3.2. AI Integration
- **Model:** Google Gemini (via `@google/genai`).
- **Data Structure:** Strict JSON schema enforcement for reliable frontend rendering.
- **Grounding:** Prompt engineering to ensure specific location adherence and factual accuracy.

### 3.3. External APIs
- **Google Maps API:** For interactive maps, markers, and location visualization.
- **Google Search/Maps Grounding:** Used by the AI to verify hours, fees, and official websites.

## 4. Design Specifications
- **Primary Palette:** Yellow (#facc15) and Blue (#2563eb).
- **Typography:** Inter (Sans-serif) for high legibility.
- **Layout:** Responsive design that adapts from mobile to ultra-wide desktop monitors.
- **Visual Language:** Professional, clean, and data-dense with clear hierarchical structures.

## 5. User Experience Goals
- **Clarity:** Logistical information (times, durations, costs) must be unambiguous.
- **Reliability:** Itineraries must be realistic and account for real-world travel times.
- **Actionability:** Every stop should provide enough info (links, notes, GPS) for the user to execute the plan.
