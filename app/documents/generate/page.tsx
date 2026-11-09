import { DocumentGenerationPage } from "@/components/document-generation-page";
export default function Page({ searchParams }: { searchParams?: { source?: string | string[] } }) {
  return <DocumentGenerationPage source={typeof searchParams?.source === "string" ? searchParams.source : ""} />;
}
