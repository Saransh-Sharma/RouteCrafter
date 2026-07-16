import ProductEditorClient from "./ProductEditorClient";

export default async function ProductEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProductEditorClient projectId={id} />;
}
