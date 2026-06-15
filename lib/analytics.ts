import { db } from "./db";
import type { Topic } from "./types";

export interface TopicStat {
  topic: Topic;
  total: number;
  resolved: number;
  escalated: number;
  avgConfidence: number;
}

export interface VolumePoint {
  date: string;
  total: number;
  escalated: number;
}

export interface UnansweredQuery {
  query: string;
  count: number;
  avgConfidence: number;
  topic: Topic;
  lastAsked: string;
}

export interface AdminAnalytics {
  totals: {
    totalQueries: number;
    resolved: number;
    escalated: number;
    resolutionRate: number;
    escalationRate: number;
    avgConfidence: number;
    conversations: number;
    documents: number;
    chunks: number;
  };
  volumeByDay: VolumePoint[];
  topicBreakdown: TopicStat[];
  escalationByTopic: { topic: Topic; count: number }[];
  topUnanswered: UnansweredQuery[];
  feedback: { up: number; down: number; reviewQueue: number };
  openEscalations: number;
}

export function getAnalytics(): AdminAnalytics {
  const totalsRow = db
    .prepare(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(resolved), 0) AS resolved,
              COALESCE(SUM(escalated), 0) AS escalated,
              COALESCE(AVG(confidence), 0) AS avgConfidence
       FROM query_events`,
    )
    .get() as { total: number; resolved: number; escalated: number; avgConfidence: number };

  const conversations = (
    db.prepare("SELECT COUNT(*) AS n FROM conversations").get() as { n: number }
  ).n;
  const documents = (db.prepare("SELECT COUNT(*) AS n FROM documents").get() as { n: number }).n;
  const chunks = (db.prepare("SELECT COUNT(*) AS n FROM chunks").get() as { n: number }).n;

  const total = totalsRow.total;

  const volumeByDay = db
    .prepare(
      `SELECT date(created_at) AS date,
              COUNT(*) AS total,
              COALESCE(SUM(escalated), 0) AS escalated
       FROM query_events
       GROUP BY date(created_at)
       ORDER BY date(created_at) ASC
       LIMIT 30`,
    )
    .all() as unknown as VolumePoint[];

  const topicBreakdown = db
    .prepare(
      `SELECT topic,
              COUNT(*) AS total,
              COALESCE(SUM(resolved), 0) AS resolved,
              COALESCE(SUM(escalated), 0) AS escalated,
              COALESCE(AVG(confidence), 0) AS avgConfidence
       FROM query_events
       GROUP BY topic
       ORDER BY total DESC`,
    )
    .all() as unknown as TopicStat[];

  const escalationByTopic = db
    .prepare(
      `SELECT topic, COUNT(*) AS count
       FROM query_events
       WHERE escalated = 1
       GROUP BY topic
       ORDER BY count DESC`,
    )
    .all() as { topic: Topic; count: number }[];

  const topUnanswered = db
    .prepare(
      `SELECT query,
              COUNT(*) AS count,
              COALESCE(AVG(confidence), 0) AS avgConfidence,
              topic,
              MAX(created_at) AS lastAsked
       FROM query_events
       WHERE escalated = 1
       GROUP BY lower(trim(query))
       ORDER BY count DESC, lastAsked DESC
       LIMIT 12`,
    )
    .all() as unknown as UnansweredQuery[];

  const fbRows = db
    .prepare("SELECT rating, COUNT(*) AS n FROM feedback GROUP BY rating")
    .all() as { rating: string; n: number }[];
  const up = fbRows.find((r) => r.rating === "up")?.n ?? 0;
  const down = fbRows.find((r) => r.rating === "down")?.n ?? 0;
  const reviewQueue = (
    db
      .prepare("SELECT COUNT(*) AS n FROM feedback WHERE rating = 'down' AND reviewed = 0")
      .get() as { n: number }
  ).n;

  const openEscalations = (
    db.prepare("SELECT COUNT(*) AS n FROM escalations WHERE status = 'open'").get() as { n: number }
  ).n;

  return {
    totals: {
      totalQueries: total,
      resolved: totalsRow.resolved,
      escalated: totalsRow.escalated,
      resolutionRate: total ? totalsRow.resolved / total : 0,
      escalationRate: total ? totalsRow.escalated / total : 0,
      avgConfidence: totalsRow.avgConfidence,
      conversations,
      documents,
      chunks,
    },
    volumeByDay,
    topicBreakdown,
    escalationByTopic,
    topUnanswered,
    feedback: { up, down, reviewQueue },
    openEscalations,
  };
}
