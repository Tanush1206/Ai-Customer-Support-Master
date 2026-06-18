# System Architecture

## Overview

Nimbus Support Desk is a Retrieval-Augmented Generation (RAG) based customer support platform designed to automatically resolve common customer queries while escalating complex issues to human agents.

The system combines document retrieval, conversational memory, confidence-based decision making, and analytics into a single workflow.

---

# High-Level Architecture

```text
+------------------+
|      User        |
+------------------+
          |
          v
+------------------+
|   Chat Interface |
+------------------+
          |
          v
+----------------------+
| Query Contextualizer |
+----------------------+
          |
          v
+----------------------+
|   Embedding Engine   |
+----------------------+
          |
          v
+----------------------+
|  Vector Retrieval    |
|  (Knowledge Base)    |
+----------------------+
          |
          v
+----------------------+
| Confidence Evaluator |
+----------------------+
      |          |
      |          |
      v          v
+---------+   +------------+
| Answer  |   | Escalation |
|  Agent  |   |  Pipeline  |
+---------+   +------------+
      |              |
      v              v
+---------+    +------------+
| Response|    | Human Queue|
+---------+    +------------+
```

---

# Request Processing Flow

## Step 1: User Query

The user submits a question through the chat interface.

Example:

> How can I upgrade my Nimbus storage plan?

---

## Step 2: Contextualization

The system analyzes previous conversation history and rewrites the query into a standalone question.

Example:

User:

> What about the Family plan?

Contextualized Query:

> Explain Nimbus Family Plan pricing and storage limits.

This enables accurate retrieval for follow-up questions.

---

## Step 3: Knowledge Retrieval

The contextualized query is converted into an embedding vector.

The system searches the knowledge base containing:

* Product documentation
* FAQs
* Support articles
* Previously resolved tickets

The most relevant document chunks are retrieved.

---

## Step 4: Confidence Calculation

The retrieval system calculates a confidence score using similarity between the query and retrieved documents.

```text
High Confidence  -> Generate Response
Low Confidence   -> Escalate
```

The threshold is configurable through environment variables.

---

## Step 5A: AI Resolution Path

For high-confidence queries:

1. Retrieved context is provided to the LLM.
2. The model generates a grounded response.
3. The response is streamed back to the user.

Result:

```text
Resolved by AI
```

---

## Step 5B: Escalation Path

For low-confidence or out-of-scope requests:

1. AI generates a handoff summary.
2. Conversation context is preserved.
3. Request enters the human support queue.

Generated summary contains:

* Customer goal
* Conversation summary
* Key facts
* Sentiment
* Recommended next steps

Result:

```text
Escalated to Human Agent
```

---

# Database Architecture

The application uses SQLite as its primary datastore.

Core entities include:

## Documents

Stores uploaded knowledge-base documents.

## Chunks

Stores document fragments and embeddings used for retrieval.

## Conversations

Tracks chat sessions.

## Messages

Stores user and assistant messages.

## Escalations

Stores human handoff requests.

## Feedback

Stores thumbs-up and thumbs-down ratings.

## Query Events

Stores analytics data for dashboard reporting.

---

# Analytics Pipeline

Every query generates an analytics event.

Tracked metrics include:

* Query volume
* Resolution rate
* Escalation rate
* Topic frequency
* Unanswered questions
* User feedback

These metrics power the Admin Dashboard.

---

# Technology Stack

## Frontend

* Next.js 16
* React 19
* TypeScript
* Tailwind CSS

## Backend

* Next.js API Routes
* OpenRouter API

## AI Services

* GPT-4o Mini
* OpenAI Embeddings

## Database

* SQLite (`node:sqlite`)

---

# Key Design Decisions

### Retrieval-Augmented Generation (RAG)

Reduces hallucinations by grounding responses in the knowledge base.

### Multi-Turn Memory

Allows natural conversations without requiring users to repeat context.

### Confidence-Based Escalation

Prevents incorrect answers by routing uncertain queries to humans.

### Human Handoff Summaries

Reduces support-agent workload by preserving conversation context.

### Analytics-Driven Improvement

Enables continuous monitoring and optimization of support performance.

---

# Conclusion

Nimbus Support Desk demonstrates a production-style AI support workflow combining Retrieval-Augmented Generation, conversational memory, confidence-aware escalation, human support integration, and real-time analytics in a unified platform.
