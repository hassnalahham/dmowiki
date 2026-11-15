import "server-only";
import { and, count, countDistinct, desc, eq, gte, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { pageRevisions, pages, pageViews, searchQueries, user } from "@/db/schema";

export async function getAnalytics(days: number) {
  const since = new Date(Date.now() - days * 86_400_000);
  const inRange = gte(pageViews.createdAt, since);

  const [totals, daily, topPages, referrers, devices, countries, topSearches, zeroSearches, recentEdits, contentByType] =
    await Promise.all([
      db
        .select({ views: count(), visitors: countDistinct(pageViews.visitorHash) })
        .from(pageViews)
        .where(inRange)
        .then((r) => r[0]),
      db
        .select({
          day: sql<string>`to_char(date_trunc('day', ${pageViews.createdAt}), 'YYYY-MM-DD')`.as("day"),
          views: count(),
          visitors: countDistinct(pageViews.visitorHash),
        })
        .from(pageViews)
        .where(inRange)
        .groupBy(sql`1`)
        .orderBy(sql`1`),
      db
        .select({ path: pageViews.path, title: pages.title, type: pages.type, views: count() })
        .from(pageViews)
        .leftJoin(pages, eq(pages.id, pageViews.pageId))
        .where(inRange)
        .groupBy(pageViews.path, pages.title, pages.type)
        .orderBy(desc(count()))
        .limit(15),
      db
        .select({ referrer: pageViews.referrer, views: count() })
        .from(pageViews)
        .where(and(inRange, isNotNull(pageViews.referrer)))
        .groupBy(pageViews.referrer)
        .orderBy(desc(count()))
        .limit(10),
      db
        .select({ device: pageViews.device, views: count() })
        .from(pageViews)
        .where(inRange)
        .groupBy(pageViews.device)
        .orderBy(desc(count())),
      db
        .select({ country: pageViews.country, views: count() })
        .from(pageViews)
        .where(and(inRange, isNotNull(pageViews.country)))
        .groupBy(pageViews.country)
        .orderBy(desc(count()))
        .limit(10),
      db
        .select({ query: searchQueries.query, searches: count(), results: sql<number>`max(${searchQueries.resultsCount})` })
        .from(searchQueries)
        .where(gte(searchQueries.createdAt, since))
        .groupBy(searchQueries.query)
        .orderBy(desc(count()))
        .limit(10),
      db
        .select({ query: searchQueries.query, searches: count() })
        .from(searchQueries)
        .where(and(gte(searchQueries.createdAt, since), eq(searchQueries.resultsCount, 0)))
        .groupBy(searchQueries.query)
        .orderBy(desc(count()))
        .limit(10),
      db
        .select({
          id: pageRevisions.id,
          pageId: pageRevisions.pageId,
          title: pages.title,
          comment: pageRevisions.comment,
          user: user.name,
          createdAt: pageRevisions.createdAt,
        })
        .from(pageRevisions)
        .leftJoin(pages, eq(pages.id, pageRevisions.pageId))
        .leftJoin(user, eq(user.id, pageRevisions.userId))
        .orderBy(desc(pageRevisions.createdAt))
        .limit(10),
      db
        .select({ type: pages.type, n: count() })
        .from(pages)
        .where(sql`${pages.type} <> 'redirect'`)
        .groupBy(pages.type)
        .orderBy(desc(count())),
    ]);

  // fill missing days with zeros so the chart has a continuous axis
  const byDay = new Map(daily.map((d) => [d.day, d]));
  const series: { day: string; views: number; visitors: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    const d = byDay.get(day);
    series.push({ day, views: d?.views ?? 0, visitors: d?.visitors ?? 0 });
  }

  return { totals, series, topPages, referrers, devices, countries, topSearches, zeroSearches, recentEdits, contentByType };
}
