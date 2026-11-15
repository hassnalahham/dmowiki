import { PageForm } from "@/components/dashboard/page-form";

export default function NewPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">New page</h1>
      <PageForm initial={{ title: "", slug: "", type: "article", html: "", categories: "", published: true }} />
    </div>
  );
}
