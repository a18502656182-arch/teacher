import ClassroomApp from "./ClassroomApp";

export default async function WorkspacePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <div data-ui-generation="legacy" data-theme="campus" style={{ display: "contents" }}>
    <ClassroomApp token={token} />
  </div>;
}
