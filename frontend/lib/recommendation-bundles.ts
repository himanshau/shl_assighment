import type { Recommendation, RecommendationBundle } from "@/lib/types";
import { roleTitleFromMessage } from "@/lib/role-title";

export function appendRecommendationBundle(
  prev: RecommendationBundle[],
  userMessage: string,
  recommendations: Recommendation[],
): RecommendationBundle[] {
  if (!recommendations.length) return prev;

  const roleTitle = roleTitleFromMessage(userMessage);
  const id = `${Date.now()}-${roleTitle.replace(/\s+/g, "-").toLowerCase()}`;

  return [
    ...prev,
    {
      id,
      roleTitle,
      userMessage: userMessage.trim(),
      recommendations,
    },
  ];
}
