# BWT_CodeTriad
Climate Tech Engine – Carbon Intelligence
Team: CodeTriad

Problem Statement

Small organizations lack affordable AI-driven tools to measure, forecast, and reduce their carbon footprint due to limited infrastructure and sustainability expertise.

Our Solution – SustainIQ

SustainIQ is an AI-powered carbon intelligence platform that transforms basic operational inputs into actionable sustainability strategies.

It:

Estimates carbon footprint from operational data

Forecasts future emissions

Identifies emission hotspots

Simulates reduction scenarios

Uses an LLM to generate intelligent, prioritized sustainability roadmaps

No hardware. No sensors. No dedicated sustainability team required.

How It Works

1️. Data Input

User provides:

Monthly electricity bill

Number of employees

AC usage hours

Diesel usage (optional)

Office size

2️. Carbon Estimation Engine

Converts cost → estimated energy consumption

Applies emission factors

Calculates total CO₂ footprint

3️. Forecasting Engine

Projects 6-month emission trends

Identifies growth patterns

4️. AI Optimization Engine (LLM-Powered)

Structured carbon data is sent to an LLM via API

The LLM analyzes emission patterns

Generates prioritized reduction strategies

Suggests cost–carbon tradeoffs

Produces an actionable sustainability roadmap

Architecture

```
User
  ↓
Web Interface (HTML + CSS)
  ↓
JavaScript Processing Layer
   ├── Carbon Estimation Module
   ├── Forecasting Engine
   └── Scenario Simulator
  ↓
LLM API (AI Recommendation Engine)
  ↓
Visualization Layer (Chart.js)
  ↓
Interactive Dashboard Output
```

Tech Stack

Frontend: HTML5, CSS3, JavaScript 

AI Engine: LLM via API

Visualization: Chart.js


Key Features

Carbon Footprint Calculator

Emission Forecasting

Reduction Simulation

LLM-Generated Sustainability Roadmap

Cost vs Carbon Tradeoff Analysis

Impact

Makes carbon intelligence accessible to small organizations

Converts simple financial inputs into AI-driven sustainability decisions

Enables data-backed emission reduction planning

Eliminates need for physical monitoring infrastructure

Bill upload (PDF parsing)

Multi-branch carbon tracking

ESG reporting export

Industry-specific benchmarking
