import { ArtistDirectoryClient } from "@/components/artists/ArtistDirectoryClient";
import { EmptyState } from "@/components/shared/EmptyState";
import { getFollowedArtistIds } from "@/lib/auth/account-state";
import { getArtists, getCurrentUser } from "@/lib/data";

export default async function ArtistsPage() {
  const [user, artists] = await Promise.all([getCurrentUser(), getArtists()]);
  const followedArtistIds = user ? getFollowedArtistIds(user) : [];

  if (!artists.length) {
    return (
      <EmptyState
        title="No artists yet"
        description="Artist profiles appear here after their first release is published."
      />
    );
  }

  return (
    <ArtistDirectoryClient
      artists={artists}
      initialFollowingIds={followedArtistIds}
      showFollowButton={Boolean(user)}
    />
  );
}
