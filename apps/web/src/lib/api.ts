import { calendarItems, organizations, posts, socialAccounts } from "./mock-data";

const wait = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getDashboardSnapshot() {
  await wait();

  return {
    organizations,
    socialAccounts,
    posts,
    calendarItems,
    kpis: {
      scheduled: posts.filter((post) => post.state === "scheduled").length,
      drafts: posts.filter((post) => post.state === "draft").length,
      failed: posts.filter((post) => post.state === "failed").length,
      connectedAccounts: socialAccounts.filter((account) => account.status === "connected").length
    }
  };
}
