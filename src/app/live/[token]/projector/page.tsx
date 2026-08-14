import { notFound } from "next/navigation";
import { lookupLiveState } from "../lookup";
import { LiveClient } from "../live-client";

export default async function ProjectorPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const state = await lookupLiveState(token);
  if (!state) notFound();

  return <LiveClient variant="projector" token={token} initialPayload={state.payload} churchName={state.churchName} />;
}
