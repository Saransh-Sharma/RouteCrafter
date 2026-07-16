import SeriesBoardClient from "./SeriesBoardClient";

export default async function SeriesBoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SeriesBoardClient seriesId={id} />;
}
