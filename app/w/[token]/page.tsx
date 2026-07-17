import ClassroomApp from "./ClassroomApp";

export default async function WorkspacePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ClassroomApp token={token} />;
}
