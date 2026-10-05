import LearningApp from "@/components/learning-app";
import { topics } from "@/lib/content";
import { publishedContent } from "@/lib/server-store";
export const dynamic = "force-dynamic";
export default async function Home() {
  const material = await publishedContent();
  const curriculum = material.topics as unknown as typeof topics;
  return <LearningApp curriculum={curriculum.map(topic=>({...topic,tasks:[]}))}/>;
}
