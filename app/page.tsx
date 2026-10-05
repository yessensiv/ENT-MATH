import LearningApp from "@/components/learning-app";
import { topics } from "@/lib/content";
export const dynamic = "force-dynamic";
export default function Home() {
  return <LearningApp curriculum={topics.map(({tasks,...topic})=>({...topic,tasks:[]}))}/>;
}
