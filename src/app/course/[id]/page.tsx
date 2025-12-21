import { Redis } from "@upstash/redis";
import CourseViewer from "@/components/CourseViewer";
import { notFound } from "next/navigation";
import { Course } from "@/lib/schema";

const redis = Redis.fromEnv();

// Server Component - Fetches Data BEFORE rendering (Super Fast)
export default async function PublicCoursePage({
  params,
}: {
  params: { id: string };
}) {
  const data = await redis.get(`course:${params.id}`);

  if (!data) {
    return notFound();
  }

  // Redis returns a JSON object directly if using the SDK
  const course = data as Course;

  return <CourseViewer course={course} />;
}