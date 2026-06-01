import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import PostEditorClient from "@/components/PostEditorClient";
import { shouldShowWatermark } from "@/lib/subscription-check";

export default async function PostEditorPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const [post, user] = await Promise.all([
    prisma.post.findFirst({
      where: { id: params.id, plan: { userId: session.user.id } },
      include: { plan: { select: { strategy: true, weekStart: true } } },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        postSignature: true, name: true, image: true, headline: true, timezone: true,
        email: true, role: true, subscription: { select: { status: true } },
      },
    }),
  ]);

  if (!post) notFound();

  const showWatermark = shouldShowWatermark({
    subscriptionStatus: user?.subscription?.status,
    email: user?.email,
    role: user?.role,
  });

  return (
    <PostEditorClient
      post={post}
      postSignature={user?.postSignature ?? null}
      userProfile={{
        name: user?.name ?? null,
        image: user?.image ?? null,
        headline: user?.headline ?? null,
      }}
      userTimezone={user?.timezone ?? "Asia/Kolkata"}
      showWatermark={showWatermark}
    />
  );
}

