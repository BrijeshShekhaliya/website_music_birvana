import { redirect } from "next/navigation";
import { PublicGuestExperience } from "@/components/public/PublicGuestExperience";
import { getCurrentUser, getDiscoverData } from "@/lib/data";

export default async function LandingPage() {
  const [user, { tracks, playlists }] = await Promise.all([getCurrentUser(), getDiscoverData()]);

  if (user) {
    redirect("/discover");
  }

  return <PublicGuestExperience tracks={tracks} playlists={playlists} />;
}
