import { Redis } from "@upstash/redis";
import CourseViewer from "@/components/CourseViewer";
import { notFound } from "next/navigation";
import { Course } from "@/lib/schema";

const redis = Redis.fromEnv();

// Server Component - Fetches Data BEFORE rendering (Super Fast)
export default async function PublicCoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: courseIdSlug } = await params;
  
  // Extract the ID from the slug (format: title-slug-ID)
  // We assume the ID is the last part after the last hyphen
  const courseId = courseIdSlug.split("-").pop();

  const data = await redis.get(`course:${courseId}`);

  if (!data) {
    return notFound();
  }

  // Redis returns a JSON object directly if using the SDK
  const course = data as Course;

  // We don't currently persist the original user request with the course in Redis.
  // Pass a light hint so downstream image search can still adapt.
  return <CourseViewer course={course} userPrompt={course.courseTitle} />;
}